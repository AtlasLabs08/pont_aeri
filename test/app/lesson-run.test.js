/* Proves de app/lesson-run.js (tasca C3): fets en viu, moment de tancar
 * l intent i missatge de l instructor. La nota final la dona
 * career/school.evaluate sobre els fets que finish() retorna.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { LessonRun, lessonGoalParams, attemptMessage } from '../../src/app/lesson-run.js';
import { LESSONS, BALANCE, evaluate } from '../../src/career/index.js';

/** FlightRecord minim; over sobreescriu camps */
const record = (over = {}) => ({
  aircraftTypeId: 'commuter', from: 'LEBL', to: 'LEBL', blockSeconds: 60,
  airborneSeconds: 0, fuelBurntKg: 10, fuelPlannedKg: 100, paxOnBoard: 0,
  maxAltFt: 500, maxG: 1, maxBankDeg: 0, abruptInputs: 0, timeAccelMax: 1,
  usedCruiseSkip: false, skippedCruiseFuelKg: 0, arrivalDeltaMin: 0,
  touchdown: null, rolloutMetres: 0, tailStrike: false, crashCause: null,
  events: [], ...over
});

/** snapshot per defecte, vola llis i sense pista sintonitzada */
const snap = (over = {}) => ({
  replay: false, dt: 1, altFt: 3000, aglFt: 3000, hdgDeg: 90, iasKt: 150,
  gsKt: 150, vsFpm: 0, onGround: false, gearDown: false, flapsLanding: false,
  vrefKt: null, distThrNm: null, distToThrM: null, latOffsetM: null,
  rwyHdgDeg: null, locDots: null, gsDots: null, locValid: false, gsValid: false,
  ...over
});

const passed = (lessonId, facts) => evaluate(LESSONS.find(l => l.id === lessonId).criteria, facts).passed;

describe('LessonRun: llico desconeguda', () => {
  test('llanca', () => {
    assert.throws(() => new LessonRun('no-existeix'));
  });
});

describe('LessonRun: crash a cada tipus de llico = suspes', () => {
  for (const l of LESSONS) {
    test('llico ' + l.id, () => {
      const run = new LessonRun(l.id);
      run.crash();
      assert.equal(run.readyToEnd(), true);
      const facts = run.finish(record({ crashCause: 'terrain' }));
      assert.equal(passed(l.id, facts), false);
    });
  }
});

describe('llico exterior: viewsVisited', () => {
  test('4 vistes diferents acaba la llico', () => {
    const run = new LessonRun('exterior');
    for (const v of ['cockpit', 'chase', 'orbit', 'tower']) run.onView(v);
    assert.equal(run.facts.viewsVisited, 4);
    assert.equal(run.readyToEnd(), true);
  });

  test('repetir la mateixa vista no compta dues vegades', () => {
    const run = new LessonRun('exterior');
    for (const v of ['cockpit', 'cockpit', 'chase', 'orbit']) run.onView(v);
    assert.equal(run.facts.viewsVisited, 3);
    assert.equal(run.readyToEnd(), false);
  });
});

describe('llico cockpit: controlsIdentified un a un', () => {
  test('demana el primer comandament que falta', () => {
    const run = new LessonRun('cockpit');
    assert.equal(run.instructorMessage().params.control, 'flaps');
    run.onCommand('flaps');
    assert.equal(run.instructorMessage().params.control, 'gear');
  });

  test('els 6 comandaments acaben la llico', () => {
    const run = new LessonRun('cockpit');
    for (const c of ['flaps', 'gear', 'parkBrake', 'throttle', 'reverse', 'spoiler']) run.onCommand(c);
    assert.equal(run.readyToEnd(), true);
    assert.equal(run.instructorMessage().key, 'school.lesson.cockpit.goal');
  });

  test('un comandament fora de la llista no compta', () => {
    const run = new LessonRun('cockpit');
    run.onCommand('brake');
    assert.equal(run.facts.controlsIdentified, 0);
  });
});

describe('llico taxi: reachedThreshold', () => {
  const near = snap({ onGround: true, distToThrM: 60, latOffsetM: 25, gsKt: 20 });
  const far = snap({ onGround: true, distToThrM: 61, latOffsetM: 25, gsKt: 20 });

  test('dins dels llindars marca reachedThreshold', () => {
    const run = new LessonRun('taxi');
    run.sample(near);
    assert.equal(run.readyToEnd(), true);
  });

  test('un mica mes lluny no el marca', () => {
    const run = new LessonRun('taxi');
    run.sample(far);
    assert.equal(run.readyToEnd(), false);
  });
});

