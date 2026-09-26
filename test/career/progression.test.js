/* Proves de career/progression.js (tasca B4): rangs, XP per vol, pujades i
 * baixades, i compra d habilitacions i endorsements. Els valors esperats son
 * literals calculats a ma a partir de BALANCE.ranks, BALANCE.xpMultipliers,
 * BALANCE.airportDifficulty, BALANCE.ratings i BALANCE.endorsements, amb el
 * calcul al comentari.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  BALANCE, rankForXp, nextRank, rankPayMult, dispatchLimits, flightXp, applyXp,
  canFlyType, purchaseRating, purchaseEndorsement, assessDamage
} from '../../src/career/index.js';

/** Pilot minim; over sobreescriu camps. */
const pilot = (over = {}) => ({
  name: 'Marc', xp: 0, rank: 'student', ratings: [], endorsements: [], logbook: [], ...over
});

/** Copia profunda per comprovar que la funcio no toca l entrada. */
const clone = o => JSON.parse(JSON.stringify(o));

describe('BALANCE: coherencia del B4', () => {
  test('ratings i endorsements demanen rangs que existeixen i costen enters >= 0', () => {
    const ranks = BALANCE.ranks.map(r => r.key);
    for (const table of ['ratings', 'endorsements']) {
      for (const [key, item] of Object.entries(BALANCE[table])) {
        assert.ok(ranks.includes(item.rank), table + '.' + key + '.rank');
        assert.ok(Number.isInteger(item.cost) && item.cost >= 0, table + '.' + key + '.cost');
      }
    }
  });

  test('cada fleetType demana una rating que existeix', () => {
    for (const [id, ft] of Object.entries(BALANCE.fleetTypes)) {
      assert.ok(Object.hasOwn(BALANCE.ratings, ft.rating), id + '.rating');
    }
  });
});

describe('rankForXp', () => {
  // Llindars: student 0, private 500, commercial 2.000, atpl 6.000,
  // captain 15.000, instructor 35.000
  const cases = [
    [0, 'student'], [100, 'student'], [499, 'student'],
    [500, 'private'], [1999, 'private'],
    [2000, 'commercial'], [5999, 'commercial'],
    [6000, 'atpl'], [14999, 'atpl'],
    [15000, 'captain'], [34999, 'captain'],
    [35000, 'instructor'], [100000, 'instructor']
  ];
  for (const [xp, key] of cases) {
    test(xp + ' XP -> ' + key, () => assert.equal(rankForXp(xp), key));
  }

  test('xp negativa o no finita llanca', () => {
    assert.throws(() => rankForXp(-1), /xp/);
    assert.throws(() => rankForXp(NaN), /xp/);
    assert.throws(() => rankForXp(undefined), /xp/);
  });
});

describe('nextRank', () => {
  test('1.200 XP (private) -> commercial, falten 800', () => {
    // 2.000 - 1.200 = 800
    assert.deepEqual(nextRank(1200), { key: 'commercial', xp: 2000, remaining: 800 });
  });

  test('0 XP -> private, falten 500', () => {
    assert.deepEqual(nextRank(0), { key: 'private', xp: 500, remaining: 500 });
  });

  test('just al llindar: el seguent, no el mateix', () => {
    // 6.000 es atpl; el seguent es captain, 15.000 - 6.000 = 9.000
    assert.deepEqual(nextRank(6000), { key: 'captain', xp: 15000, remaining: 9000 });
  });

  test('rang mes alt -> null', () => {
    assert.equal(nextRank(35000), null);
    assert.equal(nextRank(100000), null);
  });
});

