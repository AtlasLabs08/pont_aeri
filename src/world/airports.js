/* Aeroports: definicions, pistes, carrers de rodatge, portes.
 * ORIGEN: linies 1369-1465 de l'original.
 *
 * EXPORTA: RUNWAY_SCALE makeAirport setRunwayDifficulty airportPavedAt
 *          AIRPORT_DEFS AIRPORTS AIRPORT_ORDER
 *
 * IMPORTA: ../core/constants.js, ./geo.js
 *
 * NOTA: AIRPORT_DEFS son literals escrits a ma. Aquest es el fitxer que ha
 *       de llegir de data/airports/*.json quan facis el pipeline; makeAirport()
 *       es queda igual i nomes canvia d on venen les dades.
 */

import { DEG, wrap360 } from '../core/constants.js';
import { ll } from './geo.js';
export function makeAirport(def, lenK) {
  const A = Object.assign({}, def); lenK = def.photo ? 1 : (lenK || 1); A.def = def; A.apronPolys = def.apronPolys || [];
  const o = ll(def.lon, def.lat); A.e = o[0]; A.n = o[1];
  const ax = def.axis * DEG; A.ua = [Math.sin(ax), Math.cos(ax)]; A.uc = [-Math.cos(ax), Math.sin(ax)];
  A.toWorld = (a, c) => [A.e + A.ua[0] * a + A.uc[0] * c, A.n + A.ua[1] * a + A.uc[1] * c];
  A.toLocal = (e, n) => { const de = e - A.e, dn = n - A.n; return [de * A.ua[0] + dn * A.ua[1], de * A.uc[0] + dn * A.uc[1]]; };
  A.paved = [];            // segments {a1,c1,a2,c2,hw(half width),kind}
  A.runways = def.runways.map(r => {
    const rel = (r.hdg - def.axis) * DEG, d = [Math.cos(rel), -Math.sin(rel)];      // runway direction in (a,c); +rel = clockwise = toward -c
    // difficulty scales the runway about its centre; it may never leave the flattened airport rectangle
    let len = r.len * lenK; const B = def.bounds, mrg = 160;
    const lim = (o, dd, lo, hi) => Math.abs(dd) < 1e-6 ? 1e9 : Math.min((hi - mrg - o) / Math.abs(dd), (o - lo - mrg) / Math.abs(dd));
    len = Math.round(Math.min(len, 2 * lim(r.a, d[0], B[0], B[1]), 2 * lim(r.c, d[1], B[2], B[3])) / 10) * 10;
    const h = len / 2, p1 = [r.a - d[0] * h, r.c - d[1] * h], p2 = [r.a + d[0] * h, r.c + d[1] * h];
    const num = hd => { let k = Math.round(hd / 10) % 36; if (k === 0) k = 36; return (k < 10 ? '0' : '') + k; };
    const R = { len, wid: r.wid, hdg: r.hdg, p1, p2, dir: d,
      ends: [ { id: r.ids ? r.ids[0] : num(r.hdg) + (r.sfx ? r.sfx[0] : ''), hdg: r.hdg, thr: p1, dir: d },
              { id: r.ids ? r.ids[1] : num(wrap360(r.hdg + 180)) + (r.sfx ? r.sfx[1] : ''), hdg: wrap360(r.hdg + 180), thr: p2, dir: [-d[0], -d[1]] } ] };
    A.paved.push({ a1: p1[0] - d[0] * 60, c1: p1[1] - d[1] * 60, a2: p2[0] + d[0] * 60, c2: p2[1] + d[1] * 60, hw: r.wid / 2 + 7.5, kind: 'rwy', rw: R });
    return R;
  });
  for (const t of def.taxiways) for (let i = 0; i + 1 < t.pts.length; i++) {
    if (Math.hypot(t.pts[i + 1][0] - t.pts[i][0], t.pts[i + 1][1] - t.pts[i][1]) < 0.5) continue;
    A.paved.push({ a1: t.pts[i][0], c1: t.pts[i][1], a2: t.pts[i + 1][0], c2: t.pts[i + 1][1], hw: (t.w || 30) / 2, kind: 'twy' });
  }
  for (const p of def.aprons) A.paved.push({ a1: p[0], c1: p[2], a2: p[1], c2: p[2], hw: p[3] / 2, kind: 'apron' });
  for (const s of A.paved) { const dx = s.a2 - s.a1, dy = s.c2 - s.c1; s.L = Math.hypot(dx, dy); s.ux = dx / s.L; s.uy = dy / s.L; }
  A.allEnds = []; A.runways.forEach(r => r.ends.forEach(en => { en.rw = r; A.allEnds.push(en); }));
  return A;
}
/** is the local point (a,c) on pavement? returns the segment (or apron polygon) or null */
export function airportPavedAt(A, a, c) {
  for (const s of A.paved) {
    const px = a - s.a1, py = c - s.c1, t = px * s.ux + py * s.uy;
    if (t < 0 || t > s.L) continue;
    if (Math.abs(-px * s.uy + py * s.ux) <= s.hw) return s;
  }
  for (const P of A.apronPolys) { let inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const ai = P[i][0], ci = P[i][1], aj = P[j][0], cj = P[j][1]; if ((ci > c) !== (cj > c) && a < (aj - ai) * (c - ci) / (cj - ci) + ai) inside = !inside; }
    if (inside) return P; }
  return null;
}

