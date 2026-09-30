/* Proves de career/rng.js (tasca B5): draw(state) es reproduible i nomes
 * avanca el comptador.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { draw, derivedRng, createCareer } from '../../src/career/index.js';

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

  test('valor de referencia: llavor 20260927 i comptador 5', () => {
    // Formula de la seccio 7: llavor de mulberry32 =
    // (20260927 ^ imul(5, 0x9E3779B1)) >>> 0 = 371214410. La primera sortida
    // de mulberry32 amb aquesta llavor es 1031695712 / 2^32 (calculat una
    // vegada amb la formula; si canvia, ha canviat draw o makeRng i les
    // partides desades deixen de reproduir-se)
    assert.equal((20260927 ^ Math.imul(5, 0x9E3779B1)) >>> 0, 371214410);
    const s = { rngSeed: 20260927, rngCounter: 5 };
    assert.equal(draw(s), 1031695712 / 4294967296);
    assert.equal(1031695712 / 4294967296, 0.2402103766798973);
    assert.equal(s.rngCounter, 6);
  });

  test('tirades consecutives donen valors diferents', () => {
    const s = createCareer({ name: 'x', seed: 20260927, createdAt: '' });
    const values = Array.from({ length: 1000 }, () => draw(s));
    assert.equal(new Set(values).size, values.length);
    for (let i = 1; i < values.length; i++) assert.notEqual(values[i], values[i - 1]);
  });
});

describe('derivedRng (D2+D5)', () => {
  const take = (r, n) => Array.from({ length: n }, () => r());

  test('mateixa llavor, tag i key: mateixa sequencia', () => {
    assert.deepEqual(take(derivedRng(12345, 'market', 7), 20), take(derivedRng(12345, 'market', 7), 20));
  });

  test('valors a [0, 1)', () => {
    for (const x of take(derivedRng(1, 'market', 0), 2000)) assert.ok(x >= 0 && x < 1);
  });

  test('una key, un tag o una llavor diferents donen una altra sequencia', () => {
    const base = take(derivedRng(12345, 'market', 7), 5);
    assert.notDeepEqual(take(derivedRng(12345, 'market', 8), 5), base);
    assert.notDeepEqual(take(derivedRng(12345, 'other', 7), 5), base);
    assert.notDeepEqual(take(derivedRng(12346, 'market', 7), 5), base);
  });

  test('no toca la partida: rngCounter i draw no canvien', () => {
    const s = { rngSeed: 99, rngCounter: 4 };
    const before = draw({ ...s });
    take(derivedRng(s.rngSeed, 'market', 0), 50);
    assert.equal(s.rngCounter, 4);
    assert.equal(draw(s), before);
  });

  test('llanca amb un tag buit o una key que no es un enter', () => {
    assert.throws(() => derivedRng(1, '', 0), /tag/);
    assert.throws(() => derivedRng(1, 'market', 1.5), /key/);
  });
});
