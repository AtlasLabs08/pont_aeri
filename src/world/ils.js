/* ILS: localitzador i senda de planeig de 3 graus per a cada cap de pista.
 * ORIGEN: linies 1639-1685 de l'original (SECTION 8b).
 *
 * EXPORTA: ILS thresholdDistNm destinationEnd arrivalEnd flightApproach
 *
 * IMPORTA: ../core/constants.js, ./airports.js
 *
 * NOTA D ARQUITECTURA: ILS.nav() i ILS.geom() nomes necessiten constants, pero
 * ILS.update() (l auto-sintonitzacio) necessita la llista d aeroports. Com que
 * el harness fa servir nav(), core/harness.js acaba important d aqui. No es un
 * cicle, pero es una capa invertida. Apuntat a BACKLOG.md: separar la geometria
 * pura de l auto-sintonitzacio. NO ho facis durant la migracio.
 *
 * INTERFICIE (no la canviis, index.html i test/threshold.test.js en depenen):
 *   thresholdDistNm(A, en, e, n) -> nm   distancia horitzontal en linia
 *     recta des de (e, n) fins al llindar del cap de pista en. Es l unica
 *     distancia a l aeroport que index.html mostra (PFD, HUD de cabina, ND,
 *     caixa d aproximacio de les vistes exteriors, vol cronometrat), perque
 *     totes les vistes diguin el mateix (docs/DECISIONS.md, 29/09/2026).
 *     No toca ILS.nav(): distThr (per a les llicons) i dme hi queden igual.
 *   destinationEnd(A, ...candidats) -> cap de pista de destinacio a A: el
 *     primer candidat que sigui un cap de pista d A (index.html hi passa el
 *     sintonitzat i despres l assignat); si cap ho es, el primer d A.
 *
 * ILS per cap (F1, docs/DECISIONS.md, 2026-10-01, H3): nomes els caps amb
 * en.ils (airports.js) tenen ILS. update() no sintonitza mai els altres i
 * nav() hi dona el localitzador i la senda sense senyal (locValid fals).
 * Un cap sense el camp (LEBL, LEPA, la pista sintetica del harness) en te.
 *
 *   arrivalEnd(A, windDir, windKt) -> cap de pista d arribada a A del vol
 *     cronometrat de Free Flight (docs/DECISIONS.md, 2026-10-01, pista
 *     d arribada). Funcio pura: si A te un sol cap amb ILS, aquest; si en te
 *     diversos, d entre ells, i si no en te cap, d entre tots: el de mes vent
 *     de cara (windDir = d on ve el vent, graus; windKt en nusos); sense vent
 *     (windKt <= 0), el de la pista mes llarga. Empat: el primer d A.allEnds.
 *   flightApproach({ mode, start, airport, dest, runway, windDir, windKt })
 *     -> { A, en, tuned }   pista d arribada d un vol de Free Flight (H11) i si
 *     se n sintonitza l aproximacio des del principi (H13). Els camps son els
 *     de Game.opts (dest ja resolt: un altre aeroport). mode 'route': el desti,
 *     arrivalEnd, sintonitzada. Inici 'final' (sense ruta): l aeroport triat,
 *     el cap de l arrencada (runway), sintonitzada. Altrament: l aeroport
 *     triat, arrivalEnd, sense sintonitzar (l auto-sintonia de sempre).
 */

import { DEG, NM, wrapPi } from '../core/constants.js';
import { AIRPORTS, AIRPORT_ORDER } from './airports.js';

export function thresholdDistNm(A, en, e, n) {
  const l = A.toLocal(e, n);
  return Math.hypot(l[0] - en.thr[0], l[1] - en.thr[1]) / NM;
}

export function destinationEnd(A, ...candidates) {
  return candidates.find(en => en && A.allEnds.includes(en)) || A.allEnds[0];
}

