/* Proves de career/school.js i career/lessons.js (tasca C1): criteris de
 * cada llico just al limit, la gracia de la llico 7, els check-rides, els
 * fets del FlightRecord i la coherencia de les dades. Els llindars de la
 * llico 7 surten de BALANCE.school (passScore 45, mercyScore 30,
 * mercyAttempt 3).
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  BALANCE, METRICS, LESSONS, CHECK_RIDES, SCHOOL_PASS, factsFromRecord, evaluate,
  isLessonAvailable, recordLessonAttempt, canGraduate, evaluateCheckRide
} from '../../src/career/index.js';
import { AIRCRAFT } from '../../src/core/index.js';
import en from '../../src/i18n/en.js';
import ca from '../../src/i18n/ca.js';

/** school buit; over sobreescriu camps. */
const school = (over = {}) => ({ lessonsPassed: [], attempts: {}, graduated: false, ...over });

/** Copia profunda per comprovar que la funcio no toca l entrada. */
const clone = o => JSON.parse(JSON.stringify(o));

/** Intent de la llico lessonId amb un school buit. */
const attemptOf = (lessonId, facts) => recordLessonAttempt(school(), lessonId, facts);

/** FlightRecord minim amb touchdown; over sobreescriu camps. */
const record = (over = {}) => ({
  aircraftTypeId: 'commuter', from: 'LEBL', to: 'LEPA', blockSeconds: 1800,
  airborneSeconds: 1500, fuelBurntKg: 300, fuelPlannedKg: 350, paxOnBoard: 0,
  maxAltFt: 4500, maxG: 1.3, maxBankDeg: 25, abruptInputs: 0, timeAccelMax: 1,
  usedCruiseSkip: false, skippedCruiseFuelKg: 0, arrivalDeltaMin: 0,
  touchdown: {
    fpm: -180, g: 1.2, bounces: 1, onRunway: true, rwy: '24L', tdzDist: 400,
    center: 2, crab: 1, remaining: 1800, ias: 110, pitch: 3, roll: 0, score: 82,
    pts: { sink: 30, g: 20, zone: 15, center: 10, attitude: 7 }
  },
  rolloutMetres: 700, tailStrike: false, crashCause: null, events: [],
  ...over
});

describe('llicons: cada criteri just al limit', () => {
  const cases = [
    ['exterior', { viewsVisited: 4 }, { viewsVisited: 3 }],
    ['cockpit', { controlsIdentified: 6 }, { controlsIdentified: 5 }],
    ['taxi', { reachedThreshold: true }, { reachedThreshold: false }],
    ['takeoff', { maxAltFt: 3000, gearUp: true }, { maxAltFt: 2999, gearUp: true }],
    ['takeoff', { maxAltFt: 3000, gearUp: true }, { maxAltFt: 3000, gearUp: false }],
    ['maneuvers', { altDeviationMaxFt: 200 }, { altDeviationMaxFt: 201 }],
    ['circuit', { stabilizedOnFinal: true }, { stabilizedOnFinal: false }],
    ['landing', { landed: true, score: 45 }, { landed: true, score: 44 }],
    ['landing', { landed: true, score: 45 }, { landed: false, score: 45 }],
    ['ils', { landed: true, onRunway: true }, { landed: true, onRunway: false }],
    ['ils', { landed: true, onRunway: true }, { landed: false, onRunway: true }]
  ];
  for (const [id, ok, ko] of cases) {
    test(id + ': ' + JSON.stringify(ok) + ' passa, ' + JSON.stringify(ko) + ' falla', () => {
      assert.equal(attemptOf(id, { crashed: false, ...ok }).passed, true);
      assert.equal(attemptOf(id, { crashed: false, ...ko }).passed, false);
    });
  }
});

