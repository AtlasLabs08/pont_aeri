/* Proves de world/route.js: punt intermedi, altituds minimes, MEA, sostre de
 * l avio, vent de cua i caps no volables del vol cronometrat de Free Flight
 * (H16, H17, docs/DECISIONS.md, 2026-10-01). Creuers i sostres de la taula
 * d index.html i d aircraft-data.js: LEBL-LESU (128 km) 11.000 ft turbohelix
 * (sostre 25.000) i 15.000 ft jet (39.800); LEBL-LERS 6.000 / 8.000 ft.
 *
 * Correr:  npm test
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { AIRPORTS, World, ILS, setRunwayDifficulty, makeAirport, approachFix, legFlyable, legMeaFt, planRoute, planArrival,
  IF_NM, LEG_CLEAR_FT, LEG_SIDE_NM, thresholdDistNm } from '../src/world/index.js';
import { NM } from '../src/core/index.js';

const FT = 0.3048;
before(() => { setRunwayDifficulty('normal'); World.build(); });

/** final de la pista de sortida 0 (com la ruta del ND a index.html) */
const originOf = A => { const en = A.allEnds[0], p = A.toWorld(en.thr[0] + en.dir[0] * en.rw.len, en.thr[1] + en.dir[1] * en.rw.len); return { e: p[0], n: p[1] }; };

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

describe('legMeaFt (H17a)', () => {
  const p0 = { e: 0, n: 0 }, p1 = { e: 30000, n: 0 };
  test('punt mes alt a 1 nm de cada costat, mes 1.000 ft, arrodonit cap amunt a 100 ft', () => {
    assert.equal(legMeaFt(p0, p1, () => 0), 1000);
    const hill = (d, h) => (e, n) => Math.abs(n - d) < 150 && Math.abs(e - 15000) < 150 ? h : 0;
    assert.equal(legMeaFt(p0, p1, hill(0, 500)), Math.ceil((500 / FT + 1000) / 100) * 100);      // 2.640 ft -> 2.700
    assert.equal(legMeaFt(p0, p1, hill(0, 500)), 2700);
    assert.equal(legMeaFt(p0, p1, hill(NM, 500)), 2700, 'a 1 nm del costat compta');
    assert.equal(legMeaFt(p0, p1, hill(1.3 * NM, 500)), 1000, 'a 1,3 nm, no');
  });
});

/** aeroport de prova amb una pista 09/27 a (0, 0) local; origen a 60 km a l oest */
const toyApt = () => makeAirport({ icao: 'TEST', lat: 41, lon: 2, elev: 0, axis: 90, bounds: [-5000, 5000, -3000, 3000],
  runways: [{ hdg: 90, len: 3000, wid: 45, a: 0, c: 0 }], taxiways: [], aprons: [] });

