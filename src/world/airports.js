/* Aeroports: definicions, pistes, carrers de rodatge, portes.
 * ORIGEN: linies 1369-1465 de l'original.
 *
 * EXPORTA: RUNWAY_SCALE makeAirport setRunwayDifficulty
 *          airportPavedAt proceduralDef AIRPORT_DEFS AIRPORTS AIRPORT_ORDER
 *
 * IMPORTA: ../core/constants.js, ./geo.js, ./airport-data.js
 *
 * NOTA: LEBL i LEPA son literals escrits a ma i no canvien. Els aeroports de
 *       les fases 1 i 2 (F1+F2, docs/DECISIONS.md, 2026-10-01) surten
 *       d airport-data.js (OurAirports) amb proceduralDef(): plataforma,
 *       terminal, torre, portes i bounds son fixos; les taxiways es generen a
 *       makeAirport() a partir de la pista ja escalada per la dificultat.
 *
 * INTERFICIE (no la canviis, ils.js, terrain.js, index.html i les proves en
 * depenen):
 *   en.ils    cada cap de pista: true si te ILS. def.ils (llista d ids) nomes
 *             als aeroports nous; sense def.ils, tots els caps en tenen (H3).
 *   en.kind   aproximacio del cap (H12): 'ILS' si en.ils, 'RNP' si no. Tots
 *             els caps en tenen una, amb la mateixa interficie (ILS.nav).
 *   def.terrain  { flatR, valley } nomes als aeroports nous (H6, H16).
 *   twy.conn  true als trams de taxiway que entren a la pista (connectors).
 *   twy.backtrack  true al tram de rodatge sobre l eix de la pista (aeroports
 *             petits: es rodola per la pista). Es a la xarxa, no es pinta.
 *   gate.tdir costat de la terminal en c (+1/-1) i gate.bridge (pasarel.la)
 *             nomes als aeroports nous; LEBL i LEPA no en tenen.
 *   A.hangars hangars dels aeroports nous: { a, c, la, lc, h }.
 */

import { DEG, wrap360 } from '../core/constants.js';
import { ll } from './geo.js';
import { AIRPORT_DATA } from './airport-data.js';

export const RUNWAY_SCALE = { easy: 1.45, normal: 1.0, hard: 0.6 };        // difficulty: very long / real / short runways
const HARD_MIN_LEN_M = 2000;                                          // H7: per sota, la dificultat no escurca la pista
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
    let len = r.len * (lenK < 1 && r.len < HARD_MIN_LEN_M ? 1 : lenK); const B = def.bounds, mrg = 160;     // H7: les pistes curtes no s escurcen
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
  if (def.layout) A.taxiways = proceduralTaxiways(def, A.runways[0]);
  for (const t of A.taxiways) for (let i = 0; i + 1 < t.pts.length; i++) {
    if (Math.hypot(t.pts[i + 1][0] - t.pts[i][0], t.pts[i + 1][1] - t.pts[i][1]) < 0.5) continue;
    const s = { a1: t.pts[i][0], c1: t.pts[i][1], a2: t.pts[i + 1][0], c2: t.pts[i + 1][1], hw: (t.w || 30) / 2, kind: 'twy' };
    if (t.conn) s.conn = true;
    if (t.backtrack) s.backtrack = true;
    A.paved.push(s);
  }
  for (const p of def.aprons) A.paved.push({ a1: p[0], c1: p[2], a2: p[1], c2: p[2], hw: p[3] / 2, kind: 'apron' });
  for (const s of A.paved) { const dx = s.a2 - s.a1, dy = s.c2 - s.c1; s.L = Math.hypot(dx, dy); s.ux = dx / s.L; s.uy = dy / s.L; }
  A.allEnds = []; A.runways.forEach(r => r.ends.forEach(en => { en.rw = r; en.ils = !def.ils || def.ils.includes(en.id); en.kind = en.ils ? 'ILS' : 'RNP'; A.allEnds.push(en); }));
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