describe('llico 7: gracia a partir del tercer intent', () => {
  test('45 al primer intent passa amb mercy false', () => {
    const r = attemptOf('landing', { landed: true, score: 45 });
    assert.deepEqual([r.passed, r.mercy, r.attempt], [true, false, 1]);
    assert.deepEqual(r.school.lessonsPassed, ['landing']);
  });

  test('44, 44, 30, 50: intents 1 a 4', () => {
    let s = school();
    const run = score => {
      const r = recordLessonAttempt(s, 'landing', { landed: true, crashed: false, score });
      s = r.school;
      return [r.passed, r.mercy, r.attempt];
    };
    assert.deepEqual(run(44), [false, false, 1]);           // llindar 45
    assert.deepEqual(run(44), [false, false, 2]);           // llindar 45
    assert.deepEqual(s.lessonsPassed, []);
    assert.deepEqual(run(30), [true, true, 3]);             // llindar 30, 30 < 45
    assert.deepEqual(run(50), [true, false, 4]);            // 50 >= 45
    assert.equal(s.attempts.landing, 4);
    assert.deepEqual(s.lessonsPassed, ['landing']);         // sense duplicats
  });

  test('30 al tercer passa amb mercy true; 29 al tercer falla', () => {
    const s = school({ attempts: { landing: 2 } });
    const ok = recordLessonAttempt(s, 'landing', { landed: true, score: 30 });
    assert.deepEqual([ok.passed, ok.mercy, ok.attempt], [true, true, 3]);
    assert.equal(ok.results.find(r => r.metric === 'score').target, 30);
    const ko = recordLessonAttempt(s, 'landing', { landed: true, score: 29 });
    assert.deepEqual([ko.passed, ko.mercy, ko.attempt], [false, false, 3]);
  });

  test('50 al quart passa amb mercy false', () => {
    const r = recordLessonAttempt(school({ attempts: { landing: 3 } }), 'landing',
      { landed: true, score: 50 });
    assert.deepEqual([r.passed, r.mercy, r.attempt], [true, false, 4]);
  });

  // Les llicons anteriors a la 7, aprovades
  const before7 = LESSONS.slice(0, LESSONS.findIndex(l => l.id === 'landing')).map(l => l.id);

  test('al quart intent el llindar continua a 30: 30 passa amb mercy, 29 falla', () => {
    const s = school({ lessonsPassed: before7, attempts: { landing: 3 } });
    const ok = recordLessonAttempt(s, 'landing', { crashed: false, landed: true, score: 30 });
    assert.deepEqual([ok.passed, ok.mercy, ok.attempt], [true, true, 4]);
    const ko = recordLessonAttempt(s, 'landing', { crashed: false, landed: true, score: 29 });
    assert.deepEqual([ko.passed, ko.mercy, ko.attempt], [false, false, 4]);
  });

  test('al segon intent el llindar es 45: 45 aprova, 30 falla', () => {
    const s = school({ lessonsPassed: before7, attempts: { landing: 1 } });
    const ok = recordLessonAttempt(s, 'landing', { crashed: false, landed: true, score: 45 });
    assert.deepEqual([ok.passed, ok.mercy, ok.attempt], [true, false, 2]);
    const ko = recordLessonAttempt(s, 'landing', { crashed: false, landed: true, score: 30 });
    assert.deepEqual([ko.passed, ko.mercy, ko.attempt], [false, false, 2]);
  });

  test('un crash al tercer intent amb 30 falla', () => {
    const s = school({ lessonsPassed: before7, attempts: { landing: 2 } });
    const r = recordLessonAttempt(s, 'landing', { crashed: true, landed: true, score: 30 });
    assert.deepEqual([r.passed, r.mercy, r.attempt], [false, false, 3]);
    assert.deepEqual(r.school.lessonsPassed, before7);
  });

  test('els llindars surten de BALANCE.school', () => {
    assert.deepEqual(
      [BALANCE.school.passScore, BALANCE.school.mercyScore, BALANCE.school.mercyAttempt],
      [45, 30, 3]);
    const r = attemptOf('landing', { landed: true, score: 45 });
    assert.equal(r.results.find(x => x.metric === 'score').target, 45);
  });

  test('una llico sense mercy no baixa el llindar al tercer intent', () => {
    const s = school({ attempts: { maneuvers: 5 } });
    assert.equal(recordLessonAttempt(s, 'maneuvers', { altDeviationMaxFt: 201 }).passed, false);
  });
});

