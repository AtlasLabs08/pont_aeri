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
  rankForXp, nextRank, rankPayMult, dispatchLimits, flightXp, applyXp,
  canFlyType, purchaseRating, purchaseEndorsement, assessDamage,
  graduate, createCareer, validate, LESSONS, BALANCE
} from '../../src/career/index.js';

/** Pilot minim; over sobreescriu camps. */
const pilot = (over = {}) => ({
  name: 'Marc', xp: 0, rank: 'student', ratings: [], endorsements: [], logbook: [], ...over
});

/** Copia profunda per comprovar que la funcio no toca l entrada. */
const clone = o => JSON.parse(JSON.stringify(o));

describe('rankForXp', () => {
  // Llindars: student 0, private 600, commercial 1.100, atpl 1.500,
  // captain 1.950, instructor 2.550
  const cases = [
    [0, 'student'], [100, 'student'], [599, 'student'],
    [600, 'private'], [1099, 'private'],
    [1100, 'commercial'], [1499, 'commercial'],
    [1500, 'atpl'], [1949, 'atpl'],
    [1950, 'captain'], [2549, 'captain'],
    [2550, 'instructor'], [100000, 'instructor']
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
  test('1.000 XP (private) -> commercial, falten 100', () => {
    // 1.100 - 1.000 = 100
    assert.deepEqual(nextRank(1000), { key: 'commercial', xp: 1100, remaining: 100 });
  });

  test('0 XP -> private, falten 600', () => {
    assert.deepEqual(nextRank(0), { key: 'private', xp: 600, remaining: 600 });
  });

  test('just al llindar: el seguent, no el mateix', () => {
    // 1.500 es atpl; el seguent es captain, 1.950 - 1.500 = 450
    assert.deepEqual(nextRank(1500), { key: 'captain', xp: 1950, remaining: 450 });
  });

  test('rang mes alt -> null', () => {
    assert.equal(nextRank(2550), null);
    assert.equal(nextRank(100000), null);
  });

  test('xp negativa, no finita o no numerica llanca', () => {
    for (const xp of [-1, NaN, Infinity, undefined, null, '500']) {
      assert.throws(() => nextRank(xp), /nextRank: xp/, String(xp));
    }
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

  test('+20 a LEMH -> 22', () => {
    // 20 * (1 + 0,10) = 22
    assert.equal(flightXp({ ...base, destination: 'LEMH' }), 22);
  });

  test('arrodoniment a ,5: cap amunt', () => {
    // 5 * 1,3 = 6,5 -> 7; 15 * 1,3 = 19,5 -> 20
    assert.equal(flightXp({ ...base, landingXp: 5, turbulence: true }), 7);
    assert.equal(flightXp({ ...base, landingXp: 15, turbulence: true }), 20);
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

  test('turbulence o hardWeather no booleans llancen', () => {
    for (const v of [undefined, null, 0, 1, 'true']) {
      assert.throws(() => flightXp({ ...base, turbulence: v }), /turbulence/, String(v));
      assert.throws(() => flightXp({ ...base, hardWeather: v }), /hardWeather/, String(v));
    }
  });
});

describe('applyXp', () => {
  test('pujada: 590 + 16 = 606, de student a private', () => {
    const r = applyXp(pilot({ xp: 590 }), 16);
    assert.equal(r.pilot.xp, 606);
    assert.equal(r.pilot.rank, 'private');
    assert.equal(r.rankBefore, 'student');
    assert.equal(r.rankAfter, 'private');
    assert.equal(r.change, 'up');
  });

  test('sense canvi de rang: 700 + 20 = 720, change null', () => {
    const r = applyXp(pilot({ xp: 700, rank: 'private' }), 20);
    assert.equal(r.pilot.xp, 720);
    assert.deepEqual([r.rankBefore, r.rankAfter, r.change], ['private', 'private', null]);
  });

  test('pujada de mes d un rang de cop: 590 + 600 = 1.190, de student a commercial', () => {
    const r = applyXp(pilot({ xp: 590 }), 600);
    assert.equal(r.pilot.xp, 1190);
    assert.deepEqual([r.rankBefore, r.rankAfter, r.change], ['student', 'commercial', 'up']);
  });

  test('baixada just al llindar: 1.150 - 50 = 1.100 es queda a commercial', () => {
    const r = applyXp(pilot({ xp: 1150, rank: 'commercial' }), -50);
    assert.equal(r.pilot.xp, 1100);
    assert.deepEqual([r.rankBefore, r.rankAfter, r.change], ['commercial', 'commercial', null]);
  });

  test('un punt per sota del llindar: 1.150 - 51 = 1.099 baixa a private', () => {
    const r = applyXp(pilot({ xp: 1150, rank: 'commercial' }), -51);
    assert.equal(r.pilot.xp, 1099);
    assert.deepEqual([r.rankBefore, r.rankAfter, r.change], ['commercial', 'private', 'down']);
  });

  test('baixada per accident: 1.250 - 200 = 1.050, de commercial a private', () => {
    const r = applyXp(pilot({ xp: 1250, rank: 'commercial' }), -200);
    assert.equal(r.pilot.xp, 1050);
    assert.equal(r.pilot.rank, 'private');
    assert.deepEqual([r.rankBefore, r.rankAfter, r.change], ['commercial', 'private', 'down']);
  });

  test('baixada proporcional: 2.000 - 200 = 1.800, de captain a atpl (no mes avall)', () => {
    const r = applyXp(pilot({ xp: 2000, rank: 'captain' }), -200);
    assert.equal(r.pilot.xp, 1800);
    assert.deepEqual([r.rankBefore, r.rankAfter, r.change], ['captain', 'atpl', 'down']);
  });

  test('perdua d assessDamage: severitat 1 -> xpLoss 200, igual als dos modes', () => {
    // BALANCE.crash.xpLoss = [30, 200]; severitat 1 -> 200
    const record = { aircraftTypeId: 'nb', tailStrike: false, crashCause: 'fuselage', touchdown: null };
    for (const mode of ['own', 'contract']) {
      const { xpLoss } = assessDamage({ record, airframeValue: 8000000, mode, crashSeverity: 1 });
      assert.equal(xpLoss, 200, mode);
      const r = applyXp(pilot({ xp: 1250, rank: 'commercial' }), -xpLoss);
      assert.deepEqual([r.pilot.xp, r.pilot.rank], [1050, 'private'], mode);
    }
  });

  test('no baixa de 0: 100 - 200 -> 0, student', () => {
    const r = applyXp(pilot({ xp: 100 }), -200);
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

  test('pilot.xp negativa, no finita o no numerica llanca', () => {
    for (const xp of [-1, NaN, Infinity, undefined, null, '500']) {
      assert.throws(() => applyXp(pilot({ xp }), 10), /pilot\.xp/, String(xp));
    }
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
    const p = pilot({ xp: 1300, rank: 'commercial', ratings: ['commuter', 'turboprop'] });
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
    const r = purchaseRating(pilot({ xp: 650, rank: 'private' }), 25000, 'turboprop');
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

  test('unknown abans que owned: una clau desconeguda que el pilot ja te', () => {
    const p = pilot({ ratings: ['a380'] });
    assert.deepEqual(purchaseRating(p, 1e9, 'a380'), { ok: false, reason: 'unknown' });
  });

  test('owned', () => {
    const p = pilot({ xp: 650, rank: 'private', ratings: ['turboprop'] });
    assert.deepEqual(purchaseRating(p, 1e9, 'turboprop'), { ok: false, reason: 'owned' });
  });

  test('rank: widebody demana atpl i el pilot es commercial', () => {
    const p = pilot({ xp: 1499, rank: 'commercial' });
    assert.deepEqual(purchaseRating(p, 1e9, 'widebody'), { ok: false, reason: 'rank' });
  });

  test('rang superior al que demana: instructor pot comprar turboprop', () => {
    const r = purchaseRating(pilot({ xp: 3200, rank: 'instructor' }), 25000, 'turboprop');
    assert.equal(r.ok, true);
  });

  test('cash: 24.999 per a turboprop (25.000)', () => {
    const p = pilot({ xp: 650, rank: 'private' });
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

  test('unknown abans que owned: una clau desconeguda que el pilot ja te', () => {
    const p = pilot({ endorsements: ['aerobatics'] });
    assert.deepEqual(purchaseEndorsement(p, 1e9, 'aerobatics'), { ok: false, reason: 'unknown' });
  });

  test('cash no finit o rang desconegut llancen', () => {
    for (const cash of [NaN, Infinity, undefined, '30000']) {
      assert.throws(() => purchaseEndorsement(pilot(), cash, 'crosswind'), /purchaseEndorsement: cash/, String(cash));
    }
    assert.throws(() => purchaseEndorsement(pilot({ rank: 'general' }), 0, 'crosswind'), /rang desconegut/);
  });

  test('owned', () => {
    const p = pilot({ xp: 800, rank: 'private', endorsements: ['night'] });
    assert.deepEqual(purchaseEndorsement(p, 1e9, 'night'), { ok: false, reason: 'owned' });
  });

  test('rank: longHaul demana atpl i el pilot es commercial', () => {
    const p = pilot({ xp: 1250, rank: 'commercial' });
    assert.deepEqual(purchaseEndorsement(p, 1e9, 'longHaul'), { ok: false, reason: 'rank' });
  });

  test('cash: 59.999 per a lowVis (60.000)', () => {
    const p = pilot({ xp: 1250, rank: 'commercial' });
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

describe('graduate (C5, E2)', () => {
  const allPassed = () => LESSONS.map(l => l.id);
  const career = (school = {}) => {
    const s = createCareer({ name: 'Marc', seed: 7, createdAt: '2026-09-30T00:00:00.000Z' });
    return { ...s, school: { ...s.school, lessonsPassed: allPassed(), ...school } };
  };

  test('afegeix commuter una sola vegada i posa graduated', () => {
    const g = graduate(career());
    assert.deepEqual(g.pilot.ratings, ['commuter']);
    assert.equal(g.school.graduated, true);
    // si ja la tenia (no hauria de passar), no es duplica
    const s = career();
    const g2 = graduate({ ...s, pilot: { ...s.pilot, ratings: ['commuter'] } });
    assert.deepEqual(g2.pilot.ratings, ['commuter']);
  });

  test('suma exactament BALANCE.school.graduationXp i el rang surt de l XP', () => {
    const g = graduate(career());
    assert.equal(g.pilot.xp, BALANCE.school.graduationXp);
    assert.equal(g.pilot.rank, rankForXp(BALANCE.school.graduationXp));
    // amb XP previa que creua un llindar: 400 + 250 = 650 >= 600 (private)
    const s = career();
    const g2 = graduate({ ...s, pilot: { ...s.pilot, xp: 400 } });
    assert.equal(g2.pilot.xp, 400 + BALANCE.school.graduationXp);
    assert.equal(g2.pilot.rank, 'private');
  });

  test('no modifica l entrada i la resta de la partida no canvia', () => {
    const s = career(), before = clone(s);
    const g = graduate(s);
    assert.deepEqual(s, before);
    assert.deepEqual(g.company, s.company);
    assert.deepEqual(g.school.lessonsPassed, s.school.lessonsPassed);
    assert.ok(validate(g).ok);
  });

  test('llanca si canGraduate es fals', () => {
    const s = career({ lessonsPassed: allPassed().slice(0, -1) });
    assert.throws(() => graduate(s), /graduate/);
  });

  test('llanca si ja es graduat: no es pot graduar dos cops', () => {
    const g = graduate(career());
    assert.throws(() => graduate(g), /graduate/);
  });
});
