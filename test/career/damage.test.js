/* Proves de career/damage.js (tasca B3): factura de danys, accidents i
 * asseguranca. Els valors esperats son literals calculats a ma a partir de
 * BALANCE.damage, BALANCE.crash i BALANCE.insurance, amb el calcul al
 * comentari. Avio de 8.000.000 EUR a totes les proves.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { assessDamage, insurancePremium, insuranceSplit } from '../../src/career/index.js';

const VALUE = 8000000;

/** FlightRecord minim amb aterratge; over sobreescriu el record, td el touchdown. */
const record = (td = {}, over = {}) => ({
  aircraftTypeId: 'nb', tailStrike: false, crashCause: null,
  touchdown: { fpm: 300, g: 1.3, onRunway: true, score: 80, ...td },
  ...over
});

const assess = (rec, extra = {}) => assessDamage({ record: rec, airframeValue: VALUE, mode: 'own', ...extra });
const ids = rec => assess(rec).items.map(i => i.id);

describe('assessDamage: contacte', () => {
  test('criteri B3: nota 20 amb 850 fpm -> veryHard, 96.000 EUR, 3 dies', () => {
    // 0.012 * 8.000.000 = 96.000
    assert.deepEqual(assess(record({ fpm: 850, g: 1.8, score: 20 })), {
      items: [{ id: 'veryHard', cost: 96000, groundedDays: 3 }],
      cost: 96000, playerCost: 96000, groundedDays: 3, xpLoss: 0
    });
  });

  test('aterratge normal: cap item', () => {
    assert.deepEqual(assess(record()), { items: [], cost: 0, playerCost: 0, groundedDays: 0, xpLoss: 0 });
  });

  test('limit de 600 fpm: estricte', () => {
    assert.deepEqual(ids(record({ fpm: 600 })), []);
    // 0.0015 * 8.000.000 = 12.000
    assert.deepEqual(assess(record({ fpm: 601 })).items, [{ id: 'hardLanding', cost: 12000, groundedDays: 1 }]);
  });

  test('limit de 2.2 g: estricte', () => {
    assert.deepEqual(ids(record({ g: 2.2 })), []);
    assert.deepEqual(ids(record({ g: 2.21 })), ['hardLanding']);
  });

  test('limit de 800 fpm: hardLanding o veryHard, mai tots dos', () => {
    assert.deepEqual(ids(record({ fpm: 800 })), ['hardLanding']);
    assert.deepEqual(ids(record({ fpm: 801 })), ['veryHard']);
  });

  test('limit de 2.6 g', () => {
    assert.deepEqual(ids(record({ g: 2.6 })), ['hardLanding']);
    assert.deepEqual(ids(record({ g: 2.61 })), ['veryHard']);
  });

  test('fpm negatiu: compta la magnitud', () => {
    assert.deepEqual(ids(record({ fpm: -850 })), ['veryHard']);
  });

  test('veryHard + tailStrike + offRunway: cost sumat, dies el maxim', () => {
    // 0.012 * 8M = 96.000; 0.025 * 8M = 200.000; 0.005 * 8M = 40.000
    // cost = 336.000; dies = max(3, 5, 1) = 5
    const r = assess(record({ fpm: 850, onRunway: false }, { tailStrike: true }));
    assert.deepEqual(r.items, [
      { id: 'veryHard', cost: 96000, groundedDays: 3 },
      { id: 'tailStrike', cost: 200000, groundedDays: 5 },
      { id: 'offRunway', cost: 40000, groundedDays: 1 }
    ]);
    assert.equal(r.cost, 336000);
    assert.equal(r.playerCost, 336000);
    assert.equal(r.groundedDays, 5);
    assert.equal(r.xpLoss, 0);
  });

  test('sense touchdown ni accident: cap item', () => {
    assert.deepEqual(assess(record({}, { touchdown: null })).items, []);
  });

  test('tail strike sense touchdown ni accident: es factura', () => {
    // 0.025 * 8.000.000 = 200.000; 5 dies
    assert.deepEqual(assess(record({}, { touchdown: null, tailStrike: true })), {
      items: [{ id: 'tailStrike', cost: 200000, groundedDays: 5 }],
      cost: 200000, playerCost: 200000, groundedDays: 5, xpLoss: 0
    });
  });
});

