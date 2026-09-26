/* Proves de career/balance.js (tasca B1): coherencia interna de BALANCE.
 * No comproven els valors concrets, sino que les taules tinguin sentit:
 * ordres, monotonia, numeros finits i objecte congelat.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, createCareer } from '../../src/career/index.js';
import { AIRCRAFT_ORDER } from '../../src/core/index.js';

/** Parelles [cami, valor] de totes les fulles de obj. */
function leaves(obj, at = 'BALANCE') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = Array.isArray(obj) ? at + '[' + k + ']' : at + '.' + k;
    return v !== null && typeof v === 'object' ? leaves(v, path) : [[path, v]];
  });
}

/** Parelles [cami, objecte] de obj i de tots els objectes i llistes de dins. */
function containers(obj, at = 'BALANCE') {
  return [[at, obj], ...Object.entries(obj).flatMap(([k, v]) => {
    const path = Array.isArray(obj) ? at + '[' + k + ']' : at + '.' + k;
    return v !== null && typeof v === 'object' ? containers(v, path) : [];
  })];
}

/** Recorre parelles consecutives de list i crida fn(anterior, seguent, i). */
function pairs(list, fn) {
  for (let i = 1; i < list.length; i++) fn(list[i - 1], list[i], i);
}

describe('BALANCE', () => {
  test('versio i reputacio inicial', () => {
    assert.ok(Number.isInteger(BALANCE.version) && BALANCE.version >= 1);
    assert.ok(BALANCE.reputation.start >= 0 && BALANCE.reputation.start <= 100);
    assert.equal(createCareer({ name: 'x', seed: 1, createdAt: '' }).company.reputation,
      BALANCE.reputation.start);
  });

  test('tots els valors numerics son finits, i K > 0', () => {
    const nums = leaves(BALANCE).filter(([, v]) => typeof v === 'number');
    assert.ok(nums.length > 0);
    for (const [path, v] of nums) assert.ok(Number.isFinite(v), path);
    assert.ok(BALANCE.K > 0);
  });

  test('landingBands: min de mes gran a mes petit, l ultim amb min 0', () => {
    const b = BALANCE.landingBands;
    assert.ok(b.length > 0);
    pairs(b, (hi, lo, i) => assert.ok(hi.min > lo.min, 'landingBands[' + i + '].min'));
    assert.equal(b[b.length - 1].min, 0);
  });

  test('landingBands: mult i xp mai pugen en baixar de tram', () => {
    pairs(BALANCE.landingBands, (hi, lo, i) => {
      assert.ok(lo.mult <= hi.mult, 'landingBands[' + i + '].mult');
      assert.ok(lo.xp <= hi.xp, 'landingBands[' + i + '].xp');
    });
  });

  test('landingBands: cada tram te una clau i18n unica', () => {
    const keys = BALANCE.landingBands.map(b => b.key);
    for (const k of keys) assert.match(k, /^landing\.\w+$/);
    assert.equal(new Set(keys).size, keys.length);
  });

  test('ranks: xp estrictament creixent, comencant a 0', () => {
    const r = BALANCE.ranks;
    assert.equal(r[0].xp, 0);
    pairs(r, (lo, hi, i) => assert.ok(hi.xp > lo.xp, 'ranks[' + i + '].xp'));
  });

  test('ranks: payMult, slots i dispatchPct mai baixen en pujar de rang', () => {
    pairs(BALANCE.ranks, (lo, hi, i) => {
      for (const k of ['payMult', 'slots', 'dispatchPct']) {
        assert.ok(hi[k] >= lo[k], 'ranks[' + i + '].' + k);
      }
    });
  });

  test('crash: minPct < maxPct', () => {
    assert.ok(BALANCE.crash.minPct < BALANCE.crash.maxPct);
  });

  test('insurance: excessOptions en ordre creixent', () => {
    pairs(BALANCE.insurance.excessOptions, (a, b, i) =>
      assert.ok(b > a, 'excessOptions[' + i + ']'));
  });

  test('fleetTypes: un per avio, amb classe coneguda i seients enters', () => {
    assert.deepEqual(Object.keys(BALANCE.fleetTypes).sort(), [...AIRCRAFT_ORDER].sort());
    for (const [id, ft] of Object.entries(BALANCE.fleetTypes)) {
      for (const table of ['crewRatePerBlockHour', 'maintAccrualPerHour', 'contractFeePerLeg']) {
        assert.ok(ft.cls in BALANCE[table], id + ' -> ' + table + '.' + ft.cls);
      }
      assert.ok(ft.cls in BALANCE.rotation.cap, id + ' -> rotation.cap.' + ft.cls);
      assert.ok(Number.isInteger(ft.seats) && ft.seats > 0, id + '.seats');
    }
  });

  test('demand.hours: intervals [inici, fi) dins del dia i sense solapar-se', () => {
    const all = [...BALANCE.demand.hours.peak, ...BALANCE.demand.hours.off].sort((a, b) => a[0] - b[0]);
    for (const [a, b] of all) assert.ok(a >= 0 && a < b && b <= 24 * 60, a + '-' + b);
    pairs(all, (lo, hi, i) => assert.ok(hi[0] >= lo[1], 'interval ' + i));
  });

  test('airportSize, routeExceptions i airportDifficulty coherents', () => {
    const w = BALANCE.demand.sizeWeight;
    assert.ok('small' in w);
    for (const [icao, size] of Object.entries(BALANCE.airportSize)) {
      assert.match(icao, /^[A-Z0-9]{4}$/); assert.ok(size in w, icao);
    }
    for (const [key, ex] of Object.entries(BALANCE.routeExceptions)) {
      const m = key.match(/^([A-Z0-9]{4})-([A-Z0-9]{4})$/);
      assert.ok(m && m[1] < m[2], key + ': ordre alfabetic');
      if ('kind' in ex) assert.ok(ex.kind in BALANCE.demand.elasticity, key + '.kind');
    }
    for (const [icao, d] of Object.entries(BALANCE.airportDifficulty)) assert.ok(d >= 0, icao);
  });

  test('BALANCE i tots els seus objectes i llistes estan congelats', () => {
    const all = containers(BALANCE);
    assert.ok(all.length > 1);
    for (const [path, o] of all) assert.ok(Object.isFrozen(o), path);
  });

  test('modificar-lo llanca en mode estricte i no canvia res', () => {
    const before = JSON.stringify(BALANCE);
    assert.throws(() => { BALANCE.K = 99; }, TypeError);
    assert.throws(() => { BALANCE.startingLoan.principal = 1; }, TypeError);
    assert.throws(() => { BALANCE.landingBands[0].mult = 9; }, TypeError);
    assert.throws(() => { BALANCE.ranks.push({}); }, TypeError);
    assert.throws(() => { BALANCE.crash.groundedDays[0] = 1; }, TypeError);
    assert.throws(() => { BALANCE.reputation.start = 0; }, TypeError);
    assert.equal(JSON.stringify(BALANCE), before);
  });
});