describe('rankPayMult i dispatchLimits', () => {
  test('valors de BALANCE.ranks', () => {
    assert.equal(rankPayMult('student'), 1.00);
    assert.equal(rankPayMult('commercial'), 1.55);
    assert.equal(rankPayMult('instructor'), 2.50);
    assert.deepEqual(dispatchLimits('student'), { slots: 0, pct: 0 });
    assert.deepEqual(dispatchLimits('atpl'), { slots: 5, pct: 0.40 });
  });

  test('clau desconeguda llanca', () => {
    assert.throws(() => rankPayMult('general'), /rang desconegut/);
    assert.throws(() => dispatchLimits('general'), /rang desconegut/);
    assert.throws(() => dispatchLimits(undefined), /rang desconegut/);
  });
});

describe('flightXp', () => {
  const base = { landingXp: 20, turbulence: false, hardWeather: false, destination: 'LEPA' };

  test('+20 sense res -> 20', () => {
    // LEPA no es a airportDifficulty: 20 * 1 * 1 * (1 + 0) = 20
    assert.equal(flightXp(base), 20);
  });

  test('+20 amb turbulencia -> 26', () => {
    // 20 * 1,3 = 26
    assert.equal(flightXp({ ...base, turbulence: true }), 26);
  });

  test('+20 amb meteo dura -> 28', () => {
    // 20 * 1,4 = 28
    assert.equal(flightXp({ ...base, hardWeather: true }), 28);
  });

  test('+20 amb turbulencia, meteo dura i LESU -> 55', () => {
    // 20 * 1,3 * 1,4 * (1 + 0,50) = 54,6 -> 55
    assert.equal(flightXp({ ...base, turbulence: true, hardWeather: true, destination: 'LESU' }), 55);
  });

  test('+12 a LELL -> 16', () => {
    // 12 * (1 + 0,30) = 15,6 -> 16
    assert.equal(flightXp({ ...base, landingXp: 12, destination: 'LELL' }), 16);
  });

  test('-8 amb turbulencia continua -8', () => {
    assert.equal(flightXp({ ...base, landingXp: -8, turbulence: true }), -8);
  });

  test('-35 amb tot i LESU continua -35; 0 continua 0', () => {
    const all = { turbulence: true, hardWeather: true, destination: 'LESU' };
    assert.equal(flightXp({ ...all, landingXp: -35 }), -35);
    assert.equal(flightXp({ ...all, landingXp: 0 }), 0);
  });

  test('landingXp no enter llanca', () => {
    assert.throws(() => flightXp({ ...base, landingXp: 20.5 }), /landingXp/);
    assert.throws(() => flightXp({ ...base, landingXp: undefined }), /landingXp/);
  });
});

