/* Proves de src/platform/ (tasca A2).
 *
 * Node no te localStorage ni location: cada prova injecta un doble a
 * globalThis i afterEach el treu, per no contaminar la resta de proves.
 *
 * Correr:  npm test
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { Storage, IS_DEV } from '../src/platform/index.js';

const KEY = 'pontAeri.test';

/** localStorage fals, amb la mateixa API que el del navegador. */
class FakeStorage {
  constructor() { this.data = new Map(); }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}

/** com FakeStorage, pero amb la quota plena: escriure llanca */
class FullStorage extends FakeStorage {
  setItem() { throw new Error('QuotaExceededError'); }
}

const ORIGINAL = {
  localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  location: Object.getOwnPropertyDescriptor(globalThis, 'location')
};

function inject(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

afterEach(() => {
  for (const name of Object.keys(ORIGINAL)) {
    if (ORIGINAL[name]) Object.defineProperty(globalThis, name, ORIGINAL[name]);
    else delete globalThis[name];
  }
});

describe('Storage', () => {
  test('guarda i recupera un objecte', () => {
    inject('localStorage', new FakeStorage());
    const obj = { schemaVersion: 1, company: { cash: 400000, bases: ['LEBL'] } };
    assert.equal(Storage.save(KEY, obj), true);
    const back = Storage.load(KEY);
    assert.deepEqual(back, obj);
    assert.notEqual(back, obj);
  });

  test('clau inexistent: load retorna null', () => {
    inject('localStorage', new FakeStorage());
    assert.equal(Storage.load('noHiEs'), null);
  });

  test('remove esborra la clau', () => {
    inject('localStorage', new FakeStorage());
    Storage.save(KEY, { a: 1 });
    Storage.remove(KEY);
    assert.equal(Storage.load(KEY), null);
  });

  test('JSON corrupte: load retorna null', () => {
    const ls = new FakeStorage();
    inject('localStorage', ls);
    ls.setItem(KEY, '{"cash": 4000');
    assert.equal(Storage.load(KEY), null);
    ls.setItem(KEY, '42');
    assert.equal(Storage.load(KEY), null, 'un valor que no es objecte tampoc val');
  });

  test('quota plena: save retorna false i no llanca', () => {
    inject('localStorage', new FullStorage());
    assert.equal(Storage.save(KEY, { a: 1 }), false);
    assert.equal(Storage.load(KEY), null);
  });

  test('objecte no serialitzable: save retorna false', () => {
    inject('localStorage', new FakeStorage());
    const circ = {}; circ.self = circ;
    assert.equal(Storage.save(KEY, circ), false);
    assert.equal(Storage.save(KEY, undefined), false);
  });

  test('localStorage absent: cap metode llanca', () => {
    delete globalThis.localStorage;
    assert.equal(globalThis.localStorage, undefined);
    assert.equal(Storage.load(KEY), null);
    assert.equal(Storage.save(KEY, { a: 1 }), false);
    assert.doesNotThrow(() => Storage.remove(KEY));
  });

  test('accedir a localStorage llanca (SecurityError): cap metode llanca', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, get() { throw new Error('SecurityError'); }
    });
    assert.equal(Storage.load(KEY), null);
    assert.equal(Storage.save(KEY, { a: 1 }), false);
    assert.doesNotThrow(() => Storage.remove(KEY));
  });
});

describe('IS_DEV', () => {
  test('a Node, sense location, val false', () => {
    assert.equal(IS_DEV, false);
  });

  /** carrega env.js de nou (una URL diferent es un modul nou) amb aquesta location */
  let n = 0;
  async function devWith(hostname, search = '') {
    inject('location', { hostname, search });
    return (await import(`../src/platform/env.js?case=${n++}`)).IS_DEV;
  }

  test('mateix calcul que l etiqueta DEV d index.html', async () => {
    assert.equal(await devWith('pont-aeri.pages.dev'), true);
    assert.equal(await devWith('abc123.pont-aeri.pages.dev'), true);
    assert.equal(await devWith('localhost'), true);
    assert.equal(await devWith('atlaslabs08.github.io', '?dev'), true);
    assert.equal(await devWith('atlaslabs08.github.io'), false);
    assert.equal(await devWith('pages.dev.example.com'), false);
  });
});
