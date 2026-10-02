/* Proves d arrivalEnd i flightApproach (world/ils.js): pista d arribada dels
 * vols de Free Flight (docs/DECISIONS.md, 2026-10-01, H11 i H13). Cap amb
 * ILS; si n hi ha diversos o cap, el de mes vent de cara; sense vent, el de la
 * pista mes llarga. Ruta: al desti; inici en final: la de l arrencada.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRPORTS, setRunwayDifficulty, makeAirport, arrivalEnd, flightApproach, tailwindKt, MAX_TAILWIND_KT } from '../src/world/index.js';

setRunwayDifficulty('normal');

/** aeroport de prova: pistes { hdg, len, c }, ils = llista d ids o undefined (tots) */
const toy = (runways, ils) => makeAirport({ icao: 'TEST', lat: 41, lon: 2, elev: 0, axis: 90, bounds: [-5000, 5000, -3000, 3000], ils,
  runways: runways.map(r => ({ hdg: r.hdg, len: r.len, wid: 45, a: 0, c: r.c || 0 })), taxiways: [], aprons: [] });

describe('arrivalEnd', () => {
  test('un sol cap amb ILS: aquest, encara que el vent bufi de l altra banda, fins a 10 kt de vent de cua (H17c)', () => {
    const A = toy([{ hdg: 90, len: 3000 }], ['27']);
    assert.equal(arrivalEnd(A, 90, 10).id, '27');
    assert.equal(arrivalEnd(A, 0, 0).id, '27');
  });

  test('H17c: amb mes de 10 kt de vent de cua, l altre cap; i si tots en tenen mes, la regla de sempre', () => {
    assert.equal(MAX_TAILWIND_KT, 10);
    const A = toy([{ hdg: 90, len: 3000 }], ['27']);
    assert.equal(arrivalEnd(A, 90, 30).id, '09', '30 kt de cua al 27 (ILS): el 09');
    assert.equal(arrivalEnd(A, 90, 10.5).id, '09');
    assert.ok(Math.abs(tailwindKt(A.allEnds[1], 90, 12) - 12) < 1e-9 && Math.abs(tailwindKt(A.allEnds[0], 90, 12) + 12) < 1e-9);
    const B = toy([{ hdg: 90, len: 3000 }], []);
    assert.equal(arrivalEnd(B, 0, 30).id, '09', 'creuat: cap dels dos te vent de cua, mana el vent de cara (empat: el primer)');
  });

  test('diversos caps amb ILS: el de mes vent de cara d entre ells', () => {
    const A = toy([{ hdg: 90, len: 3000, c: 0 }, { hdg: 0, len: 2000, c: 1500 }], ['09', '36']);
    assert.equal(arrivalEnd(A, 80, 15).id, '09');
    assert.equal(arrivalEnd(A, 350, 15).id, '36');
    assert.equal(arrivalEnd(A, 270, 15).id, '36', 'el 27 no te ILS: d entre els que en tenen, el 36 (creuat) abans que el 09 (de cua)');
  });

  test('cap amb ILS: el de mes vent de cara de tots', () => {
    const A = toy([{ hdg: 90, len: 3000 }], []);
    assert.equal(arrivalEnd(A, 260, 10).id, '27');
    assert.equal(arrivalEnd(A, 100, 10).id, '09');
  });

  test('sense vent: el de la pista mes llarga; empat, el primer', () => {
    const A = toy([{ hdg: 0, len: 2000, c: 1500 }, { hdg: 90, len: 3000, c: 0 }], []);
    assert.equal(arrivalEnd(A, 250, 0).id, '09');
    const B = toy([{ hdg: 90, len: 3000 }], []);
    assert.equal(arrivalEnd(B, 0, 0).id, '09');
  });

  test('funcio pura: no canvia l aeroport i sempre torna un cap seu', () => {
    const A = AIRPORTS.LEBL, before = A.allEnds.map(e => e.id).join();
    for (const dir of [0, 90, 180, 270]) for (const kt of [0, 10]) assert.ok(A.allEnds.includes(arrivalEnd(A, dir, kt)));
    assert.equal(A.allEnds.map(e => e.id).join(), before);
  });

  test('aeroports reals: LERS 25, LEGE 20 (un sol ILS, sense massa vent de cua); LELL segons el vent; LEBL sense vent, 07L (la mes llarga)', () => {
    assert.equal(arrivalEnd(AIRPORTS.LERS, 70, 8).id, '25');
    assert.equal(arrivalEnd(AIRPORTS.LEGE, 0, 0).id, '20');
    assert.equal(arrivalEnd(AIRPORTS.LELL, 300, 10).id, '31');
    assert.equal(arrivalEnd(AIRPORTS.LEBL, 0, 0).id, '07L');
    assert.equal(arrivalEnd(AIRPORTS.LEBL, 250, 12).id, '25R');
  });

  test('TA-9: un cap sense aproximacio directa no es tria si n hi ha un altre, encara que tingui ILS o vent de cara', () => {
    assert.equal(AIRPORTS.LESU.allEnds.find(en => en.id === '21').direct, false);
    assert.equal(arrivalEnd(AIRPORTS.LESU, 200, 10).id, '03', 'LESU 21 sense aproximacio directa');
    assert.equal(arrivalEnd(AIRPORTS.LERS, 70, 20).id, '25', 'LERS 07 sense aproximacio directa: el 25 encara que tingui 20 kt de cua');
    assert.equal(arrivalEnd(AIRPORTS.LEDA, 130, 10).id, '13', 'LEDA 31 (l ILS) sense aproximacio directa');
    assert.equal(arrivalEnd(AIRPORTS.LELL, 120, 10).id, '31', 'LELL 13 sense aproximacio directa');
    assert.equal(arrivalEnd(AIRPORTS.LEBL, 200, 15).id, '25R', 'LEBL 20 sense aproximacio directa');
    const only = { allEnds: [AIRPORTS.LESU.allEnds[1]] };
    assert.equal(arrivalEnd(only, 0, 0).id, '21', 'si no n hi ha cap altre, el cap sense aproximacio directa');
  });
});

