/* Proves d arrivalEnd (world/ils.js): pista d arribada del vol cronometrat de
 * Free Flight (docs/DECISIONS.md, 2026-10-01, pista d arribada). Cap amb ILS;
 * si n hi ha diversos o cap, el de mes vent de cara; sense vent, el de la
 * pista mes llarga.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRPORTS, setRunwayDifficulty, makeAirport, arrivalEnd } from '../src/world/index.js';

setRunwayDifficulty('normal');

/** aeroport de prova: pistes { hdg, len, c }, ils = llista d ids o undefined (tots) */
const toy = (runways, ils) => makeAirport({ icao: 'TEST', lat: 41, lon: 2, elev: 0, axis: 90, bounds: [-5000, 5000, -3000, 3000], ils,
  runways: runways.map(r => ({ hdg: r.hdg, len: r.len, wid: 45, a: 0, c: r.c || 0 })), taxiways: [], aprons: [] });

describe('arrivalEnd', () => {
  test('un sol cap amb ILS: aquest, encara que el vent bufi de l altra banda', () => {
    const A = toy([{ hdg: 90, len: 3000 }], ['27']);
    assert.equal(arrivalEnd(A, 90, 30).id, '27');
    assert.equal(arrivalEnd(A, 0, 0).id, '27');
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

  test('aeroports reals: LERS 25, LEGE 20, LEDA 31 (un sol ILS); LELL i LESU segons el vent; LEBL sense vent, 07L (la mes llarga)', () => {
    assert.equal(arrivalEnd(AIRPORTS.LERS, 70, 20).id, '25');
    assert.equal(arrivalEnd(AIRPORTS.LEGE, 0, 0).id, '20');
    assert.equal(arrivalEnd(AIRPORTS.LEDA, 130, 10).id, '31');
    assert.equal(arrivalEnd(AIRPORTS.LELL, 300, 10).id, '31');
    assert.equal(arrivalEnd(AIRPORTS.LELL, 120, 10).id, '13');
    assert.equal(arrivalEnd(AIRPORTS.LESU, 200, 10).id, '21');
    assert.equal(arrivalEnd(AIRPORTS.LEBL, 0, 0).id, '07L');
    assert.equal(arrivalEnd(AIRPORTS.LEBL, 250, 12).id, '25R');
  });
});