/* ---- F2: plataforma, terminal, torre, portes i taxiways procedimentals (H5) ----
 * Tot en coordenades locals (a, c) d una pista: a al llarg de l eix, c = 0 a
 * l eix, +c a l esquerra del primer cap. sg = costat de la plataforma: on cau
 * el punt de referencia (ARP) respecte de l eix; si hi cau a sobre, +c.
 * Mides en m. parallel = separacio eix de pista - eix de la paral.lela (0: cap);
 * apronGap = de la paral.lela (o de l eix de la pista) al cantell de la
 * plataforma; spacing = entre portes; links = enllacos plataforma-paral.lela. */
const LAYOUT = {
  small:  { parallel: 0,   apronGap: 110, spacing: 60, links: 1, termH: 9,  towerH: 18, hangars: 1, bridge: false },
  medium: { parallel: 180, apronGap: 75,  spacing: 70, links: 1, termH: 14, towerH: 28, hangars: 2, bridge: true },
  large:  { parallel: 200, apronGap: 75,  spacing: 80, links: 3, termH: 18, towerH: 40, hangars: 3, bridge: true }
};
const TWY_W = 23, APRON_D = 150, TERM_LC = 40, BOUNDS_MRG = 300;

/** definicio d aeroport (el mateix format que LEBL i LEPA) a partir d una entrada d AIRPORT_DATA */
export function proceduralDef(D) {
  const P = LAYOUT[D.layout], R0 = D.runways[0];
  const mid = r => [(r.le[0] + r.he[0]) / 2, (r.le[1] + r.he[1]) / 2];
  const [lat, lon] = mid(R0), axis = R0.hdg, o = ll(lon, lat), ax = axis * DEG;
  const ua = [Math.sin(ax), Math.cos(ax)], uc = [-Math.cos(ax), Math.sin(ax)];
  const loc = (la, lo) => { const p = ll(lo, la), de = p[0] - o[0], dn = p[1] - o[1]; return [de * ua[0] + dn * ua[1], de * uc[0] + dn * uc[1]]; };
  const runways = D.runways.map(r => { const m = loc(...mid(r)); return { hdg: r.hdg, len: r.len, wid: r.wid, a: m[0], c: m[1], ids: r.ids }; });
  const ref = loc(D.ref[0], D.ref[1]), sg = Math.abs(ref[1]) < 1 ? 1 : Math.sign(ref[1]);
  const hwR = R0.wid / 2, cT = P.parallel ? Math.max(P.parallel, hwR + 7.5 + 130) : 0;
  const near = (cT || hwR) + P.apronGap, lane = near + 30, gateC = near + 95, far = near + APRON_D, termC = far + 5 + TERM_LC / 2;
  // la plataforma, centrada a l ARP, mai fora del tram de pista que queda a la dificultat mes dificil
  const lMin = R0.len >= HARD_MIN_LEN_M ? R0.len * RUNWAY_SCALE.hard : R0.len, lim = Math.max(0, lMin / 2 - 150);
  const n = D.gates, apronLen = n * P.spacing + 60, a0 = Math.max(-lim, Math.min(lim, ref[0])), a1 = a0 - apronLen / 2, a2 = a0 + apronLen / 2;
  const gates = [];
  for (let i = 0; i < n; i++) gates.push({ a: a0 - (n - 1) / 2 * P.spacing + i * P.spacing, c: sg * gateC, hdg: wrap360(axis + 90 * sg),
    size: D.layout === 'large' && i < 3 ? 'H' : 'M', tdir: sg, bridge: P.bridge });
  const hangars = [];
  for (let i = 0; i < P.hangars; i++) hangars.push({ a: a1 - 90 - i * 130, c: sg * (near + 60), la: 100, lc: 70, h: 12 + 3 * i });
  const tower = { a: a2 + 50, c: sg * (near + 60), h: P.towerH };
  const terminals = [{ a: a0, c: sg * termC, la: apronLen - 20, lc: TERM_LC, h: P.termH, name: 'Terminal' }];
  const links = P.links === 1 ? [a0] : [a1 + 40, a0, a2 - 40];
  // bounds: tot el que hi ha, mes un marge; la pista es pot allargar (facil) fins a bounds - 160
  const rects = [[-R0.len / 2 - 60, R0.len / 2 + 60, -hwR - 7.5, hwR + 7.5], [a1, a2, sg * near, sg * far], [a0 - apronLen / 2, a0 + apronLen / 2, sg * (termC - TERM_LC / 2), sg * (termC + TERM_LC / 2)],
    [tower.a - 10, tower.a + 10, tower.c - 10, tower.c + 10], ...hangars.map(h => [h.a - h.la / 2, h.a + h.la / 2, h.c - h.lc / 2, h.c + h.lc / 2])];
  const lo = k => Math.min(...rects.map(r => Math.min(r[k], r[k + 1]))), hi = k => Math.max(...rects.map(r => Math.max(r[k], r[k + 1])));
  const bounds = [lo(0) - BOUNDS_MRG, hi(0) + BOUNDS_MRG, lo(2) - BOUNDS_MRG / 2, hi(2) + BOUNDS_MRG / 2];
  return { icao: D.icao, name: D.name, city: D.city, lat, lon, elev: D.elev, axis, ref: D.ref, size: D.size, ils: D.ils, terrain: D.terrain,
    bounds, runways, taxiways: [], aprons: [[a1, a2, sg * (near + APRON_D / 2), APRON_D]], terminals, tower, gates, hangars,
    layout: { sg, cT, lane, a0, a1, a2, links } };
}