describe('flightApproach (H11, H13)', () => {
  const base = { mode: 'free', start: 'runway', airport: 'LEBL', dest: 'LERS', runway: 0, windDir: 250, windKt: 0 };

  test('mode route: la pista d arribada del desti, sintonitzada des del principi', () => {
    const r = flightApproach({ ...base, mode: 'route' });
    assert.equal(r.A, AIRPORTS.LERS); assert.equal(r.en.id, '25'); assert.equal(r.tuned, true);
    const s = flightApproach({ ...base, mode: 'route', dest: 'LESU', windDir: 200, windKt: 12 });
    assert.equal(s.A, AIRPORTS.LESU); assert.equal(s.en.id, '03'); assert.equal(s.tuned, true);     // el 21 no te aproximacio directa (TA-9)
  });

  test('mode route amb inici en final: mana la ruta (el desti)', () => {
    const r = flightApproach({ ...base, mode: 'route', start: 'final', runway: 1 });
    assert.equal(r.A, AIRPORTS.LERS); assert.equal(r.tuned, true);
  });

  test('inici en final sense ruta: el cap de l arrencada, encara que el vent o l ILS en triessin un altre', () => {
    for (const [apt, k] of [['LESU', 0], ['LESU', 1], ['LEBL', 3], ['LERS', 0]]) {
      const r = flightApproach({ ...base, airport: apt, start: 'final', runway: k, windDir: 0, windKt: 30 });
      assert.equal(r.A, AIRPORTS[apt]); assert.equal(r.en, AIRPORTS[apt].allEnds[k]); assert.equal(r.tuned, true);
    }
  });

  test('altres arrencades sense ruta: l aeroport triat, arrivalEnd, sense sintonitzar (auto-sintonia de sempre)', () => {
    for (const start of ['runway', 'gate']) {
      const r = flightApproach({ ...base, airport: 'LELL', start, windDir: 120, windKt: 10 });
      assert.equal(r.A, AIRPORTS.LELL); assert.equal(r.en.id, '31'); assert.equal(r.tuned, false);     // el 13 no te aproximacio directa (TA-9)
    }
  });
});
