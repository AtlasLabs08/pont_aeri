/* Proves de career/state.js (tasca A5): creacio, validacio, migracio,
 * versio de balanc, export i import.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHEMA_VERSION, BALANCE, createCareer, validate, migrate,
  needsBalanceUpdate, exportJson, importJson
} from '../../src/career/index.js';

const OPTS = { name: 'Marta', seed: 12345, createdAt: '2026-09-26T10:00:00.000Z' };

function airframe(reg, extra) {
  return {
    reg, typeId: 'tp', yearBuilt: 2004, hours: 1234.5, cycles: 900,
    condition: { engines: 0.9, gear: 0.95, airframe: 0.88, avionics: 1 },
    location: 'LEBL', status: 'ready', groundedUntilMinute: 0,
    maintenance: { nextAHours: 120, nextCHours: 2400, deferred: [] },
    finance: { purchasePrice: 3500000, loanId: null, leaseId: null },
    value: 3200000, ...extra
  };
}

/** Partida plena: cada llista te almenys un element, per validar-ne el tipus. */
function fullCareer() {
  const s = createCareer(OPTS);
  s.pilot.logbook.push({ from: 'LEBL', to: 'LEPA' });
  s.pilot.ratings.push('tp');
  s.company.cash = 150000;
  s.company.bases.push('LEBL');
  s.company.loans.push({ id: 'L1' });
  s.company.insurance['EC-AAA'] = { excess: 0.1 };
  s.fleet.push(airframe('EC-AAA'), airframe('EC-AAB', { status: 'inFlight' }));
  s.network.airportsUnlocked.push('LEBL', 'LEPA');
  s.network.routesFlown.push('LEBL-LEPA');
  s.dispatch.queue.push({ id: 'D1', reg: 'EC-AAB', from: 'LEPA', to: 'LEBL',
    crewId: 'C1', departMinute: 600, ticketPrice: 89, rngCounter: 3 });
  s.clock.minute = 720;
  s.school.lessonsPassed.push('L1');
  s.school.attempts.L1 = 2;
  return s;
}

function errorsOf(s) { return validate(s).errors.join('\n'); }

describe('createCareer', () => {
  test('partida nova a l escola, amb els valors inicials', () => {
    const s = createCareer(OPTS);
    assert.equal(s.schemaVersion, SCHEMA_VERSION);
    assert.equal(s.balanceVersion, BALANCE.version);
    assert.equal(s.rngSeed, 12345);
    assert.equal(s.rngCounter, 0);
    assert.equal(s.createdAt, OPTS.createdAt);
    assert.deepEqual(s.pilot, { name: 'Marta', xp: 0, rank: 'student', ratings: [], endorsements: [], logbook: [] });
    assert.equal(s.company.cash, 0);
    assert.equal(s.company.reputation, 50);
    assert.deepEqual(s.company.bases, []);
    assert.deepEqual(s.fleet, []);
    assert.deepEqual(s.network, { airportsUnlocked: [], routesFlown: [] });
    assert.deepEqual(s.dispatch, { queue: [] });
    assert.deepEqual(s.clock, { minute: 0 });
    assert.deepEqual(s.school, { lessonsPassed: [], attempts: {}, graduated: false });
  });

  test('es valida i es JSON pur', () => {
    const s = createCareer(OPTS);
    assert.deepEqual(validate(s), { ok: true, errors: [] });
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  });

  test('es deterministica: mateixos arguments, mateix estat; objectes nous', () => {
    const a = createCareer(OPTS), b = createCareer(OPTS);
    assert.deepEqual(a, b);
    assert.notEqual(a.fleet, b.fleet);
  });

  test('no llanca amb arguments dolents i la llavor queda en 32 bits', () => {
    for (const bad of [undefined, null, 42, 'x', [], {}]) {
      assert.doesNotThrow(() => createCareer(bad));
      assert.ok(validate(createCareer(bad)).ok);
    }
    assert.equal(createCareer({ ...OPTS, seed: -1 }).rngSeed, 4294967295);
    assert.equal(createCareer({ ...OPTS, seed: NaN }).rngSeed, 0);
  });
});

