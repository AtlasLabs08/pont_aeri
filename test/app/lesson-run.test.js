/* Proves de app/lesson-run.js (tasca C3): fets en viu, moment de tancar
 * l intent i missatge de l instructor. La nota final la dona
 * career/school.evaluate sobre els fets que finish() retorna.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { LessonRun, lessonGoalParams, attemptMessage, keyLabel, messageText, circuitGuidance } from '../../src/app/lesson-run.js';
import { LESSONS, BALANCE, evaluate } from '../../src/career/index.js';
import { setLang } from '../../src/i18n/index.js';
import en from '../../src/i18n/en.js';
import ca from '../../src/i18n/ca.js';

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

  test('el missatge diu el nom (clau i18n) i la tecla del comandament', () => {
    const run = new LessonRun('cockpit');
    const msg = run.instructorMessage();
    assert.equal(msg.params.key, 'F');
    assert.equal(msg.tParams.controlName, 'school.control.flaps');
    run.onCommand('flaps');
    assert.equal(run.instructorMessage().params.key, 'G');
    setLang('en');
    assert.equal(messageText(run.instructorMessage()), 'Identify this control: landing gear (key G).');
    setLang('ca');
    assert.equal(messageText(run.instructorMessage()), "Identifica aquest comandament: tren d'aterratge (tecla G).");
    setLang('en');
  });

  test('keyLabel: nom curt de la tecla', () => {
    assert.equal(keyLabel('KeyG'), 'G');
    assert.equal(keyLabel('ShiftLeft'), 'Shift');
    assert.equal(keyLabel('Digit0'), '0');
  });

  test('un comandament fora de la llista no compta', () => {
    const run = new LessonRun('cockpit');
    run.onCommand('brake');
    assert.equal(run.facts.controlsIdentified, 0);
  });
});

describe('llico cockpit: amb l avio aturat a terra, premer cada comandament compta', () => {
  const L = LESSONS.find(l => l.id === 'cockpit');
  const stopped = snap({ onGround: true, gsKt: 0, iasKt: 0, vsFpm: 0, altFt: 15, aglFt: 0, gearDown: true });
  for (const name of L.controls) {
    test(name, () => {
      const codes = L.controlKeys[name];
      assert.ok(Array.isArray(codes) && codes.length > 0, 'cal almenys una tecla per a ' + name);
      assert.ok(Object.hasOwn(en, 'school.control.' + name) && Object.hasOwn(ca, 'school.control.' + name));
      for (const code of codes) {
        const run = new LessonRun('cockpit');
        run.sample(stopped);
        run.onKey(code);
        assert.equal(run.facts.controlsIdentified, 1, code);
        assert.notEqual(run.nextControl(), name, code);
      }
    });
  }

  test('tota la llico es pot fer aturat, premint la tecla que diu l instructor', () => {
    const run = new LessonRun('cockpit');
    run.sample(stopped);
    for (let i = 0; i < L.controls.length; i++) {
      const next = run.nextControl();
      run.onKey(L.controlKeys[next][0]);
      run.sample(stopped);
    }
    assert.equal(run.readyToEnd(), true);
  });

  test('una tecla que no es de cap comandament no compta', () => {
    const run = new LessonRun('cockpit');
    run.onKey('KeyC');
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

describe('thresholdMark: ressaltat del capcal nomes a la llico taxi', () => {
  test('taxi: tram del capcal a partir dels llindars de reachedThreshold', () => {
    const T = LESSONS.find(l => l.id === 'taxi').taxi;
    const run = new LessonRun('taxi');
    assert.deepEqual(run.thresholdMark(), { fromM: -T.maxDistToThrM, toM: T.maxDistToThrM, halfWidthM: T.maxLatOffsetM });
  });

  test('cap altra llico no en te', () => {
    for (const l of LESSONS.filter(x => x.id !== 'taxi')) assert.equal(new LessonRun(l.id).thresholdMark(), null, l.id);
  });

  test('desapareix quan l intent acaba', () => {
    const run = new LessonRun('taxi');
    run.finish(record());
    assert.equal(run.thresholdMark(), null);
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

  test('201 ft de desviacio suspen a l instant, sense esperar els 120 s', () => {
    const run = new LessonRun('maneuvers');
    run.sample(snap({ altFt: 3000, hdgDeg: 0 }));
    run.sample(snap({ altFt: 3100, hdgDeg: 0 }));
    assert.equal(run.readyToEnd(), false);
    run.sample(snap({ altFt: 2799, hdgDeg: 0 }));
    assert.equal(run.readyToEnd(), true);
    assert.deepEqual(run.failReason(), { key: 'school.instructor.altDeviation', params: { ft: 201 } });
    const facts = run.finish(record());
    assert.equal(passed('maneuvers', facts), false);
  });

  test('200 ft justos no acaba l intent', () => {
    const run = new LessonRun('maneuvers');
    run.sample(snap({ altFt: 3000, hdgDeg: 0 }));
    run.sample(snap({ altFt: 3200, hdgDeg: 0 }));
    assert.equal(run.readyToEnd(), false);
    assert.equal(run.failReason(), null);
  });

  test('el missatge del suspens diu quants peus t has desviat', () => {
    const run = new LessonRun('maneuvers');
    run.sample(snap({ altFt: 4000 }));
    run.sample(snap({ altFt: 3688.4 }));
    const msg = attemptMessage({ passed: false, mercy: false, crashed: false, reason: run.failReason() });
    setLang('en');
    assert.equal(messageText(msg), 'You drifted 312 ft from your reference altitude. Attempt failed.');
    setLang('ca');
    assert.equal(messageText(msg), "T'has desviat 312 ft de l'altitud de referència. Intent suspès.");
    setLang('en');
  });

  test("el text de l objectiu diu que cal fer, amb els numeros de lessons.js", () => {
    const L = LESSONS.find(l => l.id === 'maneuvers');
    setLang('en');
    assert.equal(messageText(new LessonRun('maneuvers').instructorMessage()),
      'Turn at least 180° in total, holding altitude within ±200 ft for 2 min');
    setLang('ca');
    assert.equal(messageText({ key: L.goalKey, params: lessonGoalParams(L) }),
      "Vira almenys 180° en total mantenint l'altitud dins de ±200 ft durant 2 min");
    setLang('en');
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

describe('llico circuit: guia per fases, a banda i banda de la pista', () => {
  const L = LESSONS.find(l => l.id === 'circuit');
  const G = L.guidance, RWY = 250;
  const lateral = L.spawn.lateralNm * 1852;
  // side = +1: a l esquerra de l eix (circuit per l esquerra); -1: a la dreta
  const cases = side => {
    const baseHdg = (RWY + side * 90 + 360) % 360, turn = side > 0 ? 'left' : 'right';
    return [
      ['vent en cua, al travers del llindar (spawn)', { alongM: 0, latM: side * lateral, hdgDeg: 70 }, 'downwind', null, false],
      ['vent en cua, llindar 30 graus enrere', { alongM: -lateral * Math.tan(30 * Math.PI / 180), latM: side * lateral, hdgDeg: 70 }, 'downwind', null, false],
      ['vent en cua, llindar 46 graus enrere', { alongM: -lateral * Math.tan(46 * Math.PI / 180), latM: side * lateral, hdgDeg: 70 }, 'base', turn, true],
      ['virant a base, a mig gir', { alongM: -3200, latM: side * 2600, hdgDeg: (70 - side * 45 + 360) % 360 }, 'base', turn, true],
      ['establert en base', { alongM: -3300, latM: side * 2000, hdgDeg: baseHdg }, 'base', null, false],
      ['base, l eix a prop', { alongM: -3300, latM: side * (G.finalTurnLatM - 1), hdgDeg: baseHdg }, 'finalTurn', turn, true],
      ['a final, alineat', { alongM: -2500, latM: side * 40, hdgDeg: RWY + 2 }, 'final', null, false]
    ];
  };
  for (const [label, side] of [['esquerra', 1], ['dreta', -1]]) {
    for (const [name, pos, phase, turn, turnNow] of cases(side)) {
      test(label + ': ' + name, () => {
        const g = circuitGuidance({ ...pos, rwyHdgDeg: RWY }, G);
        assert.equal(g.phase, phase);
        assert.equal(g.side, turn);
        assert.equal(g.turnNow, turnNow);
      });
    }
  }

  test('els llindars surten de lessons.js: just abans de baseTurnDeg encara es vent en cua', () => {
    const behind = deg => ({ alongM: -1000 * Math.tan(deg * Math.PI / 180), latM: 1000 * 3, hdgDeg: 70, rwyHdgDeg: RWY });
    const a = circuitGuidance({ ...behind(G.baseTurnDeg - 0.5), latM: 1000 }, G);
    const b = circuitGuidance({ ...behind(G.baseTurnDeg + 0.5), latM: 1000 }, G);
    assert.equal(a.phase, 'downwind');
    assert.equal(b.phase, 'finalTurn');
  });

  const snapAt = (pos, over = {}) => snap({ aglFt: 1500, asgAlongM: pos.alongM, asgLatM: pos.latM, asgHdgDeg: RWY, hdgDeg: pos.hdgDeg, ...over });

  test('un missatge per fase, amb el costat del gir traduit', () => {
    const run = new LessonRun('circuit');
    setLang('en');
    run.sample(snapAt({ alongM: 0, latM: lateral, hdgDeg: 70 }));
    assert.equal(messageText(run.instructorMessage()), 'Downwind: hold 1,500 ft, lower the gear and set flaps.');
    run.sample(snapAt({ alongM: -lateral * 1.1, latM: lateral, hdgDeg: 70 }));
    assert.equal(messageText(run.instructorMessage()), 'Turn left onto base now and start descending.');
    run.sample(snapAt({ alongM: -3300, latM: 2000, hdgDeg: 340 }));
    assert.equal(messageText(run.instructorMessage()), 'On base: keep descending.');
    run.sample(snapAt({ alongM: -3300, latM: 800, hdgDeg: 340 }));
    assert.equal(messageText(run.instructorMessage()), 'Turn left onto final now.');
    run.sample(snapAt({ alongM: -2500, latM: 20, hdgDeg: 250 }));
    assert.equal(messageText(run.instructorMessage()), 'On final: be stabilised before 500 ft.');
    setLang('ca');
    run.sample(snapAt({ alongM: -3300, latM: -800, hdgDeg: 160 }));
    assert.equal(messageText(run.instructorMessage()), 'Gira a la dreta cap a final ara.');
    setLang('en');
  });

  test('sense geometria de la pista assignada, el missatge es l objectiu', () => {
    const run = new LessonRun('circuit');
    run.sample(snap());
    assert.equal(run.instructorMessage().key, L.goalKey);
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
    assert.deepEqual(lessonGoalParams(LESSONS.find(l => l.id === 'maneuvers')), { deg: 180, ft: 200, min: 2 });
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
    const reason = { key: 'school.instructor.altDeviation', params: { ft: 250 } };
    assert.equal(attemptMessage({ passed: false, mercy: false, crashed: false, reason }), reason);
    assert.equal(attemptMessage({ passed: false, mercy: false, crashed: true, reason }).key, 'school.instructor.crashed');
  });
});