describe('recordLessonAttempt', () => {
  test('compta els intents de cada llico per separat i no toca l entrada', () => {
    const s = school({ lessonsPassed: ['exterior'], attempts: { exterior: 1 } });
    const before = clone(s);
    const r = recordLessonAttempt(s, 'cockpit', { controlsIdentified: 2 });
    assert.deepEqual(s, before);
    assert.deepEqual(r.school.attempts, { exterior: 1, cockpit: 1 });
    assert.deepEqual(r.school.lessonsPassed, ['exterior']);
  });

  test('un intent aprovat tampoc no toca l entrada', () => {
    const s = school({ lessonsPassed: ['exterior'], attempts: { exterior: 1 } });
    const before = clone(s);
    const r = recordLessonAttempt(s, 'cockpit', { crashed: false, controlsIdentified: 6 });
    assert.equal(r.passed, true);
    assert.deepEqual(s, before);
    assert.deepEqual(r.school.lessonsPassed, ['exterior', 'cockpit']);
    assert.deepEqual(r.school.attempts, { exterior: 1, cockpit: 1 });
  });

  test('aprovar afegeix l id sense duplicats', () => {
    const s = school({ lessonsPassed: ['exterior'], attempts: { exterior: 1 } });
    const r = recordLessonAttempt(s, 'exterior', { viewsVisited: 4 });
    assert.deepEqual(r.school.lessonsPassed, ['exterior']);
    assert.equal(r.school.attempts.exterior, 2);
  });

  test('suspendre una llico ja aprovada no la treu', () => {
    const s = school({ lessonsPassed: ['exterior'], attempts: { exterior: 1 } });
    const r = recordLessonAttempt(s, 'exterior', { viewsVisited: 0 });
    assert.equal(r.passed, false);
    assert.deepEqual(r.school.lessonsPassed, ['exterior']);
  });

  test('no toca graduated', () => {
    const all = LESSONS.map(l => l.id);
    const r = recordLessonAttempt(school({ lessonsPassed: all.slice(0, -1) }), 'ils',
      { landed: true, onRunway: true });
    assert.equal(r.school.graduated, false);
    const g = recordLessonAttempt(school({ graduated: true }), 'exterior', { viewsVisited: 0 });
    assert.equal(g.school.graduated, true);
  });

  test('mercy es false a les llicons sense criteri de nota', () => {
    assert.equal(attemptOf('exterior', { viewsVisited: 4, score: 10 }).mercy, false);
  });

  test('llico desconeguda llanca amb l id', () => {
    assert.throws(() => attemptOf('aerobatics', {}), /aerobatics/);
  });
});

describe('isLessonAvailable i canGraduate', () => {
  test('la primera sempre; la resta si l anterior esta aprovada', () => {
    assert.equal(isLessonAvailable(school(), 'exterior'), true);
    assert.equal(isLessonAvailable(school(), 'cockpit'), false);
    assert.equal(isLessonAvailable(school({ lessonsPassed: ['exterior'] }), 'cockpit'), true);
    assert.equal(isLessonAvailable(school({ lessonsPassed: ['exterior'] }), 'taxi'), false);
  });

  test('una llico aprovada es pot repetir', () => {
    const s = school({ lessonsPassed: ['exterior', 'cockpit'] });
    assert.equal(isLessonAvailable(s, 'exterior'), true);
    assert.equal(isLessonAvailable(s, 'cockpit'), true);
  });

  test('llico desconeguda llanca amb l id', () => {
    assert.throws(() => isLessonAvailable(school(), 'aerobatics'), /aerobatics/);
  });

  test('canGraduate: les 8, en qualsevol ordre', () => {
    const ids = LESSONS.map(l => l.id);
    assert.equal(canGraduate(school({ lessonsPassed: [...ids].reverse() })), true);
    assert.equal(canGraduate(school({ lessonsPassed: ids.slice(0, 7) })), false);
    assert.equal(canGraduate(school()), false);
  });
});

