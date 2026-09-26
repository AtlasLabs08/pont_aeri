/* Proves de career/wear.js (tasca B3): dia d operacio, desgast per vol,
 * probabilitat d avaria i revisions. Els valors esperats son literals
 * calculats a ma a partir de BALANCE, amb el calcul al comentari.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { flightDay, applyFlightWear, failureChance, checksDue, performCheck } from '../../src/career/index.js';

/** Avio de proves: widebody de 8.000.000 EUR amb tot a 100. */
function airframe(over = {}) {
  return {
    reg: 'EC-AAA', typeId: 'wb', yearBuilt: 2010, hours: 1000, cycles: 500,
    condition: { engines: 100, gear: 100, airframe: 100, avionics: 100 },
    location: 'LEBL', status: 'ready', groundedUntilMinute: 0,
    maintenance: { nextAHours: 1500, nextCHours: 6000, deferred: [] },
    finance: { purchasePrice: 8000000, loanId: null, leaseId: null },
    value: 8000000,
    ...over
  };
}

/** Vol de 45 min (2700 s) amb aterratge a fpm. */
const record = (fpm, over = {}) => ({
  aircraftTypeId: 'wb', blockSeconds: 2700,
  touchdown: { fpm, g: 1.3, onRunway: true }, ...over
});

/** abs(a - b) < 1e-12 */
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, a + ' != ' + b);

describe('flightDay', () => {
  test('vol nb de 45 min: un dia de 11 h i 15 cicles', () => {
    // hours = max(11, 2700 / 3600 = 0.75) = 11; tram = max(0.75, minLeg 0.75) = 0.75
    // cycles = round(11 / 0.75 = 14.67) = 15
    assert.deepEqual(flightDay({ blockSeconds: 2700 }, 'narrowbody'), { hours: 11, cycles: 15 });
  });

  test('vols nb curts: el tram minim limita a 15 cicles', () => {
    // 1, 60 i 300 s son menys que minLeg 0.75 h: cycles = round(11 / 0.75) = 15
    for (const s of [1, 60, 300]) {
      assert.deepEqual(flightDay({ blockSeconds: s }, 'narrowbody'), { hours: 11, cycles: 15 }, s + ' s');
    }
  });

  test('blockSeconds 0 en un nb: igual que un tram minim, 15 cicles', () => {
    assert.deepEqual(flightDay({ blockSeconds: 0 }, 'narrowbody'), { hours: 11, cycles: 15 });
  });

  test('vol mes llarg que el dia: les hores de bloc i 1 cicle', () => {
    // wb, 15 h: hours = max(14, 15) = 15; cycles = max(1, round(15 / 15)) = 1
    assert.deepEqual(flightDay({ blockSeconds: 54000 }, 'widebody'), { hours: 15, cycles: 1 });
  });

  test('blockSeconds 0 en un tp: el dia de la classe en trams minims', () => {
    // hours = 9; cycles = round(9 / minLeg 0.6) = 15
    assert.deepEqual(flightDay({ blockSeconds: 0 }, 'turboprop'), { hours: 9, cycles: 15 });
  });

  test('classe desconeguda: Error', () => {
    assert.throws(() => flightDay({ blockSeconds: 2700 }, 'zeppelin'), Error);
  });
});

