/* Proves de src/app/airline.js (tasca C5+D1, docs/DECISIONS.md 30/09/2026).
 *
 * Node no te localStorage: cada prova injecta un doble a globalThis, com a
 * save.test.js, i buida la partida en memoria (_resetAirline).
 *
 * Correr:  npm test
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createCareer, graduate, exportJson, LESSONS, BALANCE } from '../../src/career/index.js';
import { on, _resetBus } from '../../src/app/bus.js';
import { CAREER_KEY, loadCareer } from '../../src/app/save.js';
import {
  NAME_MAX_LENGTH, normalizeName, openAirline, currentCareer, pendingCareer, entryScreen,
  createAirline, acceptBalanceMismatch, startOver, recordLesson, needsGraduation,
  graduateCareer, exportCareer, importCareer, saveAirline, unlockAllLessons,
  discardAirline, topBarModel, _resetAirline
} from '../../src/app/airline.js';

class FakeStorage {
  constructor() { this.data = new Map(); }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}

const ORIGINAL = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let store;

beforeEach(() => {
  store = new FakeStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  _resetAirline();
});

afterEach(() => {
  if (ORIGINAL) Object.defineProperty(globalThis, 'localStorage', ORIGINAL);
  else delete globalThis.localStorage;
  _resetBus();
  _resetAirline();
});

const SEED = { seed: 42, createdAt: '2026-09-30T10:00:00.000Z' };
const stored = () => JSON.parse(store.getItem(CAREER_KEY));
const allLessons = () => LESSONS.map(l => l.id);
/** fets que aproven la llico 1 (exterior: 4 vistes) */
const PASS_EXTERIOR = { crashed: false, viewsVisited: 4 };
const FAIL_EXTERIOR = { crashed: false, viewsVisited: 2 };

describe('nom de la partida (E1)', () => {
  test('treu els espais dels extrems i accepta d 1 a 24 caracters', () => {
    assert.equal(normalizeName('  Marta  '), 'Marta');
    assert.equal(normalizeName('x'), 'x');
    assert.equal(normalizeName('a'.repeat(NAME_MAX_LENGTH)), 'a'.repeat(24));
    assert.equal(normalizeName('Núria Ç'), 'Núria Ç');
  });

  test('buit, nomes espais, massa llarg o no text: null', () => {
    for (const bad of ['', '   ', 'a'.repeat(25), null, undefined, 7]) assert.equal(normalizeName(bad), null, String(bad));
  });

  test('un nom invalid no crea ni desa cap partida', () => {
    assert.deepEqual(createAirline('   ', SEED), { ok: false, reason: 'name' });
    assert.equal(currentCareer(), null);
    assert.equal(store.getItem(CAREER_KEY), null);
  });
});