describe('crash', () => {
  const perfect = {
    crashed: true, landed: true, score: 100, onRunway: true, viewsVisited: 4,
    controlsIdentified: 6, reachedThreshold: true, maxAltFt: 5000, gearUp: true,
    altDeviationMaxFt: 0, stabilizedOnFinal: true, ilsFlown: true, fuelWithinPlan: true
  };

  for (const l of LESSONS) {
    test('llico ' + l.id + ' falla amb crash i score 100', () => {
      assert.equal(attemptOf(l.id, perfect).passed, false);
      assert.equal(attemptOf(l.id, { ...perfect, crashed: false }).passed, true);
    });
  }

  for (const id of Object.keys(CHECK_RIDES)) {
    test('check-ride ' + id + ' falla amb crash i score 100', () => {
      assert.equal(evaluateCheckRide(id, perfect).passed, false);
      assert.equal(evaluateCheckRide(id, { ...perfect, crashed: false }).passed, true);
    });
  }
});

describe('evaluate', () => {
  test('un fet que falta o es null fa fallar el criteri sense llancar', () => {
    const c = [{ metric: 'maxAltFt', op: 'gte', value: 3000 },
               { metric: 'gearUp', op: 'eq', value: true },
               { metric: 'altDeviationMaxFt', op: 'lte', value: 200 }];
    const r = evaluate(c, {});
    assert.equal(r.passed, false);
    assert.deepEqual(r.results.map(x => [x.value, x.ok]), [[null, false], [null, false], [null, false]]);
    const n = evaluate(c, { maxAltFt: null, gearUp: null, altDeviationMaxFt: null });
    assert.deepEqual(n.results.map(x => x.ok), [false, false, false]);
  });

  test('gte i lte demanen un numero', () => {
    assert.equal(evaluate([{ metric: 'maxAltFt', op: 'gte', value: 3000 }], { maxAltFt: '5000' }).passed, false);
    assert.equal(evaluate([{ metric: 'maxAltFt', op: 'gte', value: 3000 }], { maxAltFt: NaN }).passed, false);
    assert.equal(evaluate([{ metric: 'altDeviationMaxFt', op: 'lte', value: 200 }], { altDeviationMaxFt: false }).passed, false);
  });

  test('format de results', () => {
    const r = evaluate([{ metric: 'score', op: 'gte', value: SCHOOL_PASS }], { score: 60 });
    assert.deepEqual(r, {
      passed: true,
      results: [{ metric: 'score', op: 'gte', target: 45, value: 60, ok: true }]
    });
  });

  test('llista buida passa si no hi ha crash', () => {
    assert.equal(evaluate([], {}).passed, true);
    assert.equal(evaluate([], { crashed: true }).passed, false);
  });

  test('metric o op desconeguts llancen', () => {
    assert.throws(() => evaluate([{ metric: 'loops', op: 'gte', value: 1 }], {}), /loops/);
    assert.throws(() => evaluate([{ metric: 'score', op: 'gt', value: 1 }], {}), /gt/);
  });

  test('afegir una llico no toca codi: una 9a inventada s avalua be', () => {
    const lessons = [...LESSONS, {
      id: 'night', aircraftTypeId: 'commuter', titleKey: 'x', goalKey: 'y',
      criteria: [{ metric: 'landed', op: 'eq', value: true },
                 { metric: 'bounces', op: 'lte', value: 0 },
                 { metric: 'score', op: 'gte', value: SCHOOL_PASS }]
    }];
    assert.equal(lessons.length, 9);
    const ninth = lessons[8];
    assert.equal(evaluate(ninth.criteria, { landed: true, bounces: 0, score: 45 }).passed, true);
    assert.equal(evaluate(ninth.criteria, { landed: true, bounces: 1, score: 90 }).passed, false);
    assert.equal(evaluate(ninth.criteria, { landed: true, bounces: 0, score: 44 }).passed, false);
    assert.equal(LESSONS.length, 8);
  });
});

