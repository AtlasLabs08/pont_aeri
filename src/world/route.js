/* Ruta d arribada del vol cronometrat de Free Flight: punts d aproximacio,
 * altituds minimes, trams volables i tria de la pista d arribada (H16,
 * docs/DECISIONS.md, 2026-10-01). Funcions pures: el terreny entra com a
 * funcio groundAt(e, n) (per defecte World.groundAt).
 *
 * EXPORTA: IF_NM LEG_CLEAR_FT LEG_SIDE_NM approachFix legFlyable planRoute planArrival
 *
 * IMPORTA: ../core/constants.js, ./ils.js, ./terrain.js
 *
 * INTERFICIE (no la canviis, index.html i test/route.test.js en depenen):
 *   approachFix(A, en, nm, prefix) -> { e, n, a, c, name, h, minFt }   punt a
 *     nm milles abans del llindar d en, sobre l eix allargat: h = alcada de la
 *     senda de 3 graus (allargada) en m MSL, minFt = altitud minima de pas en
 *     ft (h arrodonida cap amunt a 100 ft), name = prefix + designacio.
 *   legFlyable(p0, h0, p1, h1, groundAt) -> { ok, marginFt }   un tram es
 *     volable si la recta de l altitud h0 a p0 fins a h1 a p1 queda com a minim
 *     LEG_CLEAR_FT per sobre del terreny, LEG_SIDE_NM a cada costat inclosos.
 *   planRoute(origin, cruiseM, A, en, groundAt) -> { fixes, usesIF, flyable }
 *     origin = { e, n } (final de la pista de sortida). Directa si origen -> FF
 *     es volable; si no, per l IF (IF_NM) si origen -> IF i IF -> FF ho son.
 *     fixes = [FF] o [IF, FF] (la ruta que es vola; si cap no ho es, [FF]).
 *   planArrival({ origin, cruiseM, A, windDir, windKt, groundAt }) -> { en,
 *     fixes, usesIF, flyable, fallback, rejected }   la pista d arribada d H11
 *     (arrivalEnd); si cap de les dues rutes no es volable, la descarta i
 *     torna a aplicar la mateixa regla als caps que queden. Si cap cap no ho
 *     es: fallback = true i el cap de mes vent de cara (sense vent, la pista
 *     mes llarga). rejected = ids dels caps descartats, per ordre.
 */

import { DEG, NM } from '../core/constants.js';
import { ILS, arrivalEnd } from './ils.js';
import { World } from './terrain.js';

export const IF_NM = 20;
export const LEG_CLEAR_FT = 1000;
export const LEG_SIDE_NM = 1;
const FT = 0.3048, STEP_M = 200;

export function approachFix(A, en, nm, prefix) {
  const d = nm * NM, a = en.thr[0] - en.dir[0] * d, c = en.thr[1] - en.dir[1] * d, w = A.toWorld(a, c);
  const h = A.elev + (d + ILS.GS_S) * Math.tan(ILS.GS);
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

export function planRoute(origin, cruiseM, A, en, groundAt) {
  const FF = approachFix(A, en, 10, 'FF'), IF = approachFix(A, en, IF_NM, 'IF');
  if (legFlyable(origin, cruiseM, FF, FF.h, groundAt).ok) return { fixes: [FF], usesIF: false, flyable: true };
  const ok = legFlyable(origin, cruiseM, IF, IF.h, groundAt).ok && legFlyable(IF, IF.h, FF, FF.h, groundAt).ok;
  return ok ? { fixes: [IF, FF], usesIF: true, flyable: true } : { fixes: [FF], usesIF: false, flyable: false };
}

export function planArrival({ origin, cruiseM, A, windDir, windKt, groundAt }) {
  const rejected = [];
  let left = A.allEnds.slice();
  while (left.length) {
    const en = arrivalEnd({ allEnds: left }, windDir, windKt), r = planRoute(origin, cruiseM, A, en, groundAt);
    if (r.flyable) return { en, ...r, fallback: false, rejected };
    rejected.push(en.id); left = left.filter(x => x !== en);
  }
  // cap no es volable: el de mes vent de cara (sense vent, la pista mes llarga), sense mirar l ILS
  const calm = !(windKt > 0), score = en => calm ? en.rw.len : windKt * Math.cos((windDir - en.hdg) * DEG);
  const en = A.allEnds.reduce((best, x) => score(x) > score(best) + 1e-9 ? x : best);
  return { en, ...planRoute(origin, cruiseM, A, en, groundAt), fallback: true, rejected };
}
