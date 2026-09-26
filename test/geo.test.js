/* Proves de distanceKm (world/geo.js, afegida a la tasca B2).
 * Valors de referencia fets a ma amb R = 6371 km.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { distanceKm } from '../src/world/index.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} != ${b}`);

describe('distanceKm', () => {
  test('mateix punt: 0', () => {
    assert.equal(distanceKm(41.2971, 2.0785, 41.2971, 2.0785), 0);
  });

  test('un grau de meridia i un d equador: 2 * pi * 6371 / 360 = 111.19 km', () => {
    near(distanceKm(0, 0, 1, 0), 111.1949, 1e-3);
    near(distanceKm(0, 0, 0, 1), 111.1949, 1e-3);
  });

  test('antipodes: mig cercle, pi * 6371 = 20015.09 km', () => {
    near(distanceKm(0, 0, 0, 180), 20015.087, 1e-2);
  });

  test('LEBL-LEPA ~202 km, i simetrica', () => {
    // dlat 1.7454 graus -> 194.1 km; dlon 0.6603 graus * cos(40.4) -> 55.9 km; hipotenusa ~202
    near(distanceKm(41.2971, 2.0785, 39.5517, 2.7388), 201.966, 1e-2);
    assert.equal(distanceKm(41.2971, 2.0785, 39.5517, 2.7388), distanceKm(39.5517, 2.7388, 41.2971, 2.0785));
  });
});
