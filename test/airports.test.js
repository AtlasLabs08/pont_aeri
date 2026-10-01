/* Proves dels aeroports de les fases 1 i 2 (F1+F2, docs/DECISIONS.md,
 * 2026-10-01): ILS per cap (H3), taxiways, plataforma i portes
 * procedimentals (H5), dificultat i pistes curtes (H7).
 *
 * Correr:  npm test
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import { AIRPORTS, AIRPORT_ORDER, AIRPORT_DEFS, AIRPORT_DATA, RUNWAY_SCALE, ILS, setRunwayDifficulty, makeAirport,
  airportPavedAt, taxiRoute, buildTaxiGraph, ll, proceduralDef } from '../src/world/index.js';
import { NM } from '../src/core/index.js';

const NEW = ['LEGE', 'LERS', 'LEIB', 'LEMH', 'LELL', 'LEDA', 'LESU'];
const LEVELS = ['easy', 'normal', 'hard'];
after(() => setRunwayDifficulty('normal'));

/** fdm minim per a ILS.nav/update a dNm del llindar, sobre l eix i la senda */
function onFinal(A, en, dNm) {
  const d = dNm * NM, p = A.toWorld(en.thr[0] - en.dir[0] * d, en.thr[1] - en.dir[1] * d);
  return { e: p[0], n: p[1], h: A.elev + (d + ILS.GS_S) * Math.tan(ILS.GS) + 1, wow: false, out: { hdg: en.hdg }, cfg: { gear: { zStatic: 1 } } };
}
const inside = (B, a, c) => a >= B[0] && a <= B[1] && c >= B[2] && c <= B[3];
/** el punt (a, c) es sobre la franja pavimentada d una pista? */
const onRunway = (A, a, c) => A.paved.some(s => s.kind === 'rwy' && (() => { const px = a - s.a1, py = c - s.c1, t = px * s.ux + py * s.uy; return t >= 0 && t <= s.L && Math.abs(-px * s.uy + py * s.ux) <= s.hw; })());

describe('AIRPORT_ORDER', () => {
  test('conte els 9 aeroports: LEBL i LEPA primer, despres les fases 1 i 2', () => {
    assert.deepEqual(AIRPORT_ORDER, ['LEBL', 'LEPA', ...NEW]);
    for (const id of AIRPORT_ORDER) assert.ok(AIRPORTS[id] && AIRPORT_DEFS[id], id);
  });

  test('els aeroports nous surten d airport-data.js: elevacio i pistes', () => {
    setRunwayDifficulty('normal');
    for (const id of NEW) {
      const A = AIRPORTS[id], D = AIRPORT_DATA[id];
      assert.equal(A.elev, D.elev);
      assert.deepEqual(A.allEnds.map(e => e.id).sort(), D.runways.flatMap(r => r.ids).sort());
      assert.ok(Math.abs(A.runways[0].len - D.runways[0].len) <= 5, `${id} llargada`);
    }
  });
});

describe('H3: ILS per cap de pista', () => {
  setRunwayDifficulty('normal');

  test('nomes els caps marcats tenen ILS als aeroports nous', () => {
    for (const id of NEW) for (const en of AIRPORTS[id].allEnds) assert.equal(en.ils, AIRPORT_DATA[id].ils.includes(en.id), `${id} ${en.id}`);
    assert.ok(AIRPORTS.LELL.allEnds.every(en => !en.ils));
    assert.ok(AIRPORTS.LESU.allEnds.every(en => !en.ils));
  });

  test('LEBL i LEPA: tots els caps amb ILS, igual que abans', () => {
    for (const id of ['LEBL', 'LEPA']) {
      assert.equal(AIRPORT_DEFS[id].ils, undefined);
      for (const en of AIRPORTS[id].allEnds) assert.equal(en.ils, true, `${id} ${en.id}`);
    }
  });

  test('ILS.update sintonitza els caps amb ILS i mai els altres, a 6 nm en final', () => {
    for (const id of AIRPORT_ORDER) for (const en of AIRPORTS[id].allEnds) {
      const A = AIRPORTS[id], g = ILS.update(onFinal(A, en, 6), null, null);
      if (en.ils) { assert.ok(g, `${id} ${en.id}: sense ILS`); assert.equal(g.apt, id); assert.equal(g.en, en); }
      else assert.ok(!g || g.en !== en, `${id} ${en.id}: no hauria de tenir ILS`);
    }
  });

  test('ILS.nav en un cap sense ILS: sense senyal', () => {
    const A = AIRPORTS.LESU, en = A.allEnds[0], g = ILS.nav(A, en, onFinal(A, en, 6));
    assert.equal(g.locValid, false);
    assert.equal(g.gsValid, false);
  });
});

