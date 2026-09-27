/* Proves de src/app/save.js (tasca C2).
 *
 * Node no te localStorage: cada prova injecta un doble a globalThis, com a
 * test/platform.test.js.
 *
 * NOTA sobre 'migrated': loadCareer() detecta aquest estat comparant
 * raw.schemaVersion amb SCHEMA_VERSION, pero avui career/state.js nomes
 * accepta schemaVersion === 1 (MIGRATIONS hi es buit: encara no hi ha cap
 * migracio real). No es pot, doncs, provar aquest cami amb una migracio
 * autentica sense tocar state.js, cosa que la tasca prohibeix. Queda
 * preparat per quan una migracio real hi entri.
 *
 * Correr:  npm test
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createCareer, BALANCE } from '../../src/career/index.js';
import { on, _resetBus } from '../../src/app/bus.js';
import { CAREER_KEY, loadCareer, saveCareer, backupCareer, discardCareer } from '../../src/app/save.js';

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

const ORIGINAL = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function inject(value) {
  Object.defineProperty(globalThis, 'localStorage', { value, configurable: true, writable: true });
}

afterEach(() => {
  if (ORIGINAL) Object.defineProperty(globalThis, 'localStorage', ORIGINAL);
  else delete globalThis.localStorage;
  _resetBus();
});

function validCareer() {
  return createCareer({ name: 'Marta', seed: 1, createdAt: '2026-09-27T00:00:00.000Z' });
}

describe('loadCareer', () => {
  test("cap partida desada: status 'none'", () => {
    inject(new FakeStorage());
    assert.deepEqual(loadCareer(), { status: 'none', state: null });
  });

  test("partida valida amb el balanc actual: status 'ok'", () => {
    const ls = new FakeStorage();
    inject(ls);
    const s = validCareer();
    ls.setItem(CAREER_KEY, JSON.stringify(s));
    const { status, state } = loadCareer();
    assert.equal(status, 'ok');
    assert.deepEqual(state, s);
  });

  test("partida valida amb un altre balanceVersion: status 'balanceMismatch'", () => {
    const ls = new FakeStorage();
    inject(ls);
    const s = validCareer();
    s.balanceVersion = BALANCE.version + 1;
    ls.setItem(CAREER_KEY, JSON.stringify(s));
    const { status, state } = loadCareer();
    assert.equal(status, 'balanceMismatch');
    assert.equal(state.balanceVersion, BALANCE.version + 1);
  });

  test("partida que no valida: status 'invalid', state null", () => {
    const ls = new FakeStorage();
    inject(ls);
    ls.setItem(CAREER_KEY, JSON.stringify({ schemaVersion: 1, pilot: 'no es un objecte' }));
    assert.deepEqual(loadCareer(), { status: 'invalid', state: null });
  });

  test('mai esborra res, tant si es valid com si no', () => {
    const ls = new FakeStorage();
    inject(ls);
    ls.setItem(CAREER_KEY, JSON.stringify({ schemaVersion: 1, trencat: true }));
    loadCareer();
    assert.notEqual(ls.getItem(CAREER_KEY), null);
  });
});

describe('saveCareer', () => {
  test('estat invalid: no desa, emet save:error amb reason invalid, retorna false', () => {
    inject(new FakeStorage());
    const rebuts = [];
    on('save:error', p => rebuts.push(p));
    assert.equal(saveCareer({ pilot: 'trencat' }), false);
    assert.deepEqual(rebuts, [{ reason: 'invalid' }]);
    assert.equal(loadCareer().status, 'none');
  });

  test('Storage que refusa: emet save:error amb reason storage, retorna false', () => {
    inject(new FullStorage());
    const rebuts = [];
    on('save:error', p => rebuts.push(p));
    assert.equal(saveCareer(validCareer()), false);
    assert.deepEqual(rebuts, [{ reason: 'storage' }]);
  });

  test('estat valid: desa i retorna true', () => {
    inject(new FakeStorage());
    const s = validCareer();
    assert.equal(saveCareer(s), true);
    assert.deepEqual(loadCareer(), { status: 'ok', state: s });
  });
});

describe('backupCareer', () => {
  test('res desat: retorna null', () => {
    inject(new FakeStorage());
    assert.equal(backupCareer(), null);
  });

  test('copia el contingut cru exacte a una clau nova', () => {
    const ls = new FakeStorage();
    inject(ls);
    const raw = { schemaVersion: 1, trencat: true };
    ls.setItem(CAREER_KEY, JSON.stringify(raw));
    const key = backupCareer();
    assert.ok(key.startsWith(CAREER_KEY + '.bak.'));
    assert.deepEqual(JSON.parse(ls.getItem(key)), raw);
    assert.notEqual(ls.getItem(CAREER_KEY), null);
  });

  test('si Storage.save falla, retorna null', () => {
    const ls = new FullStorage();
    inject(ls);
    ls.data.set(CAREER_KEY, JSON.stringify({ a: 1 }));
    assert.equal(backupCareer(), null);
  });
});

describe('discardCareer', () => {
  test('sense partida: esborra (no-op) i retorna true', () => {
    inject(new FakeStorage());
    assert.equal(discardCareer(), true);
  });

  test('partida invalida: deixa una copia amb el contingut cru exacte i esborra la clau principal', () => {
    const ls = new FakeStorage();
    inject(ls);
    const raw = { schemaVersion: 99, no: 'valid' };
    ls.setItem(CAREER_KEY, JSON.stringify(raw));
    assert.equal(discardCareer(), true);
    assert.equal(ls.getItem(CAREER_KEY), null);
    const bakKey = [...ls.data.keys()].find(k => k.startsWith(CAREER_KEY + '.bak.'));
    assert.ok(bakKey);
    assert.deepEqual(JSON.parse(ls.getItem(bakKey)), raw);
  });

  test('si la copia falla, la clau principal continua intacta i retorna false', () => {
    const ls = new FullStorage();
    inject(ls);
    ls.data.set(CAREER_KEY, JSON.stringify({ a: 1 }));
    assert.equal(discardCareer(), false);
    assert.notEqual(ls.getItem(CAREER_KEY), null);
  });
});
