/* Proves de world/route.js: punt intermedi, altituds minimes i caps no
 * volables del vol cronometrat de Free Flight (H16, docs/DECISIONS.md,
 * 2026-10-01).
 *
 * Correr:  npm test
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { AIRPORTS, World, ILS, setRunwayDifficulty, makeAirport, approachFix, legFlyable, planRoute, planArrival,
  IF_NM, LEG_CLEAR_FT, LEG_SIDE_NM, thresholdDistNm } from '../src/world/index.js';
import { NM } from '../src/core/index.js';

const FT = 0.3048;
before(() => { setRunwayDifficulty('normal'); World.build(); });

/** final de la pista de sortida 0 (com la ruta del ND a index.html) */
const originOf = A => { const en = A.allEnds[0], p = A.toWorld(en.thr[0] + en.dir[0] * en.rw.len, en.thr[1] + en.dir[1] * en.rw.len); return { e: p[0], n: p[1] }; };
const JET = 15000 * FT, TP = 11000 * FT;     // creuer de LEBL-LESU (128 km) a la taula d index.html: jet i turbohelix

describe('approachFix', () => {
  test('FF a 10 nm i IF a 20 nm sobre l eix, a l alcada de la senda allargada; altitud minima arrodonida cap amunt a 100 ft', () => {
    for (const id of ['LESU', 'LERS', 'LEBL']) for (const en of AIRPORTS[id].allEnds) {
      const A = AIRPORTS[id];
      for (const [nm, p] of [[10, 'FF'], [IF_NM, 'IF']]) {
        const F = approachFix(A, en, nm, p);
        assert.equal(F.name, p + en.id);
        assert.ok(Math.abs(thresholdDistNm(A, en, F.e, F.n) - nm) < 1e-9);
        assert.ok(Math.abs(F.h - (A.elev + (nm * NM + ILS.GS_S) * Math.tan(ILS.GS))) < 1e-9);
        assert.equal(F.minFt % 100, 0); assert.ok(F.minFt >= F.h / FT && F.minFt < F.h / FT + 100);
      }
    }
    assert.equal(approachFix(AIRPORTS.LESU, AIRPORTS.LESU.allEnds[1], IF_NM, 'IF').minFt, 9100);
  });
});

describe('legFlyable', () => {
  const p0 = { e: 0, n: 0 }, p1 = { e: 30000, n: 0 };
  test('1.000 ft per sobre del terreny, 1 nm a cada costat inclos', () => {
    assert.equal(LEG_CLEAR_FT, 1000); assert.equal(LEG_SIDE_NM, 1);
    assert.equal(legFlyable(p0, 1000, p1, 1000, () => 1000 - 1001 * FT).ok, true);
    assert.equal(legFlyable(p0, 1000, p1, 1000, () => 1000 - 990 * FT).ok, false);
    // un turo a 1 nm del costat compta; a 1,2 nm no
    const hill = d => (e, n) => Math.abs(n - d) < 100 && Math.abs(e - 15000) < 100 ? 900 : 0;
    assert.equal(legFlyable(p0, 1000, p1, 1000, hill(NM)).ok, false);
    assert.equal(legFlyable(p0, 1000, p1, 1000, hill(1.2 * NM)).ok, true);
  });
  test('la recta va de l altitud del punt anterior a la del seguent', () => {
    const slope = (e) => e < 15000 ? 0 : 800;          // terreny de 800 m a la segona meitat
    assert.equal(legFlyable(p0, 3000, p1, 1000, slope).ok, false);   // al final, 1000 m: 200 m de marge
    assert.equal(legFlyable(p0, 1000, p1, 3000, slope).ok, true);    // a la meitat, 2000 m
  });
});