/** taxiways d un aeroport procedimental per a la pista R ja escalada (makeAirport). conn = entra a la pista */
function proceduralTaxiways(def, R) {
  const L = def.layout, sg = L.sg, w = TWY_W, pa1 = Math.min(R.p1[0], R.p2[0]), pa2 = Math.max(R.p1[0], R.p2[0]), rc = (R.p1[1] + R.p2[1]) / 2;
  const t = [{ pts: [[L.a1 + 20, sg * L.lane], [L.a2 - 20, sg * L.lane]], w }];            // carrer de la plataforma, davant de les portes
  if (!L.cT) {
    // mida petita: un connector de la plataforma a la pista; es rodola per la pista fins als caps
    // (backtrack: el tram de pista forma part de la xarxa de rodatge, pero no es pinta)
    t.push({ pts: [[L.a0, sg * L.lane], [L.a0, rc]], w, conn: true });
    t.push({ pts: [[pa1, rc], [pa2, rc]], w, backtrack: true });
    return t;
  }
  // mitjana o mes: paral.lela, connectors als dos caps i al mig, i els enllacos de la plataforma
  const xs = [pa1, pa2, ...L.links];
  t.push({ pts: [[Math.min(...xs), sg * L.cT], [Math.max(...xs), sg * L.cT]], w });
  for (const a of [pa1, (pa1 + pa2) / 2, pa2]) t.push({ pts: [[a, sg * L.cT], [a, rc]], w, conn: true });
  for (const a of L.links) t.push({ pts: [[a, sg * L.lane], [a, sg * L.cT]], w });
  return t;
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
  }),
  ...Object.fromEntries(Object.keys(AIRPORT_DATA).map(id => [id, proceduralDef(AIRPORT_DATA[id])]))
};
export const AIRPORT_ORDER = ['LEBL', 'LEPA', ...Object.keys(AIRPORT_DATA)];
export const AIRPORTS = {};
/** (re)build both airports for a difficulty level. Scenery is rebuilt by AirportScenery.rebuild(). */
export function setRunwayDifficulty(level) { for (const id of AIRPORT_ORDER) { const old = AIRPORTS[id]; AIRPORTS[id] = makeAirport(AIRPORT_DEFS[id], RUNWAY_SCALE[level] || 1); AIRPORTS[id].oldGroup = old && old.group; } }
setRunwayDifficulty('normal');