describe('llico takeoff: maxAltFt es AGL i gearUp', () => {
  test('agafa l AGL de la instantania, no el MSL', () => {
    const run = new LessonRun('takeoff');
    run.sample(snap({ onGround: false, aglFt: 3000, gearDown: false }));
    const facts = run.finish(record({ maxAltFt: 9999 }));
    assert.equal(facts.maxAltFt, 3000);
    assert.equal(passed('takeoff', facts), true);
  });

  test('gear avall no compleix gearUp', () => {
    const run = new LessonRun('takeoff');
    run.sample(snap({ onGround: false, aglFt: 3000, gearDown: true }));
    assert.equal(run.readyToEnd(), false);
  });
});

describe('llico maneuvers: D5', () => {
  const fly = (run, n, over) => { for (let i = 0; i < n; i++) run.sample(snap(over)); };

  test('no acaba abans de 120 s', () => {
    const run = new LessonRun('maneuvers');
    fly(run, 119, { altFt: 3000, hdgDeg: 90 });
    assert.equal(run.readyToEnd(), false);
  });

  test('199 ft de desviacio i 180 graus de viratge: aprova', () => {
    const run = new LessonRun('maneuvers');
    run.sample(snap({ altFt: 3000, hdgDeg: 0 }));
    run.sample(snap({ altFt: 3199, hdgDeg: 90 }));
    run.sample(snap({ altFt: 3199, hdgDeg: 180 }));
    fly(run, 117, { altFt: 3199, hdgDeg: 180 });
    assert.equal(run.readyToEnd(), true);
    const facts = run.finish(record());
    assert.equal(facts.altDeviationMaxFt, 199);
    assert.equal(facts.headingChangeDeg, 180);
    assert.equal(passed('maneuvers', facts), true);
  });

  test('201 ft de desviacio suspen', () => {
    const run = new LessonRun('maneuvers');
    run.sample(snap({ altFt: 3000, hdgDeg: 0 }));
    run.sample(snap({ altFt: 3201, hdgDeg: 90 }));
    run.sample(snap({ altFt: 3201, hdgDeg: 180 }));
    fly(run, 117, { altFt: 3201, hdgDeg: 180 });
    const facts = run.finish(record());
    assert.equal(facts.altDeviationMaxFt, 201);
    assert.equal(passed('maneuvers', facts), false);
  });

  test('179 graus de viratge suspen', () => {
    const run = new LessonRun('maneuvers');
    run.sample(snap({ altFt: 3000, hdgDeg: 0 }));
    run.sample(snap({ altFt: 3100, hdgDeg: 89.5 }));
    run.sample(snap({ altFt: 3100, hdgDeg: 179 }));
    fly(run, 117, { altFt: 3100, hdgDeg: 179 });
    const facts = run.finish(record());
    assert.equal(facts.headingChangeDeg, 179);
    assert.equal(passed('maneuvers', facts), false);
  });

  test('els instants de replay no compten', () => {
    const run = new LessonRun('maneuvers');
    run.sample(snap({ altFt: 3000, hdgDeg: 0 }));
    run.sample(snap({ replay: true, altFt: 9000, hdgDeg: 270 }));
    fly(run, 118, { altFt: 3000, hdgDeg: 0 });
    const facts = run.finish(record());
    assert.equal(facts.altDeviationMaxFt, 0);
    assert.equal(facts.headingChangeDeg, 0);
  });

  test("comenca a l'altitud de 'airborne' i la mante amb viratges: aprova", () => {
    const aglFt = LESSONS.find(l => l.id === 'maneuvers').spawn.aglFt;
    const run = new LessonRun('maneuvers');
    run.sample(snap({ altFt: aglFt, hdgDeg: 0 }));
    run.sample(snap({ altFt: aglFt, hdgDeg: 90 }));
    run.sample(snap({ altFt: aglFt, hdgDeg: 180 }));
    fly(run, 117, { altFt: aglFt, hdgDeg: 180 });
    assert.equal(run.readyToEnd(), true);
    const facts = run.finish(record());
    assert.equal(facts.altDeviationMaxFt, 0);
    assert.equal(facts.headingChangeDeg, 180);
    assert.equal(passed('maneuvers', facts), true);
  });
});