describe('validate', () => {
  test('una partida plena es valida', () => {
    assert.deepEqual(validate(fullCareer()), { ok: true, errors: [] });
  });

  test('no llanca amb qualsevol cosa', () => {
    for (const bad of [undefined, null, 0, 'x', [], {}, { pilot: 1, fleet: 'x' }]) {
      const r = validate(bad);
      assert.equal(r.ok, false);
      assert.ok(r.errors.length > 0);
    }
  });

  test('diners enters', () => {
    const s = fullCareer(); s.company.cash = 100.5;
    assert.match(errorsOf(s), /company\.cash/);
    s.company.cash = -2000;            // en negatiu es permet: els deutes existeixen
    assert.ok(validate(s).ok);
    const t = fullCareer(); t.fleet[0].value = 1.5;
    assert.match(errorsOf(t), /fleet\[0\]\.value/);
    const u = fullCareer(); u.dispatch.queue[0].ticketPrice = 89.99;
    assert.match(errorsOf(u), /ticketPrice/);
  });

  test('reputacio entre 0 i 100', () => {
    for (const ok of [0, 50, 100, 73.5]) {
      const s = fullCareer(); s.company.reputation = ok;
      assert.ok(validate(s).ok, String(ok));
    }
    for (const bad of [-1, 100.1, NaN, '50', null]) {
      const s = fullCareer(); s.company.reputation = bad;
      assert.match(errorsOf(s), /company\.reputation/, String(bad));
    }
  });

  test('matricules uniques', () => {
    const s = fullCareer(); s.fleet[1].reg = 'EC-AAA';
    assert.match(errorsOf(s), /fleet\[1\]\.reg: matricula repetida EC-AAA/);
  });

  test('routesFlown en format AAAA-BBBB i ordre alfabetic', () => {
    for (const ok of ['LEBL-LEPA', 'GCLP-LEMD', 'LEBL-LEBL']) {
      const s = fullCareer(); s.network.routesFlown = [ok];
      assert.ok(validate(s).ok, ok);
    }
    for (const bad of ['LEPA-LEBL', 'lebl-lepa', 'LEBL_LEPA', 'LEBLLEPA', 'LEB-LEPA', 'LEBL-LEPA-', 42]) {
      const s = fullCareer(); s.network.routesFlown = [bad];
      assert.match(errorsOf(s), /routesFlown\[0\]/, String(bad));
    }
  });

  test('tipus de la seccio 5', () => {
    const cases = [
      [s => { s.schemaVersion = 2; }, /schemaVersion/],
      [s => { s.rngSeed = 2 ** 32; }, /rngSeed/],
      [s => { s.rngCounter = -1; }, /rngCounter/],
      [s => { s.createdAt = 0; }, /createdAt/],
      [s => { s.pilot.name = null; }, /pilot\.name/],
      [s => { s.pilot.ratings = ['tp', 3]; }, /pilot\.ratings/],
      [s => { s.pilot.logbook = [null]; }, /pilot\.logbook/],
      [s => { s.company.bases = ['BCN']; }, /company\.bases/],
      [s => { s.company.insurance = []; }, /company\.insurance/],
      [s => { delete s.fleet[0].condition.gear; }, /fleet\[0\]\.condition/],
      [s => { s.fleet[0].status = 'flying'; }, /fleet\[0\]\.status/],
      [s => { s.fleet[0].location = 'Barcelona'; }, /fleet\[0\]\.location/],
      [s => { s.fleet[0].finance.loanId = 7; }, /fleet\[0\]\.finance/],
      [s => { s.fleet[0].maintenance.deferred = 'x'; }, /fleet\[0\]\.maintenance/],
      [s => { s.dispatch.queue[0].departMinute = 1.5; }, /departMinute/],
      [s => { s.clock = { minute: -5 }; }, /clock\.minute/],
      [s => { s.school.graduated = 'no'; }, /school\.graduated/],
      [s => { s.school.attempts.L1 = -1; }, /school\.attempts/],
      [s => { s.network = null; }, /network: no es un objecte/]
    ];
    for (const [mutate, re] of cases) {
      const s = fullCareer(); mutate(s);
      const r = validate(s);
      assert.equal(r.ok, false, re.source);
      assert.match(r.errors.join('\n'), re);
    }
  });

  test('retorna tots els errors, no nomes el primer', () => {
    const s = fullCareer(); s.company.cash = 0.5; s.company.reputation = 200;
    assert.equal(validate(s).errors.length, 2);
  });
});