describe('H5: taxiways, plataforma i portes procedimentals', () => {
  for (const lvl of LEVELS) for (const id of NEW) {
    test(`${id} (${lvl}): de cada porta a cada cap, taxiRoute troba cami per paviment`, () => {
      setRunwayDifficulty(lvl);
      const A = AIRPORTS[id];
      assert.ok(A.gates.length >= 1, 'com a minim una porta');
      for (const g of A.gates) for (const en of A.allEnds) {
        const r = taxiRoute(A, [g.a, g.c], en.thr);
        assert.ok(r, `${g.a},${g.c} -> ${en.id}: sense cami`);
        assert.deepEqual(r[r.length - 1], en.thr);
        for (let i = 0; i + 1 < r.length; i++) {
          const n = Math.max(1, Math.ceil(Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]) / 5));
          for (let k = 0; k <= n; k++) {
            const a = r[i][0] + (r[i + 1][0] - r[i][0]) * k / n, c = r[i][1] + (r[i + 1][1] - r[i][1]) * k / n;
            assert.ok(airportPavedAt(A, a, c), `${id} ${en.id}: fora del paviment a ${a.toFixed(0)},${c.toFixed(0)}`);
          }
        }
      }
    });

    test(`${id} (${lvl}): cap taxiway ni plataforma trepitja la pista fora dels connectors`, () => {
      setRunwayDifficulty(lvl);
      const A = AIRPORTS[id];
      const segs = A.paved.filter(s => (s.kind === 'twy' && !s.conn && !s.backtrack) || s.kind === 'apron');
      assert.ok(segs.length > 0);
      for (const s of segs) for (let t = 0; t <= s.L; t += 5) for (const k of [-1, -0.5, 0, 0.5, 1]) {
        const a = s.a1 + s.ux * t - s.uy * k * s.hw, c = s.c1 + s.uy * t + s.ux * k * s.hw;
        assert.ok(!onRunway(A, a, c), `${id} ${s.kind} sobre la pista a ${a.toFixed(0)},${c.toFixed(0)}`);
      }
      // els connectors si que hi entren
      const conn = A.paved.filter(s => s.conn);
      assert.ok(conn.length >= 1);
      for (const s of conn) assert.ok(onRunway(A, s.a2, s.c2), `${id}: el connector no arriba a la pista`);
    });

    test(`${id} (${lvl}): tot dins de bounds`, () => {
      setRunwayDifficulty(lvl);
      const A = AIRPORTS[id], B = A.bounds;
      for (const s of A.paved) for (const [a, c] of [[s.a1, s.c1], [s.a2, s.c2]]) for (const sg of [1, -1]) {
        assert.ok(inside(B, a - s.uy * sg * s.hw, c + s.ux * sg * s.hw), `${id} ${s.kind} fora de bounds`);
      }
      for (const g of A.gates) assert.ok(inside(B, g.a, g.c), `${id} porta fora de bounds`);
      for (const o of [...A.terminals, ...A.hangars]) for (const sa of [-1, 1]) for (const sc of [-1, 1]) assert.ok(inside(B, o.a + sa * o.la / 2, o.c + sc * o.lc / 2), `${id} edifici fora de bounds`);
      assert.ok(inside(B, A.tower.a, A.tower.c), `${id} torre fora de bounds`);
    });
  }

  test('mida petita: un sol connector, sense paral.lela; mitjana o mes: paral.lela i connectors als dos caps i al mig', () => {
    setRunwayDifficulty('normal');
    for (const id of NEW) {
      const A = AIRPORTS[id], conn = A.paved.filter(s => s.conn), R = A.runways[0];
      if (AIRPORT_DATA[id].layout === 'small') {
        assert.equal(conn.length, 1, id);
        assert.ok(!A.paved.some(s => s.kind === 'twy' && Math.abs(s.c1) > 1 && Math.abs(s.c1 - s.c2) < 1 && !s.conn && Math.abs(s.c1) < 100), `${id}: sense paral.lela`);
        const bt = A.paved.filter(s => s.backtrack);
        assert.equal(bt.length, 1, `${id}: es rodola per la pista`);
        assert.ok(onRunway(A, bt[0].a1, bt[0].c1) && onRunway(A, bt[0].a2, bt[0].c2));
        continue;
      }
      assert.equal(A.paved.filter(s => s.backtrack).length, 0, id);
      assert.equal(conn.length, 3, id);
      const as = conn.map(s => s.a1).sort((x, y) => x - y), ends = [R.p1[0], R.p2[0]].sort((x, y) => x - y);
      assert.ok(Math.abs(as[0] - ends[0]) < 1 && Math.abs(as[2] - ends[1]) < 1 && Math.abs(as[1] - (ends[0] + ends[1]) / 2) < 1, id);
    }
  });

  test('portes per mida (petit 3, mitja 6, gran 10) i costat de l ARP', () => {
    for (const id of NEW) {
      const A = AIRPORTS[id], D = AIRPORT_DATA[id];
      assert.equal(A.gates.length, D.gates, id);
      // l ARP en coordenades locals: les portes son al mateix costat de l eix
      const W = A.toLocal(...ll(D.ref[1], D.ref[0])), sg = Math.abs(W[1]) < 1 ? 1 : Math.sign(W[1]);
      for (const g of A.gates) assert.equal(Math.sign(g.c), sg, `${id}: porta a l altre costat de l ARP`);
    }
  });

  test('l ARP sobre l eix: plataforma a l esquerra del primer cap (+c)', () => {
    const D = Object.assign({}, AIRPORT_DATA.LERS);
    const r = D.runways[0];
    D.ref = [(r.le[0] + r.he[0]) / 2, (r.le[1] + r.he[1]) / 2];
    const A = makeAirport(proceduralDef(D), 1), en = A.allEnds[0], left = [-en.dir[1], en.dir[0]];
    for (const g of A.gates) assert.ok(g.a * left[0] + g.c * left[1] > 0);
  });

  test('el graf de cada aeroport nou es un sol tros connectat', () => {
    setRunwayDifficulty('normal');
    for (const id of NEW) {
      const G = buildTaxiGraph(AIRPORTS[id]), seen = new Set([0]), st = [0];
      while (st.length) for (const { to } of G.adj[st.pop()]) if (!seen.has(to)) { seen.add(to); st.push(to); }
      assert.equal(seen.size, G.nodes.length, id);
    }
  });
});