describe('assessDamage: accident', () => {
  const crash = (s, td = {}, over = {}) =>
    assess(record(td, { crashCause: 'hardImpact', ...over }), { crashSeverity: s });

  test('severitat 0: el minim', () => {
    // 0.15 * 8M = 1.200.000; 14 dies; 200 XP
    assert.deepEqual(crash(0), {
      items: [{ id: 'crash', cost: 1200000, groundedDays: 14 }],
      cost: 1200000, playerCost: 1200000, groundedDays: 14, xpLoss: 200
    });
  });

  test('severitat 1: el maxim', () => {
    // 0.60 * 8M = 4.800.000; 45 dies; 1500 XP
    assert.deepEqual(crash(1), {
      items: [{ id: 'crash', cost: 4800000, groundedDays: 45 }],
      cost: 4800000, playerCost: 4800000, groundedDays: 45, xpLoss: 1500
    });
  });

  test('severitat 0.5: interpolat i arrodonit', () => {
    // pct = 0.15 + 0.45 * 0.5 = 0.375 -> 3.000.000
    // dies = 14 + 31 * 0.5 = 29.5 -> 30; XP = 200 + 1300 * 0.5 = 850
    const r = crash(0.5);
    assert.equal(r.cost, 3000000);
    assert.equal(r.groundedDays, 30);
    assert.equal(r.xpLoss, 850);
  });

  test('sense crashSeverity o fora de [0, 1]: Error', () => {
    assert.throws(() => assess(record({}, { crashCause: 'terrain' })), Error);
    assert.throws(() => crash(1.5), Error);
    assert.throws(() => crash(-0.1), Error);
    assert.throws(() => crash(NaN), Error);
  });

  test('accident amb nota alta i contacte dolent: nomes l item crash', () => {
    const r = crash(0, { score: 95, fpm: 900, onRunway: false }, { tailStrike: true });
    assert.deepEqual(r.items.map(i => i.id), ['crash']);
    assert.equal(r.cost, 1200000);
  });
});

describe('assessDamage: mode', () => {
  test('contract: playerCost 0, la resta igual', () => {
    const r = assess(record({ fpm: 850 }), { mode: 'contract' });
    assert.equal(r.playerCost, 0);
    assert.equal(r.cost, 96000);
    assert.equal(r.groundedDays, 3);
    assert.deepEqual(r.items, [{ id: 'veryHard', cost: 96000, groundedDays: 3 }]);
  });

  test('contract amb accident: playerCost 0, XP perduda igual', () => {
    const r = assess(record({}, { crashCause: 'water' }), { mode: 'contract', crashSeverity: 1 });
    assert.equal(r.playerCost, 0);
    assert.equal(r.xpLoss, 1500);
  });

  test('mode desconegut o valor invalid: Error', () => {
    assert.throws(() => assess(record(), { mode: 'lease' }), Error);
    assert.throws(() => assess(record(), { airframeValue: -1 }), Error);
    assert.throws(() => assess(record(), { airframeValue: NaN }), Error);
  });
});

describe('insurancePremium', () => {
  test('0.12 % del valor per vol', () => {
    // 0.0012 * 8.000.000 = 9.600
    assert.equal(insurancePremium(VALUE), 9600);
  });
});

describe('insuranceSplit', () => {
  test('per sota de la franquicia: ho paga tot el jugador', () => {
    // franquicia 0.05 * 8M = 400.000 > 96.000
    assert.deepEqual(insuranceSplit(96000, VALUE, 0.05), { player: 96000, insurer: 0 });
  });

  test('per sobre de la franquicia: la resta la paga l asseguradora', () => {
    // 0.05 * 8M = 400.000; 1.200.000 - 400.000 = 800.000
    assert.deepEqual(insuranceSplit(1200000, VALUE, 0.05), { player: 400000, insurer: 800000 });
    // 0.25 * 8M = 2.000.000; 4.800.000 - 2.000.000 = 2.800.000
    assert.deepEqual(insuranceSplit(4800000, VALUE, 0.25), { player: 2000000, insurer: 2800000 });
  });

  test('just a la franquicia: 0 per a l asseguradora', () => {
    // 0.10 * 8M = 800.000
    assert.deepEqual(insuranceSplit(800000, VALUE, 0.10), { player: 800000, insurer: 0 });
  });

  test('excessPct invalid: Error', () => {
    assert.throws(() => insuranceSplit(1000, VALUE, 0.07), Error);
    assert.throws(() => insuranceSplit(1000, VALUE, undefined), Error);
  });
});