describe('factsFromRecord', () => {
  test('record amb touchdown', () => {
    assert.deepEqual(factsFromRecord(record()), {
      landed: true, crashed: false, score: 82, onRunway: true, bounces: 1,
      maxAltFt: 4500, tailStrike: false, fuelBurntKg: 300, fuelPlannedKg: 350,
      fuelWithinPlan: true
    });
  });

  test('record amb touchdown null', () => {
    const f = factsFromRecord(record({ touchdown: null, crashCause: 'terrain', tailStrike: true }));
    assert.deepEqual([f.landed, f.crashed, f.score, f.onRunway, f.bounces, f.tailStrike],
      [false, true, null, null, null, true]);
  });

  test('fuelWithinPlan al limit: igual passa, +1 kg falla', () => {
    assert.equal(factsFromRecord(record({ fuelBurntKg: 350 })).fuelWithinPlan, true);
    assert.equal(factsFromRecord(record({ fuelBurntKg: 351 })).fuelWithinPlan, false);
  });

  test('fuelWithinPlan sense skippedCruiseFuelKg compta 0, al limit', () => {
    const r = record({ fuelBurntKg: 350 });
    delete r.skippedCruiseFuelKg;
    assert.equal(factsFromRecord(r).fuelWithinPlan, true);
    assert.equal(factsFromRecord({ ...r, fuelBurntKg: 351 }).fuelWithinPlan, false);
  });

  test('fuelWithinPlan compta el creuer saltat amb la penalitzacio', () => {
    // 300 kg cremats de 350 planificats: dins. Amb 50 kg saltats:
    // 300 + 50 * (1 + 0,08) = 354 > 350: fora.
    assert.equal(BALANCE.cruiseSkipFuelPenalty, 0.08);
    assert.equal(factsFromRecord(record({ fuelBurntKg: 300 })).fuelWithinPlan, true);
    const f = factsFromRecord(record({ fuelBurntKg: 300, skippedCruiseFuelKg: 50, usedCruiseSkip: true }));
    assert.equal(f.fuelWithinPlan, false);
    assert.equal(f.fuelBurntKg, 300);
    // 46 kg saltats: 300 + 49,68 = 349,68, encara dins
    assert.equal(factsFromRecord(record({ fuelBurntKg: 300, skippedCruiseFuelKg: 46 })).fuelWithinPlan, true);
  });

  test('no toca el record', () => {
    const r = record(), before = clone(r);
    factsFromRecord(r);
    assert.deepEqual(r, before);
  });

  test('els fets que retorna son a METRICS', () => {
    for (const k of Object.keys(factsFromRecord(record()))) assert.ok(METRICS.includes(k), k);
  });

  test('de record a llico 7: 82 passa', () => {
    assert.equal(attemptOf('landing', factsFromRecord(record())).passed, true);
  });
});