describe('applyFlightWear', () => {
  test('vol wb de 45 min amb aterratge de 300 fpm: sense extra de tren', () => {
    // flightDay: hours = 14; tram = max(0.75, minLeg 1.5) = 1.5; cycles = round(14 / 1.5 = 9.33) = 9
    // engines  100 - 0.0075 * 14 = 99.895 -> 99.9
    // avionics 100 - 0.05 * 14   = 99.3
    // airframe 100 - 0.005 * 9   = 99.955 -> 100
    // gear     100 - 0.02 * 9    = 99.82  -> 99.8   (300 fpm = gearFreeFpm, extra 0)
    // cycleCost = 9 * 300 = 2700
    const { airframe: a, cycleCost } = applyFlightWear(airframe(), record(300));
    assert.deepEqual(a.condition, { engines: 99.9, gear: 99.8, airframe: 100, avionics: 99.3 });
    assert.equal(a.hours, 1014);     // 1000 + 14
    assert.equal(a.cycles, 509);     // 500 + 9
    assert.equal(cycleCost, 2700);
  });

  test('aterratge de 500 fpm: el tren perd 2 punts mes; el signe de fpm no compta', () => {
    // gear 100 - 0.02 * 9 - 0.01 * (500 - 300) = 100 - 0.18 - 2 = 97.82 -> 97.8
    assert.equal(applyFlightWear(airframe(), record(500)).airframe.condition.gear, 97.8);
    assert.equal(applyFlightWear(airframe(), record(-500)).airframe.condition.gear, 97.8);
  });

  test('aterratge a 1.6 g: el tren no perd res per g', () => {
    // gear 100 - 0.02 * 9 - 5 * max(0, 1.6 - 1.6) = 99.82 -> 99.8
    const rec = record(300, { touchdown: { fpm: 300, g: 1.6, onRunway: true } });
    assert.equal(applyFlightWear(airframe(), rec).airframe.condition.gear, 99.8);
  });

  test('aterratge a 2.2 g: el tren perd 3 punts mes', () => {
    // gear 100 - 0.02 * 9 - 5 * (2.2 - 1.6) = 100 - 0.18 - 3 = 96.82 -> 96.8
    const rec = record(300, { touchdown: { fpm: 300, g: 2.2, onRunway: true } });
    assert.equal(applyFlightWear(airframe(), rec).airframe.condition.gear, 96.8);
  });

  test('sense touchdown: nomes el desgast per cicle', () => {
    assert.equal(applyFlightWear(airframe(), record(0, { touchdown: null })).airframe.condition.gear, 99.8);
  });

  test('no modifica l objecte d entrada', () => {
    const input = airframe();
    const before = structuredClone(input);
    const { airframe: a } = applyFlightWear(input, record(900));
    assert.deepEqual(input, before);
    assert.notEqual(a, input);
    assert.notEqual(a.condition, input.condition);
    assert.notEqual(a.maintenance, input.maintenance);
  });

  test('condicions retallades a 0', () => {
    // tot a 0.01; el desgast de cada sistema es mes gran que 0.01
    const low = airframe({ condition: { engines: 0.01, gear: 0.01, airframe: 0.01, avionics: 0.01 } });
    const { airframe: a } = applyFlightWear(low, record(2000));
    assert.deepEqual(a.condition, { engines: 0, gear: 0, airframe: 0, avionics: 0 });
  });

  test('jumbo: passa per widebody', () => {
    // BALANCE.fleetTypes.jumbo.cls = 'widebody': mateix calcul que el wb de 45 min
    // hours = 14; cycles = round(14 / 1.5) = 9; cycleCost = 9 * 300 = 2700
    const { airframe: a, cycleCost } =
      applyFlightWear(airframe({ typeId: 'jumbo' }), record(300, { aircraftTypeId: 'jumbo' }));
    assert.deepEqual(a.condition, { engines: 99.9, gear: 99.8, airframe: 100, avionics: 99.3 });
    assert.equal(a.hours, 1014);
    assert.equal(a.cycles, 509);
    assert.equal(cycleCost, 2700);
  });

  test('typeId desconegut: Error', () => {
    assert.throws(() => applyFlightWear(airframe({ typeId: 'zeppelin' }), record(300)), Error);
  });

  test('blockSeconds no finit o negatiu: Error', () => {
    for (const blockSeconds of [undefined, NaN, Infinity, -1]) {
      assert.throws(() => applyFlightWear(airframe(), record(300, { blockSeconds })), Error, String(blockSeconds));
    }
  });

  test('aircraftTypeId del record diferent del typeId de l avio: Error', () => {
    assert.throws(() => applyFlightWear(airframe(), record(300, { aircraftTypeId: 'nb' })), Error);
  });

  test('touchdown amb fpm no finit: Error', () => {
    assert.throws(() => applyFlightWear(airframe(), record(NaN)), Error);
  });

  test('touchdown amb g no finita: Error', () => {
    const rec = record(300, { touchdown: { fpm: 300, g: NaN, onRunway: true } });
    assert.throws(() => applyFlightWear(airframe(), rec), Error);
  });
});