describe('partida nova', () => {
  test('es crea amb createCareer i es desa a pontAeri.career.v1', () => {
    const r = createAirline(' Marta ', SEED);
    assert.deepEqual(r, { ok: true, saved: true });
    assert.deepEqual(currentCareer(), createCareer({ name: 'Marta', ...SEED }));
    assert.deepEqual(stored(), currentCareer());
    assert.deepEqual(currentCareer().pilot.ratings, []);
  });

  test('sense seed ni createdAt, els posa platform/', () => {
    createAirline('Marta');
    const s = currentCareer();
    assert.ok(Number.isInteger(s.rngSeed) && s.rngSeed >>> 0 === s.rngSeed);
    assert.match(s.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  test('emet career:changed', () => {
    const seen = [];
    on('career:changed', p => seen.push(p.state));
    createAirline('Marta', SEED);
    assert.equal(seen.length, 1);
    assert.equal(seen[0], currentCareer());
  });
});

describe('openAirline: els cinc estats de loadCareer (E8)', () => {
  test('none: sense partida, pantalla del nom', () => {
    assert.deepEqual(openAirline(), { status: 'none' });
    assert.equal(currentCareer(), null);
    assert.equal(entryScreen(currentCareer()), 'name');
  });

  test('ok: la partida queda carregada', () => {
    createAirline('Marta', SEED);
    _resetAirline();
    assert.deepEqual(openAirline(), { status: 'ok' });
    assert.equal(currentCareer().pilot.name, 'Marta');
    assert.equal(entryScreen(currentCareer()), 'school');
  });

  test('balanceMismatch: queda pendent fins que el jugador tria', () => {
    createAirline('Marta', SEED);
    store.setItem(CAREER_KEY, JSON.stringify({ ...stored(), balanceVersion: BALANCE.version + 1 }));
    _resetAirline();
    assert.deepEqual(openAirline(), { status: 'balanceMismatch' });
    assert.equal(currentCareer(), null);
    assert.equal(pendingCareer().pilot.name, 'Marta');
    // continuar: la partida passa a la versio actual i es desa
    assert.equal(acceptBalanceMismatch(), true);
    assert.equal(currentCareer().balanceVersion, BALANCE.version);
    assert.equal(pendingCareer(), null);
    assert.equal(loadCareer().status, 'ok');
  });

  test('balanceMismatch i continuar: primer es fa copia de la partida antiga', () => {
    createAirline('Marta', SEED);
    const old = { ...stored(), balanceVersion: BALANCE.version + 1 };
    store.setItem(CAREER_KEY, JSON.stringify(old));
    openAirline();
    const saved = [];
    const setItem = store.setItem.bind(store);
    store.setItem = (k, v) => { saved.push(k); setItem(k, v); };
    assert.equal(acceptBalanceMismatch(), true);
    // la copia (.bak) s escriu abans de sobreescriure la partida
    assert.equal(saved.length, 2);
    assert.ok(saved[0].startsWith(CAREER_KEY + '.bak.'));
    assert.equal(saved[1], CAREER_KEY);
    assert.deepEqual(JSON.parse(store.getItem(saved[0])), old);
    assert.equal(stored().balanceVersion, BALANCE.version);
  });

  test('balanceMismatch i continuar: si la copia falla no se sobreescriu res', () => {
    createAirline('Marta', SEED);
    store.setItem(CAREER_KEY, JSON.stringify({ ...stored(), balanceVersion: BALANCE.version + 1 }));
    const raw = store.getItem(CAREER_KEY);
    openAirline();
    const setItem = store.setItem.bind(store);
    store.setItem = (k, v) => { if (k.includes('.bak.')) throw new Error('QuotaExceededError'); setItem(k, v); };
    assert.equal(acceptBalanceMismatch(), false);
    assert.equal(store.getItem(CAREER_KEY), raw);
    assert.equal(currentCareer(), null);
    assert.ok(pendingCareer() !== null);
  });

  test('balanceMismatch i comencar de nou: copia, esborra i torna al nom', () => {
    createAirline('Marta', SEED);
    store.setItem(CAREER_KEY, JSON.stringify({ ...stored(), balanceVersion: BALANCE.version + 1 }));
    openAirline();
    assert.equal(startOver(), true);
    assert.equal(currentCareer(), null);
    assert.equal(pendingCareer(), null);
    assert.equal(store.getItem(CAREER_KEY), null);
    assert.equal([...store.data.keys()].filter(k => k.startsWith(CAREER_KEY + '.bak.')).length, 1);
  });

  test('invalid: se n fa copia de seguida i no s esborra res', () => {
    store.setItem(CAREER_KEY, '{"schemaVersion": 1, "trencada": true}');
    const r = openAirline();
    assert.equal(r.status, 'invalid');
    assert.ok(r.backupKey.startsWith(CAREER_KEY + '.bak.'));
    assert.deepEqual(JSON.parse(store.getItem(r.backupKey)), JSON.parse(store.getItem(CAREER_KEY)));
    assert.ok(store.getItem(CAREER_KEY) !== null);
    assert.equal(currentCareer(), null);
  });
});

describe('intents de llico', () => {
  test('l intent es desa i en tornar a carregar l escola hi es', () => {
    createAirline('Marta', SEED);
    const r = recordLesson('exterior', PASS_EXTERIOR);
    assert.equal(r.passed, true);
    assert.equal(r.saved, true);
    _resetAirline();
    openAirline();
    assert.deepEqual(currentCareer().school.lessonsPassed, ['exterior']);
    assert.deepEqual(currentCareer().school.attempts, { exterior: 1 });
  });

  test('un suspens tambe es desa (compta l intent)', () => {
    createAirline('Marta', SEED);
    recordLesson('exterior', FAIL_EXTERIOR);
    assert.deepEqual(stored().school.attempts, { exterior: 1 });
    assert.deepEqual(stored().school.lessonsPassed, []);
  });

  test('sense partida o amb una llico no disponible, llanca i no desa', () => {
    assert.throws(() => recordLesson('exterior', PASS_EXTERIOR), /recordLesson/);
    createAirline('Marta', SEED);
    assert.throws(() => recordLesson('landing', PASS_EXTERIOR), /landing/);
    assert.deepEqual(stored().school.attempts, {});
  });
});

describe('graduacio (E2)', () => {
  test('entryScreen: escola, graduacio i centre d operacions', () => {
    const s = createCareer({ name: 'Marta', ...SEED });
    assert.equal(entryScreen(s), 'school');
    const ready = { ...s, school: { ...s.school, lessonsPassed: allLessons() } };
    assert.equal(entryScreen(ready), 'graduation');
    assert.equal(entryScreen(graduate(ready)), 'ops');
  });

  test('s aplica un sol cop encara que es demani dues vegades', () => {
    createAirline('Marta', SEED);
    assert.equal(graduateCareer(), null, 'sense totes les llicons no toca');
    unlockAllLessons();
    assert.equal(needsGraduation(), true);
    const g = graduateCareer();
    assert.deepEqual(g, { rating: 'commuter', xpGained: BALANCE.school.graduationXp,
      xp: BALANCE.school.graduationXp, rank: 'student', cash: BALANCE.startingCash,
      loan: BALANCE.startingLoan.principal, saved: true });
    const after = JSON.stringify(currentCareer());
    assert.equal(graduateCareer(), null);
    assert.equal(JSON.stringify(currentCareer()), after);
    assert.deepEqual(stored().pilot.ratings, ['commuter']);
    assert.equal(stored().pilot.xp, BALANCE.school.graduationXp);
    assert.equal(stored().school.graduated, true);
  });

  test('una partida carregada que ja pot graduar-se va a la graduacio', () => {
    createAirline('Marta', SEED);
    unlockAllLessons();
    _resetAirline();
    openAirline();
    assert.equal(entryScreen(currentCareer()), 'graduation');
  });

  test('les llicons es poden repetir despres de graduar-se sense XP ni diners', () => {
    createAirline('Marta', SEED);
    unlockAllLessons();
    graduateCareer();
    const { pilot, company } = currentCareer();
    recordLesson('exterior', PASS_EXTERIOR);
    assert.deepEqual(currentCareer().pilot, pilot);
    assert.deepEqual(currentCareer().company, company);
    assert.equal(currentCareer().school.graduated, true);
  });
});

describe('exportar i importar (E9)', () => {
  test('exportar dona el JSON d exportJson; importar-lo el torna a carregar i el desa', () => {
    createAirline('Marta', SEED);
    recordLesson('exterior', PASS_EXTERIOR);
    const text = exportCareer();
    assert.equal(text, exportJson(currentCareer()));
    const exported = currentCareer();
    discardAirline();
    createAirline('Pere', SEED);
    assert.deepEqual(importCareer(text), { ok: true, saved: true });
    assert.deepEqual(currentCareer(), exported);
    assert.deepEqual(stored(), exported);
  });

  test('importar un JSON dolent no canvia la partida ni el que hi ha desat', () => {
    createAirline('Marta', SEED);
    const before = currentCareer(), raw = store.getItem(CAREER_KEY);
    for (const bad of ['no es json', '{}', '{"schemaVersion": 1}', JSON.stringify({ ...before, company: null }), '']) {
      assert.deepEqual(importCareer(bad), { ok: false }, bad);
      assert.equal(currentCareer(), before);
      assert.equal(store.getItem(CAREER_KEY), raw);
    }
  });

  test('sense partida, exportar dona null', () => {
    assert.equal(exportCareer(), null);
  });
});

describe('desar en tancar una pantalla i panell DEV (E10)', () => {
  test('saveAirline desa la partida en memoria; sense partida, false', () => {
    assert.equal(saveAirline(), false);
    createAirline('Marta', SEED);
    store.removeItem(CAREER_KEY);
    assert.equal(saveAirline(), true);
    assert.equal(stored().pilot.name, 'Marta');
  });

  test('unlockAllLessons actua sobre l escola de la partida i la desa', () => {
    assert.equal(unlockAllLessons(), false);
    createAirline('Marta', SEED);
    assert.equal(unlockAllLessons(), true);
    assert.deepEqual(stored().school.lessonsPassed, allLessons());
  });

  test('discardAirline fa copia, esborra i deixa la memoria buida', () => {
    createAirline('Marta', SEED);
    assert.equal(discardAirline(), true);
    assert.equal(currentCareer(), null);
    assert.equal(store.getItem(CAREER_KEY), null);
    assert.equal(openAirline().status, 'none');
    assert.ok([...store.data.keys()].some(k => k.startsWith(CAREER_KEY + '.bak.')));
  });
});

describe('topBarModel (E6)', () => {
  const base = () => createCareer({ name: 'Marta', ...SEED });
  const withXp = xp => { const s = base(); return { ...s, pilot: { ...s.pilot, xp } }; };
  const airframe = (reg, status) => ({ reg, typeId: 'commuter', yearBuilt: 2010, hours: 0, cycles: 0,
    condition: { engines: 100, gear: 100, airframe: 100, avionics: 100 }, location: 'LEBL', status,
    groundedUntilMinute: 0, maintenance: { nextAHours: 500, nextCHours: 6000, deferred: [] },
    finance: { purchasePrice: 350000, loanId: null, leaseId: null }, value: 350000 });

  test('recent graduat: 250 de 600 XP, saldo, reputacio, flota 0/0 i la base inicial', () => {
    const s = base(), ready = { ...s, school: { ...s.school, lessonsPassed: allLessons() } };
    const m = topBarModel(graduate(ready));
    assert.deepEqual(m, { name: 'Marta', rankKey: 'student', xp: 250, xpFloor: 0, xpNext: 600,
      xpProgress: 250 / 600, atMaxRank: false, cash: BALANCE.startingCash, reputation: BALANCE.reputation.start,
      fleetReady: 0, fleetTotal: 0, base: BALANCE.startingBase });
  });

  test('barra d XP a mig rang', () => {
    // private 600, commercial 1100: 850 es la meitat
    const m = topBarModel(withXp(850));
    assert.equal(m.rankKey, 'private');
    assert.equal(m.xpFloor, 600);
    assert.equal(m.xpNext, 1100);
    assert.equal(m.xpProgress, 0.5);
  });

  test('al rang maxim la barra es plena', () => {
    const top = BALANCE.ranks[BALANCE.ranks.length - 1];
    for (const xp of [top.xp, top.xp + 5000]) {
      const m = topBarModel(withXp(xp));
      assert.equal(m.rankKey, top.key);
      assert.equal(m.xpNext, null);
      assert.equal(m.xpProgress, 1);
      assert.equal(m.atMaxRank, true);
    }
  });

  test('flota: operatius (ready) sobre el total, i base', () => {
    const s = base();
    const m = topBarModel({ ...s,
      company: { ...s.company, bases: ['LEBL', 'LEPA'], cash: 123456, reputation: 61.6 },
      fleet: [airframe('EC-AAA', 'ready'), airframe('EC-BBB', 'maintenance'), airframe('EC-CCC', 'ready'), airframe('EC-DDD', 'inFlight')] });
    assert.equal(m.fleetReady, 2);
    assert.equal(m.fleetTotal, 4);
    assert.equal(m.base, 'LEBL');
    assert.equal(m.cash, 123456);
    assert.equal(m.reputation, 62);
  });

  test('es pura: no modifica l entrada', () => {
    const s = withXp(850), before = JSON.stringify(s);
    topBarModel(s);
    assert.equal(JSON.stringify(s), before);
  });
});