describe('applyXp', () => {
  test('pujada: 480 + 26 = 506, de student a private', () => {
    const r = applyXp(pilot({ xp: 480 }), 26);
    assert.equal(r.pilot.xp, 506);
    assert.equal(r.pilot.rank, 'private');
    assert.equal(r.rankBefore, 'student');
    assert.equal(r.rankAfter, 'private');
    assert.equal(r.change, 'up');
  });

  test('sense canvi de rang: 600 + 20 = 620, change null', () => {
    const r = applyXp(pilot({ xp: 600, rank: 'private' }), 20);
    assert.equal(r.pilot.xp, 620);
    assert.deepEqual([r.rankBefore, r.rankAfter, r.change], ['private', 'private', null]);
  });

  test('baixada per accident: 2.100 - 1.500 = 600, de commercial a private', () => {
    const r = applyXp(pilot({ xp: 2100, rank: 'commercial' }), -1500);
    assert.equal(r.pilot.xp, 600);
    assert.equal(r.pilot.rank, 'private');
    assert.deepEqual([r.rankBefore, r.rankAfter, r.change], ['commercial', 'private', 'down']);
  });

  test('baixada proporcional: 15.200 - 1.500 = 13.700, de captain a atpl (no mes avall)', () => {
    const r = applyXp(pilot({ xp: 15200, rank: 'captain' }), -1500);
    assert.equal(r.pilot.xp, 13700);
    assert.deepEqual([r.rankBefore, r.rankAfter, r.change], ['captain', 'atpl', 'down']);
  });

  test('perdua d assessDamage: severitat 1 -> xpLoss 1.500, igual als dos modes', () => {
    // BALANCE.crash.xpLoss = [200, 1500]; severitat 1 -> 1.500
    const record = { aircraftTypeId: 'nb', tailStrike: false, crashCause: 'fuselage', touchdown: null };
    for (const mode of ['own', 'contract']) {
      const { xpLoss } = assessDamage({ record, airframeValue: 8000000, mode, crashSeverity: 1 });
      assert.equal(xpLoss, 1500, mode);
      const r = applyXp(pilot({ xp: 2100, rank: 'commercial' }), -xpLoss);
      assert.deepEqual([r.pilot.xp, r.pilot.rank], [600, 'private'], mode);
    }
  });

  test('no baixa de 0: 300 - 1.500 -> 0, student', () => {
    const r = applyXp(pilot({ xp: 300 }), -1500);
    assert.equal(r.pilot.xp, 0);
    assert.deepEqual([r.rankBefore, r.rankAfter, r.change], ['student', 'student', null]);
  });

  test('no modifica el pilot d entrada i en retorna un de nou', () => {
    const p = pilot({ xp: 480 });
    const before = clone(p);
    const r = applyXp(p, 26);
    assert.deepEqual(p, before);
    assert.notEqual(r.pilot, p);
  });

  test('delta no enter llanca', () => {
    assert.throws(() => applyXp(pilot(), 1.5), /delta/);
    assert.throws(() => applyXp(pilot(), NaN), /delta/);
    assert.throws(() => applyXp(pilot(), '20'), /delta/);
  });

  test('rang del pilot desconegut llanca', () => {
    assert.throws(() => applyXp(pilot({ rank: 'general' }), 10), /rang desconegut/);
  });
});

describe('canFlyType', () => {
  test('jumbo necessita quad, no widebody', () => {
    assert.equal(canFlyType(pilot({ ratings: ['widebody'] }), 'jumbo'), false);
    assert.equal(canFlyType(pilot({ ratings: ['quad'] }), 'jumbo'), true);
    assert.equal(canFlyType(pilot({ ratings: ['widebody'] }), 'wb'), true);
  });

  test('tp necessita turboprop', () => {
    assert.equal(canFlyType(pilot({ ratings: ['commuter'] }), 'tp'), false);
    assert.equal(canFlyType(pilot({ ratings: ['commuter', 'turboprop'] }), 'tp'), true);
  });

  test('tipus inexistent llanca', () => {
    assert.throws(() => canFlyType(pilot(), 'a380'), /typeId desconegut/);
    assert.throws(() => canFlyType(pilot(), 'toString'), /typeId desconegut/);
  });
});