describe('planArrival i planRoute (H16)', () => {
  test('Prat -> La Seu amb vent del sud-oest: la 21 no es volable; es descarta i la 03 fa servir l IF, amb trams volables', () => {
    for (const cruiseM of [JET, TP]) {
      const r = planArrival({ origin: originOf(AIRPORTS.LEBL), cruiseM, A: AIRPORTS.LESU, windDir: 210, windKt: 12 });
      assert.deepEqual(r.rejected, ['21']);
      assert.equal(r.en.id, '03'); assert.equal(r.usesIF, true); assert.equal(r.flyable, true); assert.equal(r.fallback, false);
      assert.deepEqual(r.fixes.map(f => f.name), ['IF03', 'FF03']);
      const [IF, FF] = r.fixes;
      assert.ok(legFlyable(originOf(AIRPORTS.LEBL), cruiseM, IF, IF.h).ok && legFlyable(IF, IF.h, FF, FF.h).ok);
      // la 21: ni directa ni per l IF
      const r21 = planRoute(originOf(AIRPORTS.LEBL), cruiseM, AIRPORTS.LESU, AIRPORTS.LESU.allEnds[1]);
      assert.equal(r21.flyable, false);
    }
  });

  test('Prat -> La Seu sense vent: la 03 (pista mes llarga, empat: la primera), per l IF', () => {
    const r = planArrival({ origin: originOf(AIRPORTS.LEBL), cruiseM: TP, A: AIRPORTS.LESU, windDir: 250, windKt: 0 });
    assert.equal(r.en.id, '03'); assert.equal(r.usesIF, true); assert.deepEqual(r.rejected, []);
  });

  test('Prat -> Reus continua sense IF: LERS 25, directa', () => {
    for (const cruiseM of [8000 * FT, 6000 * FT]) {
      const r = planArrival({ origin: originOf(AIRPORTS.LEBL), cruiseM, A: AIRPORTS.LERS, windDir: 250, windKt: 0 });
      assert.equal(r.en.id, '25'); assert.equal(r.usesIF, false); assert.equal(r.flyable, true);
      assert.deepEqual(r.fixes.map(f => f.name), ['FF25']);
    }
  });

  test('cas sintetic sense cap cap volable: el de mes vent de cara, marcat fallback', () => {
    const A = makeAirport({ icao: 'TEST', lat: 41, lon: 2, elev: 0, axis: 90, bounds: [-5000, 5000, -3000, 3000], ils: ['09'],
      runways: [{ hdg: 90, len: 3000, wid: 45, a: 0, c: 0 }, { hdg: 0, len: 2500, wid: 45, a: 0, c: 1500 }], taxiways: [], aprons: [] });
    const wall = () => 1e5, origin = { e: A.e - 100000, n: A.n };
    const r = planArrival({ origin, cruiseM: 3000, A, windDir: 350, windKt: 15, groundAt: wall });
    assert.equal(r.fallback, true); assert.equal(r.flyable, false);
    assert.equal(r.en.id, '36', 'mes vent de cara, encara que el 09 tingui ILS');
    assert.deepEqual([...r.rejected].sort(), A.allEnds.map(e => e.id).sort());
    const calm = planArrival({ origin, cruiseM: 3000, A, windDir: 0, windKt: 0, groundAt: wall });
    assert.equal(calm.fallback, true); assert.equal(calm.en.id, '09', 'sense vent: la pista mes llarga');
  });

  test('si el primer cap no es volable es tria el seguent amb la mateixa regla (H11)', () => {
    const A = makeAirport({ icao: 'TEST', lat: 41, lon: 2, elev: 0, axis: 90, bounds: [-5000, 5000, -3000, 3000],
      runways: [{ hdg: 90, len: 3000, wid: 45, a: 0, c: 0 }], taxiways: [], aprons: [] });
    // muntanya a l est: el 27 (s hi arriba des de l est) no es volable; el 09 si
    const g = (e, n) => e > A.e + 15000 ? 1e5 : 0, origin = { e: A.e - 60000, n: A.n };
    const r = planArrival({ origin, cruiseM: 3000, A, windDir: 270, windKt: 20, groundAt: g });
    assert.deepEqual(r.rejected, ['27']); assert.equal(r.en.id, '09'); assert.equal(r.fallback, false);
  });
});
