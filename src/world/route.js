/* Ruta d arribada del vol cronometrat de Free Flight: punts d aproximacio,
 * altituds minimes, trams volables i tria de la pista d arribada (H16,
 * docs/DECISIONS.md, 2026-10-01). Funcions pures: el terreny entra com a
 * funcio groundAt(e, n) (per defecte World.groundAt).
 *
 * EXPORTA: IF_NM LEG_CLEAR_FT LEG_SIDE_NM GS_CLEAR_FT NEAR_THR_TOL_M
 *          approachFix legFlyable legMeaFt nearThresholdM glidePathMargin planRoute planArrival
 *
 * IMPORTA: ../core/constants.js, ./ils.js, ./terrain.js
 *
 * INTERFICIE (no la canviis, index.html i test/route.test.js en depenen):
 *   approachFix(A, en, nm, prefix) -> { e, n, a, c, name, h, minFt }   punt a
 *     nm milles abans del llindar d en, sobre l eix allargat: h = alcada de la
 *     senda del cap (glideAngle, allargada) en m MSL, minFt = altitud minima de pas en
 *     ft (h arrodonida cap amunt a 100 ft), name = prefix + designacio.
 *   legFlyable(p0, h0, p1, h1, groundAt) -> { ok, marginFt }   un tram es
 *     volable si la recta de l altitud h0 a p0 fins a h1 a p1 queda com a minim
 *     LEG_CLEAR_FT per sobre del terreny, LEG_SIDE_NM a cada costat inclosos.
 *   legMeaFt(p0, p1, groundAt) -> ft   H17a: altitud minima del tram (MEA):
 *     el punt mes alt del terreny a LEG_SIDE_NM a cada costat del tram, mes
 *     LEG_CLEAR_FT, arrodonit cap amunt a 100 ft.
 *   nearThresholdM(en) -> m   tram del llindar on la senda del cap es a menys
 *     de GS_CLEAR_FT sobre la pista: GS_CLEAR_FT / tan(glideAngle) des de
 *     l origen de la senda (ILS.GS_S m enlla del llindar), es a dir
 *     GS_CLEAR_FT / tan(angle) - ILS.GS_S des del llindar (1.325 m a 3 graus,
 *     1.032 m a 3,6).
 *   glidePathMargin(A, en, sMax, groundAt) -> { marginM, s }   comprovacio de
 *     la senda del cap (H6 del #31 sobre el terreny real, TA-9): des del
 *     llindar fins a sMax m, cada 25 m i a 0 i +-150 m de l eix. Fins a
 *     nearThresholdM(en), el terreny pot quedar fins a NEAR_THR_TOL_M per
 *     sobre de l elevacio de l aeroport (decisio del projecte: el model de
 *     superficie hi te arbres i edificis); a partir d alla, GS_CLEAR_FT per
 *     sota de la senda (glideAngle). Sense forat entre les dues regles.
 *     marginM < 0: no es compleix, al punt s. Un cap que no la compleix fins
 *     a 10 nm + 500 m queda sense aproximacio directa (APPROACH_DATA,
 *     airports.js).
 *   planRoute(origin, cruiseFt, A, en, groundAt, ceilingFt) -> { fixes, usesIF,
 *     flyable, meaFt, cruiseFt, tooHigh }   origin = { e, n } (final de la
 *     pista de sortida). El primer tram (origen -> FF, o origen -> IF) es vola a
 *     max(creuer de la taula, MEA) i mai per sota de la MEA (H17a): queda
 *     LEG_CLEAR_FT per sobre del terreny per construccio, i s arriba al punt a
 *     max(altitud minima del punt, MEA). Directa si s hi arriba al FF a la seva
 *     altitud minima (MEA <= minima del FF); si no, per l IF si el tram IF -> FF
 *     (H16, des de l altitud d arribada a l IF fins a la del FF) es volable. Un
 *     tram amb la MEA per sobre del sostre de l avio (ceilingFt) no es pot fer
 *     (tooHigh). fixes = [FF] o [IF, FF]; meaFt i cruiseFt = max(creuer, MEA)
 *     del primer tram de la ruta triada.
 *   planArrival({ origin, cruiseFt, ceilingFt, A, windDir, windKt, groundAt })
 *     -> { en, fixes, usesIF, flyable, meaFt, cruiseFt, fallback, rejected,
 *     tailwindKt }   la pista d arribada d H11 (arrivalEnd, que ja aparta els
 *     caps amb mes de MAX_TAILWIND_KT de vent de cua si n hi ha d altres); si
 *     no te cap ruta volable, la descarta i torna a aplicar la mateixa regla
 *     als caps que queden. Si cap cap no ho es: fallback = true i el cap de mes
 *     vent de cara (sense vent, la pista mes llarga), sense els caps sense
 *     aproximacio directa (en.direct === false) si n hi ha d altres. rejected = ids dels caps
 *     descartats, per ordre; tailwindKt = vent de cua del cap triat.
 */

import { DEG, NM } from '../core/constants.js';
import { ILS, arrivalEnd, tailwindKt, glideAngle } from './ils.js';
import { World } from './terrain.js';

export const IF_NM = 20;
export const GS_CLEAR_FT = 300, NEAR_THR_TOL_M = 20;
export const LEG_CLEAR_FT = 1000;
export const LEG_SIDE_NM = 1;
const FT = 0.3048, STEP_M = 200, MEA_STEP_M = 100, MEA_SIDE_N = 16;    // MEA: cada 100 m al llarg del tram, 33 punts de costat a costat