describe('planArrival i planRoute (H16, H17)', () => {
  const LEBL0 = () => originOf(AIRPORTS.LEBL);

  test('Prat -> La Seu amb vent del sud-oest: la 21 per l IF, amb la MEA per sobre del creuer de la taula', () => {
    for (const [cruiseFt, ceilingFt] of [[11000, 25000], [15000, 39800]]) {
      const r = planArrival({ origin: LEBL0(), cruiseFt, ceilingFt, A: AIRPORTS.LESU, windDir: 210, windKt: 12 });
      assert.equal(r.en.id, '21'); assert.equal(r.usesIF, true); assert.equal(r.flyable, true); assert.equal(r.fallback, false);
      assert.deepEqual(r.rejected, []); assert.deepEqual(r.fixes.map(f => f.name), ['IF21', 'FF21']);
      assert.ok(r.tailwindKt < 0, 'vent de cara');
      // MEA del tram origen -> IF21 (el terreny del Pirineu), per sobre del creuer del turbohelix
      assert.equal(r.meaFt, legMeaFt(LEBL0(), r.fixes[0]));
      assert.ok(r.meaFt > 11000 && r.meaFt <= 25000, `MEA ${r.meaFt}`);
      assert.equal(r.cruiseFt, Math.max(cruiseFt, r.meaFt));
      // el tram IF -> FF, des de l altitud d arribada a l IF (MEA), es volable
      const [IF, FF] = r.fixes;
      assert.ok(legFlyable(IF, Math.max(IF.h, r.meaFt * FT), FF, FF.h).ok);
    }
  });

  test('Prat -> La Seu sense vent: la 03 (pista mes llarga, empat: la primera), per l IF', () => {
    const r = planArrival({ origin: LEBL0(), cruiseFt: 11000, ceilingFt: 25000, A: AIRPORTS.LESU, windDir: 250, windKt: 0 });
    assert.equal(r.en.id, '03'); assert.equal(r.usesIF, true); assert.deepEqual(r.rejected, []);
    assert.ok(r.meaFt <= 11000, 'sense MEA per sobre del creuer'); assert.equal(r.cruiseFt, 11000);
  });

  test('Prat -> Reus sense canvis: LERS 25, directa, al creuer de la taula', () => {
    for (const [cruiseFt, ceilingFt] of [[8000, 39800], [6000, 25000]]) {
      const r = planArrival({ origin: LEBL0(), cruiseFt, ceilingFt, A: AIRPORTS.LERS, windDir: 250, windKt: 0 });
      assert.equal(r.en.id, '25'); assert.equal(r.usesIF, false); assert.equal(r.flyable, true);
      assert.deepEqual(r.fixes.map(f => f.name), ['FF25']); assert.equal(r.cruiseFt, cruiseFt);
      assert.ok(r.meaFt <= r.fixes[0].minFt);
    }
  });

  test('H17a: un cap nomes es descarta si la MEA supera el sostre de l avio', () => {
    // muntanya de 8.000 m entre 5 i 15 km a l est de la pista: sota els trams cap al 27 (s hi arriba des de l est)
    const A = toyApt(), origin = { e: A.e - 60000, n: A.n }, g = (e, n) => e > A.e + 5000 && e < A.e + 15000 && Math.abs(n - A.n) < 20000 ? 8000 : 0;
    const tp = planArrival({ origin, cruiseFt: 11000, ceilingFt: 25000, A, windDir: 270, windKt: 8, groundAt: g });
    assert.deepEqual(tp.rejected, ['27']); assert.equal(tp.en.id, '09'); assert.equal(tp.fallback, false);
    assert.equal(planRoute(origin, 11000, A, A.allEnds[1], g, 25000).tooHigh, true);
    // amb un sostre mes alt el 27 es pot fer, a la seva MEA
    const jet = planArrival({ origin, cruiseFt: 15000, ceilingFt: 39800, A, windDir: 270, windKt: 8, groundAt: g });
    assert.equal(jet.en.id, '27'); assert.ok(jet.meaFt > 25000 && jet.cruiseFt === jet.meaFt);
  });

  test('H17c: mes de 10 kt de vent de cua fa triar l altre cap; si no n hi ha cap altre d utilitzable, es tria i es diu', () => {
    const lers = planArrival({ origin: LEBL0(), cruiseFt: 8000, ceilingFt: 39800, A: AIRPORTS.LERS, windDir: 70, windKt: 20 });
    assert.equal(lers.en.id, '07', '20 kt de cua al 25'); assert.ok(lers.tailwindKt <= 10);
    const A = toyApt(), origin = { e: A.e - 60000, n: A.n }, g = (e, n) => e > A.e + 5000 && e < A.e + 15000 && Math.abs(n - A.n) < 20000 ? 8000 : 0;
    // el 27 no es pot fer (sostre) i el 09 te 12 kt de cua: es tria el 09 igualment
    const r = planArrival({ origin, cruiseFt: 11000, ceilingFt: 25000, A, windDir: 270, windKt: 12, groundAt: g });
    assert.equal(r.en.id, '09'); assert.ok(r.tailwindKt > 10 && Math.abs(r.tailwindKt - 12) < 1e-9); assert.equal(r.fallback, false);
  });

  test('cas sintetic sense cap cap volable: el de mes vent de cara, marcat fallback', () => {
    const A = makeAirport({ icao: 'TEST', lat: 41, lon: 2, elev: 0, axis: 90, bounds: [-5000, 5000, -3000, 3000], ils: ['09'],
      runways: [{ hdg: 90, len: 3000, wid: 45, a: 0, c: 0 }, { hdg: 0, len: 2500, wid: 45, a: 0, c: 1500 }], taxiways: [], aprons: [] });
    const wall = () => 1e5, origin = { e: A.e - 100000, n: A.n };
    const r = planArrival({ origin, cruiseFt: 11000, ceilingFt: 25000, A, windDir: 350, windKt: 15, groundAt: wall });
    assert.equal(r.fallback, true); assert.equal(r.flyable, false);
    assert.equal(r.en.id, '36', 'mes vent de cara, encara que el 09 tingui ILS');
    assert.deepEqual([...r.rejected].sort(), A.allEnds.map(e => e.id).sort());
    const calm = planArrival({ origin, cruiseFt: 11000, ceilingFt: 25000, A, windDir: 0, windKt: 0, groundAt: wall });
    assert.equal(calm.fallback, true); assert.equal(calm.en.id, '09', 'sense vent: la pista mes llarga');
  });
});