describe('purchaseRating', () => {
  test('cas bo: narrowbody a commercial amb 150.000 -> cost 120.000', () => {
    const p = pilot({ xp: 2500, rank: 'commercial', ratings: ['commuter', 'turboprop'] });
    const before = clone(p);
    const r = purchaseRating(p, 150000, 'narrowbody');
    assert.deepEqual(r, {
      ok: true, cost: 120000,
      pilot: { ...before, ratings: ['commuter', 'turboprop', 'narrowbody'] }
    });
    assert.deepEqual(p, before, 'el pilot d entrada no es modifica');
    assert.notEqual(r.pilot.ratings, p.ratings);
  });

  test('diners justos: 25.000 per a turboprop -> ok', () => {
    const r = purchaseRating(pilot({ xp: 500, rank: 'private' }), 25000, 'turboprop');
    assert.equal(r.ok, true);
    assert.equal(r.cost, 25000);
  });

  test('commuter: inclosa, cost 0, rang student', () => {
    const r = purchaseRating(pilot(), 0, 'commuter');
    assert.equal(r.ok, true);
    assert.equal(r.cost, 0);
    assert.deepEqual(r.pilot.ratings, ['commuter']);
  });

  test('unknown', () => {
    assert.deepEqual(purchaseRating(pilot(), 1e9, 'a380'), { ok: false, reason: 'unknown' });
    assert.deepEqual(purchaseRating(pilot(), 1e9, 'toString'), { ok: false, reason: 'unknown' });
  });

  test('owned', () => {
    const p = pilot({ xp: 500, rank: 'private', ratings: ['turboprop'] });
    assert.deepEqual(purchaseRating(p, 1e9, 'turboprop'), { ok: false, reason: 'owned' });
  });

  test('rank: widebody demana atpl i el pilot es commercial', () => {
    const p = pilot({ xp: 5999, rank: 'commercial' });
    assert.deepEqual(purchaseRating(p, 1e9, 'widebody'), { ok: false, reason: 'rank' });
  });

  test('rang superior al que demana: instructor pot comprar turboprop', () => {
    const r = purchaseRating(pilot({ xp: 35000, rank: 'instructor' }), 25000, 'turboprop');
    assert.equal(r.ok, true);
  });

  test('cash: 24.999 per a turboprop (25.000)', () => {
    const p = pilot({ xp: 500, rank: 'private' });
    assert.deepEqual(purchaseRating(p, 24999, 'turboprop'), { ok: false, reason: 'cash' });
  });

  test('cash no finit o rang desconegut llancen', () => {
    assert.throws(() => purchaseRating(pilot(), NaN, 'commuter'), /cash/);
    assert.throws(() => purchaseRating(pilot({ rank: 'general' }), 0, 'commuter'), /rang desconegut/);
  });
});

describe('purchaseEndorsement', () => {
  test('cas bo: night a private amb 20.000 -> cost 15.000', () => {
    const p = pilot({ xp: 800, rank: 'private' });
    const before = clone(p);
    const r = purchaseEndorsement(p, 20000, 'night');
    assert.deepEqual(r, { ok: true, cost: 15000, pilot: { ...before, endorsements: ['night'] } });
    assert.deepEqual(p, before, 'el pilot d entrada no es modifica');
  });

  test('crosswind sense rang minim: un student el pot comprar amb 30.000', () => {
    const r = purchaseEndorsement(pilot(), 30000, 'crosswind');
    assert.equal(r.ok, true);
    assert.equal(r.cost, 30000);
    assert.deepEqual(r.pilot.endorsements, ['crosswind']);
  });

  test('unknown', () => {
    assert.deepEqual(purchaseEndorsement(pilot(), 1e9, 'aerobatics'), { ok: false, reason: 'unknown' });
  });

  test('owned', () => {
    const p = pilot({ xp: 800, rank: 'private', endorsements: ['night'] });
    assert.deepEqual(purchaseEndorsement(p, 1e9, 'night'), { ok: false, reason: 'owned' });
  });

  test('rank: longHaul demana atpl i el pilot es commercial', () => {
    const p = pilot({ xp: 2000, rank: 'commercial' });
    assert.deepEqual(purchaseEndorsement(p, 1e9, 'longHaul'), { ok: false, reason: 'rank' });
  });

  test('cash: 59.999 per a lowVis (60.000)', () => {
    const p = pilot({ xp: 2000, rank: 'commercial' });
    assert.deepEqual(purchaseEndorsement(p, 59999, 'lowVis'), { ok: false, reason: 'cash' });
  });

  test('els motius es comproven en ordre: owned abans que rank i cash', () => {
    // student, 0 EUR, ja te longHaul (atpl, 150.000): guanya owned
    const p = pilot({ endorsements: ['longHaul'] });
    assert.deepEqual(purchaseEndorsement(p, 0, 'longHaul'), { ok: false, reason: 'owned' });
    // student, 0 EUR, sense lowVis (commercial, 60.000): guanya rank
    assert.deepEqual(purchaseEndorsement(pilot(), 0, 'lowVis'), { ok: false, reason: 'rank' });
  });
});
