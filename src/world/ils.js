/* ILS: localitzador i senda de planeig de 3 graus per a cada cap de pista.
 * ORIGEN: linies 1639-1685 de l'original (SECTION 8b).
 *
 * EXPORTA: ILS
 *
 * IMPORTA: ../core/constants.js, ./airports.js
 *
 * NOTA D ARQUITECTURA: ILS.nav() i ILS.geom() nomes necessiten constants, pero
 * ILS.update() (l auto-sintonitzacio) necessita la llista d aeroports. Com que
 * el harness fa servir nav(), core/harness.js acaba important d aqui. No es un
 * cicle, pero es una capa invertida. Apuntat a BACKLOG.md: separar la geometria
 * pura de l auto-sintonitzacio. NO ho facis durant la migracio.
 */

import { DEG, NM, wrapPi } from '../core/constants.js';
import { AIRPORTS, AIRPORT_ORDER } from './airports.js';
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
    g.locValid = g.dA > 150 && g.dist < this.RANGE && Math.abs(g.locAng) < 35 * DEG;
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
