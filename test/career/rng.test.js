/* Proves de career/rng.js (tasca B5): draw(state) es reproduible i nomes
 * avanca el comptador.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { draw, createCareer } from '../../src/career/index.js';

describe('draw', () => {
  test('avanca rngCounter i retorna valors a [0, 1)', () => {
    const s = createCareer({ name: 'x', seed: 42, createdAt: '' });
    for (let i = 0; i < 1000; i++) {
      const v = draw(s);
      assert.ok(v >= 0 && v < 1, String(v));
    }
    assert.equal(s.rngCounter, 1000);
  });

  test('mateixa llavor i comptador -> mateixa sequencia; llavor diferent -> una altra', () => {
    const seq = seed => {
      const s = createCareer({ name: 'x', seed, createdAt: '' });
      return Array.from({ length: 20 }, () => draw(s));
    };
    assert.deepEqual(seq(7), seq(7));
    assert.notDeepEqual(seq(7), seq(8));
  });

  test('es pot reprendre des d un comptador desat', () => {
    const a = createCareer({ name: 'x', seed: 99, createdAt: '' });
    for (let i = 0; i < 5; i++) draw(a);
    const saved = JSON.parse(JSON.stringify(a));
    assert.equal(draw(a), draw(saved));
  });

  test('nomes toca rngCounter', () => {
    const s = createCareer({ name: 'x', seed: 3, createdAt: '' });
    const before = JSON.parse(JSON.stringify(s));
    draw(s);
    assert.deepEqual({ ...s, rngCounter: before.rngCounter }, before);
  });
});
