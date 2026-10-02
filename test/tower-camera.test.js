/* Proves de la seleccio de la torre de la camera de torre (nearestAirport,
 * world/airports.js): la torre es la de l aeroport mes proper, a tots els
 * aeroports. Abans es triava el primer d AIRPORT_ORDER dins d un quadrat de
 * 60 km (World.airportNear), que podia ser un aeroport vei.
 *
 * Correr:  npm test
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { AIRPORTS, AIRPORT_ORDER, nearestAirport, setRunwayDifficulty } from '../src/world/index.js';
import { NM } from '../src/core/index.js';

before(() => setRunwayDifficulty('normal'));

const end = (A, id) => A.allEnds.find(en => en.id === id);
/** punt del mon a `nm` milles de la capçalera, sobre l eix allargat de la final */
const onFinal = (A, en, nm) => A.toWorld(en.thr[0] - en.dir[0] * nm * NM, en.thr[1] - en.dir[1] * nm * NM);
const onRunway = (A) => { const r = A.runways[0]; return A.toWorld((r.p1[0] + r.p2[0]) / 2, (r.p1[1] + r.p2[1]) / 2); };

const CASES = [
  { name: 'LELL, a la pista', id: 'LELL', at: A => onRunway(A) },
  { name: 'LEDA 31, a 10 nm', id: 'LEDA', at: A => onFinal(A, end(A, '31'), 10) },
  { name: 'LEGE 02, a 10 nm', id: 'LEGE', at: A => onFinal(A, end(A, '02'), 10) },
  { name: 'LERS 25, a 15 nm', id: 'LERS', at: A => onFinal(A, end(A, '25'), 15) },
  { name: 'LESU 03, a 18 nm', id: 'LESU', at: A => onFinal(A, end(A, '03'), 18) }
];

describe('camera de torre: l aeroport mes proper', () => {
  for (const c of CASES) {
    test(c.name, () => {
      const A = AIRPORTS[c.id], [e, n] = c.at(A);
      const dist = X => Math.hypot(e - X.e, n - X.n);
      for (const id of AIRPORT_ORDER) if (id !== c.id) assert.ok(dist(A) < dist(AIRPORTS[id]), `${c.id} ha de ser mes proper que ${id}`);
      // sigui quin sigui el punt de partida de la cerca (inclos un aeroport llunya)
      for (const from of [AIRPORTS.LEBL, A, AIRPORTS.LEPA]) assert.equal(nearestAirport(e, n, from), A, `${c.name}: des de ${from.icao}`);
    });
  }

  test('a tots els aeroports, des del seu propi punt de referencia', () => {
    for (const id of AIRPORT_ORDER) { const A = AIRPORTS[id]; assert.equal(nearestAirport(A.e, A.n, AIRPORTS.LEBL), A, id); }
  });
});