export const AIRPORT_DEFS = {
  LEBL: ({
    icao: 'LEBL', name: 'Barcelona', city: 'Barcelona', lat: 41.2971, lon: 2.0785, elev: 4, axis: 66,
    bounds: [-2750, 3150, -1050, 1750],                 // a-min, a-max, c-min, c-max : flattened, forced-land rectangle
    runways: [
      { hdg: 66, len: 3350, wid: 60, a: 0, c: 750, sfx: ['L', 'R'] },
      { hdg: 66, len: 2660, wid: 60, a: 700, c: -750, sfx: ['R', 'L'] },
      { hdg: 17, len: 2530, wid: 45, a: 1500 - 315 * 0.656, c: 750 - 315 * 0.755, sfx: null }
    ],
    taxiways: [
      { pts: [[-1675, 560], [1675, 560]] }, { pts: [[-630, -560], [2030, -560]] }, { pts: [[-1675, 940], [900, 940]] },
      { pts: [[-1645, 560], [-1645, 750]] }, { pts: [[-900, 560], [-900, 750]] }, { pts: [[-200, 560], [-200, 750]] }, { pts: [[500, 560], [500, 750]] }, { pts: [[1645, 560], [1645, 750]] },
      { pts: [[-1645, 750], [-1645, 940]] }, { pts: [[-800, 750], [-800, 940]] }, { pts: [[0, 750], [0, 940]] }, { pts: [[900, 750], [900, 940]] },
      { pts: [[-600, -560], [-600, -750]] }, { pts: [[200, -560], [200, -750]] }, { pts: [[1100, -560], [1100, -750]] }, { pts: [[2000, -560], [2000, -750]] },
      { pts: [[-1050, 560], [-1050, -560]] }, { pts: [[-1050, -560], [-630, -560]] }, { pts: [[330, 560], [330, -560]] },
      { pts: [[464, -443], [464, -560]] }
    ],
    aprons: [[-950, 250, 300, 490], [-950, 250, -300, 490], [-1500, -100, 1035, 170]],   // a1, a2, c-centre, width
    terminals: [ { a: -350, c: 0, la: 1000, lc: 110, h: 24, name: 'T1' }, { a: -350, c: 150, la: 90, lc: 200, h: 16 }, { a: -350, c: -150, la: 90, lc: 200, h: 16 },
                 { a: -800, c: 1175, la: 1300, lc: 70, h: 18, name: 'T2' } ],
    tower: { a: 290, c: 0, h: 62 },
    gates: (() => { const g = []; for (let i = 0; i < 7; i++) { if (i === 5) continue; g.push({ a: -800 + i * 110, c: 105, hdg: 66 - 90, size: i < 3 ? 'H' : 'M' }); g.push({ a: -800 + i * 110, c: -105, hdg: 66 + 90, size: i < 3 ? 'H' : 'M' }); }
      for (let i = 0; i < 9; i++) g.push({ a: -1400 + i * 100, c: 1085, hdg: 66 + 90, size: 'M' }); return g; })()
  }),
  LEPA: ({
    icao: 'LEPA', name: 'Palma de Mallorca', city: 'Palma', lat: 39.5517, lon: 2.7388, elev: 7, axis: 58,
    bounds: [-2600, 3800, -1350, 1350],
    runways: [
      { hdg: 58, len: 3270, wid: 45, a: 0, c: 850, sfx: ['L', 'R'] },
      { hdg: 58, len: 3000, wid: 45, a: 1300, c: -850, sfx: ['R', 'L'] }
    ],
    taxiways: [
      { pts: [[-1635, 660], [1635, 660]] }, { pts: [[-200, -660], [2800, -660]] },
      { pts: [[-1605, 660], [-1605, 850]] }, { pts: [[-700, 660], [-700, 850]] }, { pts: [[300, 660], [300, 850]] }, { pts: [[1605, 660], [1605, 850]] },
      { pts: [[-170, -660], [-170, -850]] }, { pts: [[800, -660], [800, -850]] }, { pts: [[1800, -660], [1800, -850]] }, { pts: [[2770, -660], [2770, -850]] },
      { pts: [[-1000, 660], [-1000, -660]] }, { pts: [[-1000, -660], [-200, -660]] }, { pts: [[560, 660], [560, -660]] }
    ],
    aprons: [[-900, 450, 350, 590], [-900, 450, -350, 590]],
    terminals: [ { a: -250, c: 0, la: 1000, lc: 120, h: 26, name: 'Terminal' }, { a: -600, c: 200, la: 80, lc: 280, h: 15 }, { a: 50, c: 200, la: 80, lc: 280, h: 15 },
                 { a: -600, c: -200, la: 80, lc: 280, h: 15 }, { a: 50, c: -200, la: 80, lc: 280, h: 15 } ],
    tower: { a: 420, c: 0, h: 58 },
    gates: (() => { const g = []; for (const s of [1, -1]) for (const a of [-780, -420, -300, -180, 230, 340]) g.push({ a, c: s * 130, hdg: 58 - s * 90, size: (a === -780 || a === 340) ? 'H' : 'M' }); return g; })()
  })
};
export const AIRPORT_ORDER = ['LEBL', 'LEPA'];
export const RUNWAY_SCALE = { easy: 1.45, normal: 1.0, hard: 0.6 };        // difficulty: very long / real / short runways
export const AIRPORTS = {};
/** (re)build both airports for a difficulty level. Scenery is rebuilt by AirportScenery.rebuild(). */
export function setRunwayDifficulty(level) { for (const id of AIRPORT_ORDER) { const old = AIRPORTS[id]; AIRPORTS[id] = makeAirport(AIRPORT_DEFS[id], RUNWAY_SCALE[level] || 1); AIRPORTS[id].oldGroup = old && old.group; } }
setRunwayDifficulty('normal');