describe('llico circuit: D6, cada condicio per separat', () => {
  const good = () => snap({
    aglFt: 400, distThrNm: 2, rwyHdgDeg: 250, hdgDeg: 250, gearDown: true,
    flapsLanding: true, vrefKt: 120, iasKt: 125, vsFpm: -500
  });
  test('totes les condicions sostingudes 10 s: aprova', () => {
    const run = new LessonRun('circuit');
    for (let i = 0; i < 11; i++) run.sample(good());
    assert.equal(run.readyToEnd(), true);
  });

  const breaks = [
    ['massa lluny del llindar', { distThrNm: 3.5 }],
    ['massa alt', { aglFt: 600 }],
    ['rumb fora de tolerancia', { hdgDeg: 265 }],
    ['tren amunt', { gearDown: false }],
    ['flaps no d aterratge', { flapsLanding: false }],
    ['massa lent', { iasKt: 100 }],
    ['massa rapid', { iasKt: 145 }],
    ['sink excessiu', { vsFpm: -1200 }]
  ];
  for (const [label, over] of breaks) {
    test(label + ': no estabilitza', () => {
      const run = new LessonRun('circuit');
      for (let i = 0; i < 11; i++) run.sample({ ...good(), ...over });
      assert.equal(run.readyToEnd(), false);
    });
  }

  test("a la posicio de 'downwind', sense volar el circuit, no aprova", () => {
    const S = LESSONS.find(l => l.id === 'circuit').spawn;
    const downwind = snap({
      aglFt: S.aglFt, distThrNm: 0.2, rwyHdgDeg: 250, hdgDeg: 70, gearDown: false,
      flapsLanding: false, vrefKt: 120, iasKt: 130, vsFpm: 0
    });
    const run = new LessonRun('circuit');
    for (let i = 0; i < 200; i++) run.sample(downwind);
    assert.equal(run.facts.stabilizedOnFinal, false);
    assert.equal(run.readyToEnd(), false);
    const facts = run.finish(record());
    assert.equal(passed('circuit', facts), false);
  });
});

describe('llico ils: ilsFlown amb world/ils.js', () => {
  test('dins de tolerancia 10 s marca ilsFlown', () => {
    const run = new LessonRun('ils');
    for (let i = 0; i < 11; i++) run.sample(snap({ locValid: true, gsValid: true, locDots: 0.5, gsDots: -0.5 }));
    const facts = run.finish(record({ touchdown: { fpm: -180, g: 1.1, bounces: 0, onRunway: true, rwy: '24L', tdzDist: 300, center: 1, crab: 0, remaining: 1500, ias: 110, pitch: 3, roll: 0, score: 80, pts: { sink: 30, g: 15, zone: 18, center: 18, attitude: 9 } } }));
    assert.equal(facts.ilsFlown, true);
    assert.equal(passed('ils', facts), true);
  });

  test('fora de tolerancia no la marca', () => {
    const run = new LessonRun('ils');
    for (let i = 0; i < 11; i++) run.sample(snap({ locValid: true, gsValid: true, locDots: 2, gsDots: -0.5 }));
    assert.equal(run.facts.ilsFlown, false);
  });
});

describe('abandonar i tornar a comencar no arrossega fets', () => {
  test('una nova LessonRun comenca de zero', () => {
    const first = new LessonRun('exterior');
    for (const v of ['cockpit', 'chase', 'orbit']) first.onView(v);
    assert.equal(first.facts.viewsVisited, 3);
    const second = new LessonRun('exterior');
    assert.equal(second.facts.viewsVisited, 0);
    assert.equal(second.readyToEnd(), false);
  });
});

describe('finish es idempotent', () => {
  test('cridar finish dues vegades retorna els mateixos fets', () => {
    const run = new LessonRun('exterior');
    for (const v of ['cockpit', 'chase', 'orbit', 'tower']) run.onView(v);
    const a = run.finish(record());
    const b = run.finish(record({ maxAltFt: 12345 }));
    assert.deepEqual(a, b);
  });
});

describe('lessonGoalParams', () => {
  test('el numero surt de LESSONS, no escrit al text', () => {
    assert.deepEqual(lessonGoalParams(LESSONS.find(l => l.id === 'exterior')), { count: 4 });
    assert.deepEqual(lessonGoalParams(LESSONS.find(l => l.id === 'cockpit')), { count: 6 });
    assert.deepEqual(lessonGoalParams(LESSONS.find(l => l.id === 'takeoff')), { count: 3000 });
    assert.deepEqual(lessonGoalParams(LESSONS.find(l => l.id === 'maneuvers')), { count: 200 });
    assert.deepEqual(lessonGoalParams(LESSONS.find(l => l.id === 'circuit')), {});
    assert.deepEqual(lessonGoalParams(LESSONS.find(l => l.id === 'landing')), { score: BALANCE.school.passScore });
  });
});

describe('attemptMessage', () => {
  test('crash, gracia, aprovat i suspes', () => {
    assert.equal(attemptMessage({ passed: false, mercy: false, crashed: true }).key, 'school.instructor.crashed');
    assert.equal(attemptMessage({ passed: true, mercy: true, crashed: false }).key, 'school.instructor.mercyPassed');
    assert.equal(attemptMessage({ passed: true, mercy: false, crashed: false }).key, 'school.instructor.passed');
    assert.equal(attemptMessage({ passed: false, mercy: false, crashed: false }).key, 'school.instructor.failed');
  });
});
