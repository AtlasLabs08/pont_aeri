/* Proves de career/crew.js (tasca B5): nombre maxim de tripulacions per
 * classe i contractacio. Els valors esperats son literals calculats a ma a
 * partir de BALANCE.rotation (perCrew 0,5; cap commuter 2,6, turboprop 2,6,
 * narrowbody 2,7, widebody 1,8) i BALANCE.crewHireCost (commuter 42.000,
 * turboprop 60.000, narrowbody 180.000, widebody 200.000).
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { maxCrew, hireCrew, computeFlightResult } from '../../src/career/index.js';

describe('maxCrew', () => {
  test('tripulacions que encara pugen el factor de rotacio', () => {
    // commuter: (2,6 - 1) / 0,5 = 3,2 -> 4; narrowbody: 3,4 -> 4; widebody: 1,6 -> 2
    assert.equal(maxCrew('commuter'), 4);
    assert.equal(maxCrew('turboprop'), 4);
    assert.equal(maxCrew('narrowbody'), 4);
    assert.equal(maxCrew('widebody'), 2);
  });

  test('la darrera tripulacio puja la rotacio i la seguent ja no', () => {
    // Sense ingressos ni aterratge, net = -K * r * costos: es proporcional a r
    const record = {
      aircraftTypeId: 'commuter', from: 'LEBL', to: 'LEPA', blockSeconds: 3600,
      fuelBurntKg: 300, fuelPlannedKg: 300, paxOnBoard: 0, arrivalDeltaMin: 0,
      skippedCruiseFuelKg: 0, touchdown: null, crashCause: null
    };
    const net = n => computeFlightResult({ record, mode: 'own', ticketPrice: 0, crewCount: n }).net;
    const n = maxCrew('commuter');
    assert.notEqual(net(n), net(n - 1));
    assert.equal(net(n + 1), net(n));
  });

  test('classe desconeguda llanca', () => {
    assert.throws(() => maxCrew('regional'), /classe desconeguda/);
    assert.throws(() => maxCrew('toString'), /classe desconeguda/);
  });
});

describe('hireCrew', () => {
  test('cas bo: la primera tripulacio del commuter costa 42.000', () => {
    assert.deepEqual(hireCrew({ cls: 'commuter', crewCount: 0, cash: 50000 }),
      { ok: true, cost: 42000, crewCount: 1 });
  });

  test('diners justos: 200.000 per a un widebody', () => {
    assert.deepEqual(hireCrew({ cls: 'widebody', crewCount: 1, cash: 200000 }),
      { ok: true, cost: 200000, crewCount: 2 });
  });

  test('cash: 59.999 per a un turbohelix (60.000)', () => {
    assert.deepEqual(hireCrew({ cls: 'turboprop', crewCount: 0, cash: 59999 }), { ok: false, reason: 'cash' });
  });

  test('max: el widebody ja en te 2', () => {
    assert.deepEqual(hireCrew({ cls: 'widebody', crewCount: 2, cash: 1e9 }), { ok: false, reason: 'max' });
  });

  test('max abans que cash', () => {
    assert.deepEqual(hireCrew({ cls: 'narrowbody', crewCount: 4, cash: 0 }), { ok: false, reason: 'max' });
  });

  test('entrades invalides llancen', () => {
    assert.throws(() => hireCrew({ cls: 'regional', crewCount: 0, cash: 1e6 }), /classe desconeguda/);
    assert.throws(() => hireCrew({ cls: 'commuter', crewCount: -1, cash: 1e6 }), /crewCount/);
    assert.throws(() => hireCrew({ cls: 'commuter', crewCount: 1.5, cash: 1e6 }), /crewCount/);
    assert.throws(() => hireCrew({ cls: 'commuter', crewCount: 0, cash: NaN }), /cash/);
  });
});