describe('H7: RUNWAY_SCALE.hard nomes a pistes de 2.000 m o mes', () => {
  const toy = len => makeAirport({ icao: 'TEST', lat: 41, lon: 2, elev: 0, axis: 90, bounds: [-5000, 5000, -500, 500],
    runways: [{ hdg: 90, len, wid: 45, a: 0, c: 0 }], taxiways: [], aprons: [] }, RUNWAY_SCALE.hard);

  test('una pista de 2.500 m s escurca a hard', () => {
    assert.equal(toy(2500).runways[0].len, 1500);
  });

  test('una d 1.267 m no', () => {
    assert.equal(toy(1267).runways[0].len, 1270);        // makeAirport arrodoneix a 10 m, com sempre
  });

  test('LESU i LELL fan igual a normal i a hard; LEDA (2.500 m) s escurca', () => {
    setRunwayDifficulty('normal');
    const n = Object.fromEntries(NEW.map(id => [id, AIRPORTS[id].runways[0].len]));
    setRunwayDifficulty('hard');
    assert.equal(AIRPORTS.LESU.runways[0].len, n.LESU);
    assert.equal(AIRPORTS.LELL.runways[0].len, n.LELL);
    assert.ok(AIRPORTS.LEDA.runways[0].len < n.LEDA);
    setRunwayDifficulty('normal');
  });
});