describe('failureChance', () => {
  test('70: 0', () => assert.equal(failureChance(70), 0));

  test('69: gairebe pAtThreshold', () => {
    // x = (70 - 69) / (70 - 20) = 0.02; 0.002 + 0.078 * 0.0004 = 0.0020312
    near(failureChance(69), 0.0020312);
  });

  test('20: pAtRef', () => {
    // x = 1; 0.002 + 0.078 = 0.08
    near(failureChance(20), 0.08);
  });

  test('10: la corba continua per sota de refCondition', () => {
    // x = 60 / 50 = 1.2; 0.002 + 0.078 * 1.44 = 0.11432
    near(failureChance(10), 0.11432);
  });

  test('per sobre del llindar: 0', () => assert.equal(failureChance(100), 0));
});

describe('checksDue', () => {
  const at = (hours, nextAHours, nextCHours) =>
    checksDue(airframe({ hours, maintenance: { nextAHours, nextCHours, deferred: [] } }));

  test('limits: just per sota, just al punt', () => {
    assert.deepEqual(at(499.9, 500, 6000), []);
    assert.deepEqual(at(500, 500, 6000), ['A']);
    assert.deepEqual(at(5999.9, 6500, 6000), []);
    assert.deepEqual(at(6000, 6500, 6000), ['C']);
    assert.deepEqual(at(6000, 6000, 6000), ['A', 'C']);
  });
});

describe('performCheck', () => {
  const worn = () => airframe({
    hours: 500,
    condition: { engines: 60, gear: 90, airframe: 70, avionics: 50 },
    maintenance: { nextAHours: 500, nextCHours: 6000, deferred: [] }
  });

  test('A amb el tren a 90: queda a 100, no 110', () => {
    // restore avionics 100; boost gear 90 + 20 = 110 -> 100
    // cost = 0.008 * 8.000.000 = 64.000; nextAHours = 500 + 500 = 1000
    const input = worn();
    const before = structuredClone(input);
    const r = performCheck(input, 'A');
    assert.deepEqual(r.airframe.condition, { engines: 60, gear: 100, airframe: 70, avionics: 100 });
    assert.equal(r.cost, 64000);
    assert.equal(r.groundedDays, 1);
    assert.deepEqual(r.airframe.maintenance, { nextAHours: 1000, nextCHours: 6000, deferred: [] });
    assert.deepEqual(input, before);
  });

  test('A amb el tren a 70.3: boost de 20 fins a 90.3', () => {
    const r = performCheck(airframe({ condition: { engines: 60, gear: 70.3, airframe: 70, avionics: 50 } }), 'A');
    assert.equal(r.airframe.condition.gear, 90.3);
  });

  test('C: cellula, tren i avionica a 100; motors intactes', () => {
    // cost = 0.04 * 8.000.000 = 320.000; nextCHours = 500 + 6000 = 6500
    const r = performCheck(worn(), 'C');
    assert.deepEqual(r.airframe.condition, { engines: 60, gear: 100, airframe: 100, avionics: 100 });
    assert.equal(r.cost, 320000);
    assert.equal(r.groundedDays, 10);
    assert.deepEqual(r.airframe.maintenance, { nextAHours: 500, nextCHours: 6500, deferred: [] });
  });

  test('engine: motors a 100, sense comptador', () => {
    // cost = 0.03 * 8.000.000 = 240.000
    const r = performCheck(worn(), 'engine');
    assert.deepEqual(r.airframe.condition, { engines: 100, gear: 90, airframe: 70, avionics: 50 });
    assert.equal(r.cost, 240000);
    assert.equal(r.groundedDays, 5);
    assert.deepEqual(r.airframe.maintenance, worn().maintenance);
  });

  test('revisio desconeguda: Error', () => {
    assert.throws(() => performCheck(worn(), 'B'), Error);
  });
});
