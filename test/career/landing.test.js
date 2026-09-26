/* Proves de career/landing.js (tasca B2): limits exactes de cada tram.
 * Els valors esperats son literals de la taula de BALANCE.landingBands.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { landingBand } from '../../src/career/index.js';

const key = s => landingBand(s).key;

describe('landingBand', () => {
  test('limits exactes de cada tram', () => {
    assert.equal(key(100), 'landing.textbook');
    assert.equal(key(99), 'landing.textbook');
    assert.equal(key(98.99), 'landing.flawless');
    assert.equal(key(95), 'landing.flawless');
    assert.equal(key(94.99), 'landing.excellent');
    assert.equal(key(90), 'landing.excellent');
    assert.equal(key(89.99), 'landing.solid');
    assert.equal(key(82), 'landing.solid');
    assert.equal(key(81.99), 'landing.safe');
    assert.equal(key(72), 'landing.safe');
    assert.equal(key(71.99), 'landing.firm');
    assert.equal(key(60), 'landing.firm');
    assert.equal(key(59.99), 'landing.rough');
    assert.equal(key(45), 'landing.rough');
    assert.equal(key(44.99), 'landing.veryHard');
    assert.equal(key(30), 'landing.veryHard');
    assert.equal(key(29.99), 'landing.incident');
    assert.equal(key(15), 'landing.incident');
    assert.equal(key(14.99), 'landing.inspection');
    assert.equal(key(0), 'landing.inspection');
  });

  test('sense arrodonir: 98.9 cau al tram de 95', () => {
    assert.equal(key(98.9), 'landing.flawless');
  });

  test('retorna mult i xp del tram', () => {
    assert.deepEqual({ ...landingBand(82) }, { min: 82, mult: 1.00, xp: 20, key: 'landing.solid' });
    assert.deepEqual({ ...landingBand(35) }, { min: 30, mult: 0.15, xp: -8, key: 'landing.veryHard' });
  });

  test('fora de rang: es retalla a [0, 100]', () => {
    assert.equal(key(150), 'landing.textbook');
    assert.equal(key(100.01), 'landing.textbook');
    assert.equal(key(-5), 'landing.inspection');
    assert.equal(key(-Infinity), 'landing.inspection');
  });

  test('no finit o no numeric: compta com 0', () => {
    assert.equal(key(NaN), 'landing.inspection');
    assert.equal(key(Infinity), 'landing.inspection');
    assert.equal(key(undefined), 'landing.inspection');
    assert.equal(key(null), 'landing.inspection');
    assert.equal(key('99'), 'landing.inspection');
  });
});
