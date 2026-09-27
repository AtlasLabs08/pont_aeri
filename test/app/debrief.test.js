/* Proves de app/debrief.js (tasca C4): cada fila al llindar del 70 % exacte,
 * les penalitzacions de rebots i tail strike.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { debriefRows, BOUNCE_PENALTY_PTS, TAIL_STRIKE_PENALTY_PTS } from '../../src/app/debrief.js';

const ptsMax = { sink: 35, g: 15, zone: 20, center: 20, attitude: 10 };

/** Touchdown minim; over sobreescriu camps. */
const touchdown = (over = {}) => ({
  fpm: -150, g: 1.2, bounces: 0, onRunway: true, rwy: '24L', tdzDist: 100,
  center: 1, crab: 0, remaining: 1500, ias: 130, pitch: 2, roll: 2, score: 85,
  pts: { sink: 30, g: 12, zone: 16, center: 15, attitude: 8 }, ...over
});

describe('debriefRows: 5 components graduats', () => {
  const cases = [
    ['sink', 'fpm'], ['g', 'g'], ['zone', 'tdzDist'], ['center', 'center'], ['attitude', 'roll']
  ];
  for (const [component, measuredField] of cases) {
    test(component + ': ok exactament al 70 % dels punts maxims', () => {
      const max = ptsMax[component];
      const okTd = touchdown({ pts: { ...touchdown().pts, [component]: max * 0.7 } });
      const koTd = touchdown({ pts: { ...touchdown().pts, [component]: max * 0.7 - 0.001 } });
      const rowsOk = debriefRows(okTd, { tailStrike: false, ptsMax });
      const rowsKo = debriefRows(koTd, { tailStrike: false, ptsMax });
      const rOk = rowsOk.find(r => r.component === component), rKo = rowsKo.find(r => r.component === component);
      assert.equal(rOk.ok, true);
      assert.equal(rKo.ok, false);
      assert.equal(rOk.measured, okTd[measuredField]);
      assert.equal(rOk.ptsMax, max);
    });
  }

  test('zone i center: n hi ha mesura fora de pista', () => {
    const td = touchdown({ onRunway: false, tdzDist: null, center: null, pts: { sink: 30, g: 12, zone: 0, center: 0, attitude: 8 } });
    const rows = debriefRows(td, { tailStrike: false, ptsMax });
    assert.equal(rows.find(r => r.component === 'zone').measured, null);
    assert.equal(rows.find(r => r.component === 'center').measured, null);
  });
});

describe('debriefRows: rebots i tail strike', () => {
  test('rebots: -8 pts per rebot', () => {
    const rows = debriefRows(touchdown({ bounces: 3 }), { tailStrike: false, ptsMax });
    const r = rows.find(x => x.component === 'bounces');
    assert.equal(r.count, 3);
    assert.equal(r.penaltyPts, 3 * BOUNCE_PENALTY_PTS);
    assert.equal(BOUNCE_PENALTY_PTS, 8);
  });

  test('sense rebots: cap penalitzacio', () => {
    const r = debriefRows(touchdown(), { tailStrike: false, ptsMax }).find(x => x.component === 'bounces');
    assert.equal(r.penaltyPts, 0);
  });

  test('tail strike: -15 pts', () => {
    const rows = debriefRows(touchdown(), { tailStrike: true, ptsMax });
    const r = rows.find(x => x.component === 'tailStrike');
    assert.equal(r.present, true);
    assert.equal(r.penaltyPts, TAIL_STRIKE_PENALTY_PTS);
    assert.equal(TAIL_STRIKE_PENALTY_PTS, 15);
  });

  test('sense tail strike: cap penalitzacio', () => {
    const r = debriefRows(touchdown(), { tailStrike: false, ptsMax }).find(x => x.component === 'tailStrike');
    assert.equal(r.present, false);
    assert.equal(r.penaltyPts, 0);
  });
});

describe('debriefRows: no genera cap frase final', () => {
  test('nomes 7 files, sense comment ni resum', () => {
    const rows = debriefRows(touchdown(), { tailStrike: false, ptsMax });
    assert.equal(rows.length, 7);
    for (const r of rows) assert.equal(Object.hasOwn(r, 'comment'), false);
  });
});