describe('migrate', () => {
  test('una partida actual i valida surt igual, en una copia', () => {
    const s = fullCareer();
    const m = migrate(s);
    assert.deepEqual(m, s);
    assert.notEqual(m, s);
    assert.notEqual(m.fleet, s.fleet);
  });

  test('no modifica l entrada', () => {
    const s = fullCareer(), before = JSON.stringify(s);
    migrate(s);
    assert.equal(JSON.stringify(s), before);
  });

  test('null si no es un objecte', () => {
    for (const bad of [undefined, null, 1, 'x', true, [], [fullCareer()]]) {
      assert.equal(migrate(bad), null);
    }
  });

  test('null si la versio es mes nova, absent o no valida', () => {
    for (const v of [SCHEMA_VERSION + 1, undefined, 0, -1, 1.5, '1']) {
      const s = fullCareer(); s.schemaVersion = v;
      assert.equal(migrate(s), null, String(v));
    }
  });

  test('null si no valida', () => {
    const s = fullCareer(); s.company.cash = 0.5;
    assert.equal(migrate(s), null);
  });

  test('no llanca amb objectes que no es poden copiar', () => {
    const s = fullCareer(); s.self = s;
    assert.equal(migrate(s), null);
    const t = fullCareer(); t.big = 1n;
    assert.equal(migrate(t), null);
  });
});

describe('needsBalanceUpdate', () => {
  test('false si coincideix amb BALANCE.version, true si no', () => {
    const s = createCareer(OPTS);
    assert.equal(needsBalanceUpdate(s), false);
    s.balanceVersion = BALANCE.version + 1;
    assert.equal(needsBalanceUpdate(s), true);
    s.balanceVersion = BALANCE.version - 1;
    assert.equal(needsBalanceUpdate(s), true);
  });

  test('no llanca amb qualsevol cosa', () => {
    for (const bad of [undefined, null, 1, 'x', []]) assert.equal(needsBalanceUpdate(bad), true);
  });
});

describe('exportJson i importJson', () => {
  test('anada i tornada sense perdues', () => {
    const s = fullCareer();
    const text = exportJson(s);
    assert.equal(typeof text, 'string');
    assert.deepEqual(importJson(text), s);
  });

  test('exportJson no valida: una partida trencada tambe s exporta', () => {
    const s = fullCareer(); s.company.cash = 0.5;
    const text = exportJson(s);
    assert.equal(typeof text, 'string');
    assert.equal(JSON.parse(text).company.cash, 0.5);
    assert.equal(importJson(text), null);
  });

  test('exportJson retorna null si no es serialitzable', () => {
    const s = fullCareer(); s.self = s;
    assert.equal(exportJson(s), null);
    assert.equal(exportJson(undefined), null);
  });

  test('importJson retorna null amb text dolent', () => {
    for (const bad of [undefined, null, 42, '', 'no json', '{', 'null', '[]', '"x"', '{}',
      JSON.stringify({ ...fullCareer(), schemaVersion: SCHEMA_VERSION + 1 })]) {
      assert.equal(importJson(bad), null, String(bad));
    }
  });
});