describe('check-rides', () => {
  const landed = { crashed: false, landed: true };

  test('turboprop: 70 passa, 69 falla', () => {
    assert.equal(evaluateCheckRide('turboprop', { ...landed, score: 70 }).passed, true);
    assert.equal(evaluateCheckRide('turboprop', { ...landed, score: 69 }).passed, false);
  });

  test('quad: 80 passa, 79 falla', () => {
    assert.equal(evaluateCheckRide('quad', { ...landed, score: 80 }).passed, true);
    assert.equal(evaluateCheckRide('quad', { ...landed, score: 79 }).passed, false);
  });

  test('widebody: fuelWithinPlan', () => {
    const f = n => factsFromRecord(record({ aircraftTypeId: 'wb', fuelPlannedKg: 90000, fuelBurntKg: n }));
    assert.equal(evaluateCheckRide('widebody', f(90000)).passed, true);
    assert.equal(evaluateCheckRide('widebody', f(90001)).passed, false);
  });

  test('narrowbody: ilsFlown fals falla', () => {
    const f = { ...landed, onRunway: true };
    assert.equal(evaluateCheckRide('narrowbody', { ...f, ilsFlown: true }).passed, true);
    assert.equal(evaluateCheckRide('narrowbody', { ...f, ilsFlown: false }).passed, false);
    assert.equal(evaluateCheckRide('narrowbody', { ...f, ilsFlown: true, onRunway: false }).passed, false);
  });

  test('el check-ride no fa servir la gracia de l escola', () => {
    assert.equal(evaluateCheckRide('turboprop', { ...landed, score: 45 }).passed, false);
  });

  test('check-ride desconegut llanca amb l id', () => {
    assert.throws(() => evaluateCheckRide('commuter', landed), /commuter/);
    assert.throws(() => evaluateCheckRide('seaplane', landed), /seaplane/);
  });
});

describe('coherencia de les dades', () => {
  const allCriteria = [...LESSONS.flatMap(l => l.criteria),
                       ...Object.values(CHECK_RIDES).flatMap(c => c.criteria)];

  test('8 llicons amb ids unics', () => {
    assert.equal(LESSONS.length, 8);
    assert.equal(new Set(LESSONS.map(l => l.id)).size, 8);
  });

  test('tot metric de LESSONS i CHECK_RIDES es a METRICS', () => {
    for (const c of allCriteria) assert.ok(METRICS.includes(c.metric), c.metric);
  });

  test('tot op es gte, lte o eq', () => {
    for (const c of allCriteria) assert.ok(['gte', 'lte', 'eq'].includes(c.op), c.op);
  });

  test('METRICS no te repetits', () => {
    assert.equal(new Set(METRICS).size, METRICS.length);
  });

  test('les claus de CHECK_RIDES son les de BALANCE.ratings menys commuter', () => {
    const want = Object.keys(BALANCE.ratings).filter(k => k !== 'commuter').sort();
    assert.deepEqual(Object.keys(CHECK_RIDES).sort(), want);
  });

  test('l avio de cada check-ride demana aquella habilitacio', () => {
    for (const [id, c] of Object.entries(CHECK_RIDES)) {
      assert.equal(BALANCE.fleetTypes[c.aircraftTypeId].rating, id, id);
    }
  });

  test('cada aircraftTypeId existeix a aircraft-data', () => {
    for (const x of [...LESSONS, ...Object.values(CHECK_RIDES)]) {
      assert.ok(Object.hasOwn(AIRCRAFT, x.aircraftTypeId), x.aircraftTypeId);
    }
  });

  test('totes les titleKey i goalKey existeixen a en.js i ca.js', () => {
    const keys = [...LESSONS.flatMap(l => [l.titleKey, l.goalKey]),
                  ...Object.values(CHECK_RIDES).map(c => c.titleKey)];
    assert.equal(keys.length, 20);
    for (const k of keys) {
      assert.ok(Object.hasOwn(en, k), 'en: ' + k);
      assert.ok(Object.hasOwn(ca, k), 'ca: ' + k);
    }
  });

  test('nomes la llico 7 te mercy i fa servir SCHOOL_PASS', () => {
    assert.deepEqual(LESSONS.filter(l => l.mercy).map(l => l.id), ['landing']);
    assert.deepEqual(LESSONS.filter(l => l.criteria.some(c => c.value === SCHOOL_PASS)).map(l => l.id),
      ['landing']);
  });
});