export function approachFix(A, en, nm, prefix) {
  const d = nm * NM, a = en.thr[0] - en.dir[0] * d, c = en.thr[1] - en.dir[1] * d, w = A.toWorld(a, c);
  const h = A.elev + (d + ILS.GS_S) * Math.tan(glideAngle(en));
  return { e: w[0], n: w[1], a, c, name: prefix + en.id, h, minFt: Math.ceil(h / FT / 100) * 100 };
}

const ground = groundAt => groundAt || ((e, n) => World.groundAt(e, n));

export function legFlyable(p0, h0, p1, h1, groundAt) {
  const g = ground(groundAt), L = Math.hypot(p1.e - p0.e, p1.n - p0.n), ux = L ? (p1.e - p0.e) / L : 0, uy = L ? (p1.n - p0.n) / L : 0, side = LEG_SIDE_NM * NM;
  let worst = Infinity;
  for (let i = 0, k = Math.max(1, Math.ceil(L / STEP_M)); i <= k; i++) {
    const s = L * i / k, h = h0 + (h1 - h0) * i / k;
    for (let j = -4; j <= 4; j++) { const t = side * j / 4, m = h - g(p0.e + ux * s - uy * t, p0.n + uy * s + ux * t); if (m < worst) worst = m; }
  }
  return { ok: worst >= LEG_CLEAR_FT * FT, marginFt: worst / FT };
}

export function legMeaFt(p0, p1, groundAt) {
  const g = ground(groundAt), L = Math.hypot(p1.e - p0.e, p1.n - p0.n), ux = L ? (p1.e - p0.e) / L : 0, uy = L ? (p1.n - p0.n) / L : 0, side = LEG_SIDE_NM * NM;
  let top = -Infinity;
  for (let i = 0, k = Math.max(1, Math.ceil(L / MEA_STEP_M)); i <= k; i++) {
    const s = L * i / k;
    for (let j = -MEA_SIDE_N; j <= MEA_SIDE_N; j++) { const t = side * j / MEA_SIDE_N, h = g(p0.e + ux * s - uy * t, p0.n + uy * s + ux * t); if (h > top) top = h; }
  }
  return Math.ceil((top / FT + LEG_CLEAR_FT) / 100) * 100;
}

export function nearThresholdM(en) { return GS_CLEAR_FT * FT / Math.tan(glideAngle(en)) - ILS.GS_S; }

export function glidePathMargin(A, en, sMax, groundAt) {
  const g = ground(groundAt), E = A.elev, tg = Math.tan(glideAngle(en)), near = nearThresholdM(en);
  let marginM = Infinity, at = 0;
  for (let s = 0; s <= sMax; s += 25) {
    const lim = s <= near ? E + NEAR_THR_TOL_M : E + (s + ILS.GS_S) * tg - GS_CLEAR_FT * FT;
    for (const t of [-150, 0, 150]) {
      const w = A.toWorld(en.thr[0] - en.dir[0] * s - en.dir[1] * t, en.thr[1] - en.dir[1] * s + en.dir[0] * t), m = lim - g(w[0], w[1]);
      if (m < marginM) { marginM = m; at = s; }
    }
  }
  return { marginM, s: at };
}

export function planRoute(origin, cruiseFt, A, en, groundAt, ceilingFt = Infinity) {
  const FF = approachFix(A, en, 10, 'FF'), IF = approachFix(A, en, IF_NM, 'IF');
  const meaFF = legMeaFt(origin, FF, groundAt);
  if (meaFF <= FF.minFt && meaFF <= ceilingFt) return { fixes: [FF], usesIF: false, flyable: true, meaFt: meaFF, cruiseFt: Math.max(cruiseFt, meaFF), tooHigh: false };
  const meaIF = legMeaFt(origin, IF, groundAt), hIF = Math.max(IF.h, meaIF * FT);
  const tooHigh = meaIF > ceilingFt && meaFF > ceilingFt;
  if (meaIF <= ceilingFt && legFlyable(IF, hIF, FF, FF.h, groundAt).ok) return { fixes: [IF, FF], usesIF: true, flyable: true, meaFt: meaIF, cruiseFt: Math.max(cruiseFt, meaIF), tooHigh: false };
  return { fixes: [FF], usesIF: false, flyable: false, meaFt: meaFF, cruiseFt: Math.max(cruiseFt, meaFF), tooHigh };
}

export function planArrival({ origin, cruiseFt, ceilingFt = Infinity, A, windDir, windKt, groundAt }) {
  const rejected = [], done = (en, r, fallback) => ({ en, ...r, fallback, rejected, tailwindKt: tailwindKt(en, windDir, windKt) });
  let left = A.allEnds.slice();
  while (left.length) {
    const en = arrivalEnd({ allEnds: left }, windDir, windKt), r = planRoute(origin, cruiseFt, A, en, groundAt, ceilingFt);
    if (r.flyable) return done(en, r, false);
    rejected.push(en.id); left = left.filter(x => x !== en);
  }
  // cap no es volable: el de mes vent de cara (sense vent, la pista mes llarga), sense mirar l ILS
  const calm = !(windKt > 0), score = en => calm ? en.rw.len : windKt * Math.cos((windDir - en.hdg) * DEG);
  const direct = A.allEnds.filter(x => x.direct !== false), pool = direct.length ? direct : A.allEnds;
  const en = pool.reduce((best, x) => score(x) > score(best) + 1e-9 ? x : best);
  return done(en, planRoute(origin, cruiseFt, A, en, groundAt, ceilingFt), true);
}