export function arrivalEnd(A, windDir, windKt) {
  const ils = A.allEnds.filter(en => en.ils !== false);
  if (ils.length === 1) return ils[0];
  const pool = ils.length ? ils : A.allEnds, calm = !(windKt > 0);
  const score = en => calm ? en.rw.len : windKt * Math.cos((windDir - en.hdg) * DEG);
  return pool.reduce((best, en) => score(en) > score(best) + 1e-9 ? en : best);
}

export function flightApproach({ mode, start, airport, dest, runway, windDir, windKt }) {
  if (mode === 'route') { const A = AIRPORTS[dest]; return { A, en: arrivalEnd(A, windDir, windKt), tuned: true }; }
  const A = AIRPORTS[airport];
  if (start === 'final') return { A, en: A.allEnds[(runway || 0) % A.allEnds.length], tuned: true };
  return { A, en: arrivalEnd(A, windDir, windKt), tuned: false };
}

export const ILS = {
  GS: 3 * DEG, GS_S: 420, LOC_BEYOND: 300, LOC_DOT: 1.25 * DEG, GS_DOT: 0.35 * DEG, RANGE: 25 * NM,
  /** raw geometry of a position (e, n, wheel height above mean sea level) relative to one runway end */
  geom(A, en, e, n, hWheel) {
    const l = A.toLocal(e, n), dx = l[0] - en.thr[0], dy = l[1] - en.thr[1];
    const s = dx * en.dir[0] + dy * en.dir[1];              // along the landing direction, negative before the threshold
    const t = -dx * en.dir[1] + dy * en.dir[0];              // lateral, positive = LEFT of the centreline
    const dA = en.rw.len + this.LOC_BEYOND - s, dG = this.GS_S - s, hW = hWheel - A.elev;
    return { s, t, dA, dG, hW, locAng: Math.atan2(t, Math.max(dA, 1)), gsAng: Math.atan2(hW, Math.max(dG, 1)), hPath: Math.max(dG, 0) * Math.tan(this.GS), dist: Math.hypot(s, t) };
  },
  /** full receiver output for a chosen runway end */
  nav(A, en, f) {
    const o = f.out, g = this.geom(A, en, f.e, f.n, f.h - f.cfg.gear.zStatic);
    g.A = A; g.en = en; g.crs = en.hdg * DEG; g.ident = 'ILS ' + en.id; g.apt = A.icao;
    g.locValid = en.ils !== false && g.dA > 150 && g.dist < this.RANGE && Math.abs(g.locAng) < 35 * DEG;
    g.gsDev = g.gsAng - this.GS;
    g.gsValid = g.locValid && !f.wow && g.dG > 120 && g.dist < 16 * NM && Math.abs(g.locAng) < 10 * DEG && Math.abs(g.gsDev) < 6 * DEG;
    g.locDots = g.locAng / this.LOC_DOT; g.gsDots = g.gsDev / this.GS_DOT;
    g.dme = Math.hypot(g.s - (en.rw.len + this.LOC_BEYOND), g.t) / NM;     // DME co-located with the localizer
    g.distThr = Math.max(0, -g.s) / NM;
    g.hdgDiff = Math.abs(wrapPi((o.hdg - en.hdg) * DEG));
    return g;
  },
  /** auto-tune: the runway end you are lined up with (with hysteresis), or null. pref = { apt, id } */
  update(f, prev, pref) {
    let best = null, bestScore = 1e9;
    for (const id of AIRPORT_ORDER) {
      const A = AIRPORTS[id]; if (Math.hypot(f.e - A.e, f.n - A.n) > this.RANGE + 6000) continue;
      A.allEnds.forEach((en, i) => {
        if (en.ils === false) return;
        const g = this.nav(A, en, f); if (!g.locValid || g.hdgDiff > 100 * DEG) return;
        let score = Math.abs(g.locAng) * 3 + g.hdgDiff;
        if (prev && prev.apt === A.icao && prev.idx === i) score -= 0.35;               // hysteresis: keep the tuned ILS
        if (pref && pref.apt === A.icao && pref.id === en.id) score -= 0.1;                  // the runway chosen in the menu
        if (score < bestScore) { bestScore = score; best = g; best.idx = i; }
      });
    }
    return best;
  }
};
