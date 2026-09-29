/* Proves de app/lesson-run.js (tasca C3): fets en viu, moment de tancar
 * l intent i missatge de l instructor. La nota final la dona
 * career/school.evaluate sobre els fets que finish() retorna.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { LessonRun, lessonGoalParams, attemptMessage, keyLabel, messageText, circuitGuidance, ilsGuidance } from '../../src/app/lesson-run.js';
import { LESSONS, CONTROL_KEYS, BALANCE, evaluate } from '../../src/career/index.js';
import { setLang, fmtNumber } from '../../src/i18n/index.js';
import { AIRPORTS } from '../../src/world/index.js';
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

describe('llico 3: taxiPath, cami per les calles de rodatge fins a la rodona', () => {
  const A = AIRPORTS.LEBL, en = A.allEnds[0], T = LESSONS.find(l => l.id === 'taxi').taxi;
  const gate = A.gates.find(g => g.size === 'M'), from = [gate.a, gate.c];
  const len = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

  test('des de la porta: no es una recta i acaba al centre de la rodona', () => {
    const run = new LessonRun('taxi'), path = run.taxiPath(A, en, from);
    const m = run.thresholdMark(), s = (m.fromM + m.toM) / 2;
    assert.deepEqual(path[0], from);
    assert.deepEqual(path[path.length - 1], [en.thr[0] + en.dir[0] * s, en.thr[1] + en.dir[1] * s]);
    assert.ok(path.length > 2);
    assert.ok(len(path) > Math.hypot(en.thr[0] - from[0], en.thr[1] - from[1]));
  });

  test('seguint el cami no el recalcula: comenca a l avio i no torna enrere', () => {
    const run = new LessonRun('taxi'), full = run.taxiPath(A, en, from);
    const onRoute = [full[2][0] - 100, full[2][1] + 5];      // sobre la paral lela, 5 m de l eix
    const path = run.taxiPath(A, en, onRoute);
    assert.deepEqual(path[0], onRoute);
    assert.deepEqual(path.slice(2), full.slice(3));
    assert.ok(len(path) < len(full));
  });

  test('allunyar-se mes de rerouteM el recalcula des de la posicio nova', () => {
    const run = new LessonRun('taxi'), full = run.taxiPath(A, en, from);
    const off = [full[2][0] - 100, full[2][1] - T.rerouteM - 30];
    const path = run.taxiPath(A, en, off);
    assert.deepEqual(path[0], off);
    assert.equal(run._taxi.pts, path);
    // a menys de rerouteM, el mateix cami de sempre
    const near = [full[2][0] - 100, full[2][1] - T.rerouteM + 5];
    const again = new LessonRun('taxi'); again.taxiPath(A, en, from);
    const kept = again._taxi.pts;
    again.taxiPath(A, en, near);
    assert.equal(again._taxi.pts, kept);
  });

  test('nomes a la llico taxi i mentre l intent es en marxa', () => {
    assert.equal(new LessonRun('takeoff').taxiPath(A, en, from), null);
    const run = new LessonRun('taxi');
    run.finish(record());
    assert.equal(run.taxiPath(A, en, from), null);
  });
});

describe('llico takeoff: maxAltFt es MSL, com l altimetre, i gearUp', () => {
  test('agafa l altitud MSL de la instantania, no l AGL', () => {
    const run = new LessonRun('takeoff');
    run.sample(snap({ onGround: false, altFt: 3000, aglFt: 2983, gearDown: false }));
    const facts = run.finish(record({ maxAltFt: 9999 }));
    assert.equal(facts.maxAltFt, 3000);
    assert.equal(passed('takeoff', facts), true);
  });

  test('arrodonit a 10 ft com l altimetre: quan l altimetre diu 3000 aprova', () => {
    const run = new LessonRun('takeoff');
    run.sample(snap({ onGround: false, altFt: 2995, aglFt: 2978, gearDown: false }));
    assert.equal(run.facts.maxAltFt, 3000);
    assert.equal(run.readyToEnd(), true);
    const low = new LessonRun('takeoff');
    low.sample(snap({ onGround: false, altFt: 2994, aglFt: 2977, gearDown: false }));
    assert.equal(low.facts.maxAltFt, 2990);
    assert.equal(low.readyToEnd(), false);
  });

  test('gear avall no compleix gearUp', () => {
    const run = new LessonRun('takeoff');
    run.sample(snap({ onGround: false, altFt: 3000, aglFt: 2983, gearDown: true }));
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
    assert.equal(messageText(run.instructorMessage()), `Downwind: hold ${fmtNumber(L.spawn.aglFt)} ft, lower the gear and set flaps.`);
    run.sample(snapAt({ alongM: -lateral * 1.1, latM: lateral, hdgDeg: 70 }));
    assert.equal(messageText(run.instructorMessage()), 'Turn left onto base now and start descending.');
    run.sample(snapAt({ alongM: -3300, latM: 2000, hdgDeg: 340 }));
    assert.equal(messageText(run.instructorMessage()), 'On base: keep descending.');
    run.sample(snapAt({ alongM: -3300, latM: 800, hdgDeg: 340 }));
    assert.equal(messageText(run.instructorMessage()), 'Turn left onto final now.');
    run.sample(snapAt({ alongM: -2500, latM: 20, hdgDeg: 250 }));
    assert.equal(messageText(run.instructorMessage()), 'On final: below 500 ft AGL and within 3 nm of the threshold, stay stabilised for 10 s.');
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

describe('llico 6: si el comptador dels 10 s no avanca, la llista diu quina condicio falta', () => {
  const T = LESSONS.find(l => l.id === 'circuit').finalStabilized;
  // el que va veure en Marc: tren, flaps, velocitat, sink i rumb bons, estabilitzat per sobre dels
  // 500 ft (l instructor deia "estabilitza't abans dels 500 ft") a 2 nm del llindar
  const marc = () => snap({ aglFt: T.aglFt + 200, distThrNm: 2, rwyHdgDeg: 66, hdgDeg: 66, gearDown: true,
    flapsLanding: true, vrefKt: 97, iasKt: 102, vsFpm: -550 });
  const byId = run => Object.fromEntries(run.objectives().map(o => [o.id, o]));

  test('comptador a 0 amb tot en verd: alguna fila ho ha d explicar', () => {
    const run = new LessonRun('circuit');
    for (let i = 0; i < 20; i++) run.sample(marc());
    const rows = run.objectives();
    const streak = rows.find(o => o.id === 'stabilizedOnFinal');
    assert.equal(streak.params.value, 0);
    const missing = rows.filter(o => o.id !== 'stabilizedOnFinal' && !o.ok).map(o => o.id);
    assert.deepEqual(missing, ['height']);
  });

  const breaks = [
    ['distance', { distThrNm: T.maxDistNm + 0.5 }], ['distance', { distThrNm: null }],
    ['height', { aglFt: T.aglFt + 1 }], ['gear', { gearDown: false }], ['flaps', { flapsLanding: false }],
    ['speed', { iasKt: 150 }], ['sink', { vsFpm: -T.sinkMaxFpm - 1 }], ['alignment', { hdgDeg: 90 }]
  ];
  for (const [id, over] of breaks) {
    test(id + ' ' + JSON.stringify(over) + ': el comptador no avanca i nomes aquesta fila falla', () => {
      const run = new LessonRun('circuit');
      for (let i = 0; i < 5; i++) run.sample({ ...marc(), aglFt: T.aglFt - 50, ...over });
      const rows = run.objectives();
      assert.equal(rows.find(o => o.id === 'stabilizedOnFinal').params.value, 0);
      assert.deepEqual(rows.filter(o => o.id !== 'stabilizedOnFinal' && !o.ok).map(o => o.id), [id]);
    });
  }

  test('per sota de 500 ft i a menys de 3 nm el comptador avanca i la llista ho diu', () => {
    const run = new LessonRun('circuit');
    for (let i = 0; i < 4; i++) run.sample({ ...marc(), aglFt: T.aglFt - 50, distThrNm: 1.46 });
    const by = byId(run);
    assert.equal(by.stabilizedOnFinal.params.value, 4);
    assert.deepEqual(by.distance.params, { value: 1.5, target: T.maxDistNm });
    assert.deepEqual(by.height.params, { value: T.aglFt - 50, target: T.aglFt });
    setLang('en');
    assert.equal(messageText({ key: by.distance.labelKey, params: by.distance.params }), 'Distance to threshold: 1.5 nm (max 3 nm)');
    assert.equal(messageText({ key: by.height.labelKey, params: by.height.params }), 'Height: 450 ft AGL (below 500 ft)');
    setLang('ca');
    assert.equal(messageText({ key: by.distance.labelKey, params: by.distance.params }), 'Distància al llindar: 1,5 nm (màx. 3 nm)');
    setLang('en');
  });

  test('a final, l instructor diu les condicions del comptador, amb els numeros de lessons.js', () => {
    const run = new LessonRun('circuit');
    run.sample({ ...marc(), asgAlongM: -3000, asgLatM: 0, asgHdgDeg: 66 });
    const msg = run.instructorMessage();
    assert.equal(msg.key, 'school.circuit.final');
    assert.deepEqual(msg.params, { ft: T.aglFt, nm: T.maxDistNm, s: T.sustainedS });
  });
});

describe('llicons 7 i 8: dos punts de partida diferents (lessons.js)', () => {
  const L7 = LESSONS.find(l => l.id === 'landing').spawn, L8 = LESSONS.find(l => l.id === 'ils').spawn;
  const FT = 0.3048, NM = 1852, GS_S = 420;
  const gsFt = dNm => (dNm * NM + GS_S) * Math.tan(3 * Math.PI / 180) / FT;   // senda de 3 graus (world/ils.js)

  test('llico 7: final curt, a uns 3 nm, alineat i sobre la senda (sense offset ni altura propia)', () => {
    assert.ok(L7.distNm >= 2 && L7.distNm <= 4, String(L7.distNm));
    assert.equal(L7.lateralNm ?? 0, 0);
    assert.equal(L7.interceptDeg ?? 0, 0);
    assert.equal(L7.aglFt, undefined);            // Game.spawn: sobre la senda, configuracio d aterratge
  });

  test('llico 8: lluny, fora de l eix, angle d intercepcio de 20 a 30 graus i per sota de la senda', () => {
    assert.ok(L8.distNm >= 10 && L8.distNm <= 14, String(L8.distNm));
    assert.ok(L8.lateralNm > 0);
    assert.ok(L8.interceptDeg >= 20 && L8.interceptDeg <= 30, String(L8.interceptDeg));
    assert.ok(L8.aglFt < gsFt(L8.distNm), `${L8.aglFt} >= ${gsFt(L8.distNm)}`);
    // on talla l eix (a interceptDeg), continua per sota de la senda: la senda es captura des de sota
    const cut = L8.distNm - L8.lateralNm / Math.tan(L8.interceptDeg * Math.PI / 180);
    assert.ok(cut > 0 && L8.aglFt < gsFt(cut), `talla a ${cut} nm`);
    assert.ok(L8.aglFt > LESSONS.find(l => l.id === 'ils').ilsTolerance.topAglFt);
  });
});

describe('llico 8 (ils): ilsFlown, seguit dins d 1 punt de 1.500 a 500 ft AGL', () => {
  const T = LESSONS.find(l => l.id === 'ils').ilsTolerance;
  const on = (h, over = {}) => snap({ hatFt: h, aglFt: h, altFt: h, locValid: true, gsValid: true, locDots: 0.3, gsDots: -0.4,
    rwyHdgDeg: 66, hdgDeg: 66, ...over });
  const descend = (run, over = () => ({})) => { for (let h = 2000; h >= 300; h -= 50) run.sample(on(h, over(h))); };
  const touchdown = { fpm: -180, g: 1.1, bounces: 0, onRunway: true, rwy: '07L', tdzDist: 300, center: 1, crab: 0,
    remaining: 1500, ias: 100, pitch: 3, roll: 0, score: 80, pts: { sink: 30, g: 15, zone: 18, center: 18, attitude: 9 } };

  test('dins de tolerancia de dalt a baix del tram: ilsFlown i aprova en aterrar a pista', () => {
    const run = new LessonRun('ils');
    descend(run);
    assert.equal(run.facts.ilsFlown, true);
    assert.equal(run.failReason(), null);
    assert.equal(run.readyToEnd(), false);        // tanca amb finish, quan Game calcula la nota
    const facts = run.finish(record({ touchdown }));
    assert.equal(passed('ils', facts), true);
  });

  test('aterrar a pista sense haver seguit l ILS no aprova', () => {
    const run = new LessonRun('ils');
    descend(run, h => (h === 1000 ? { locDots: 1.4 } : {}));
    assert.equal(run.facts.ilsFlown, false);
    assert.deepEqual(run.failReason(), { key: 'school.instructor.ilsDeviation', params: { dots: 1.4, top: T.topAglFt, bottom: T.bottomAglFt } });
    const facts = run.finish(record({ touchdown }));
    assert.equal(passed('ils', facts), false);
    setLang('en');
    assert.equal(messageText(run.failReason()), 'You left the ILS: 1.4 dots off between 1,500 and 500 ft AGL.');
  });

  test('la senda compta igual que el localitzador', () => {
    const run = new LessonRun('ils');
    descend(run, h => (h === 700 ? { gsDots: -1.2 } : {}));
    assert.equal(run.facts.ilsFlown, false);
  });

  test('fora de tolerancia per sobre de 1.500 o per sota de 500 ft no compta', () => {
    const run = new LessonRun('ils');
    descend(run, h => (h > T.topAglFt || h < T.bottomAglFt ? { locDots: 2.5, gsDots: 2.5 } : {}));
    assert.equal(run.facts.ilsFlown, true);
  });

  test('perdre el senyal dins del tram no compta com a seguit', () => {
    const run = new LessonRun('ils');
    descend(run, h => (h === 900 ? { gsValid: false } : {}));
    assert.equal(run.facts.ilsFlown, false);
    assert.equal(run.failReason().key, 'school.instructor.ilsLost');
  });

  test('l altura es sobre la pista (hatFt): els turons de sota no fan entrar al tram abans d hora', () => {
    const run = new LessonRun('ils');
    // lluny, a 2.000 ft sobre la pista pero a 1.400 ft del terra: agulla encara fora
    run.sample(snap({ hatFt: 2000, aglFt: 1400, locValid: true, gsValid: true, locDots: 6.5, gsDots: -4, rwyHdgDeg: 66, hdgDeg: 91 }));
    assert.equal(run.failReason(), null);
    descend(run);
    assert.equal(run.facts.ilsFlown, true);
  });

  test('sense haver passat pel tram (nomes a baix) no el marca', () => {
    const run = new LessonRun('ils');
    run.sample(on(400));
    assert.equal(run.facts.ilsFlown, false);
  });

  test('llista: desviacio de les dues agulles i el tram', () => {
    const run = new LessonRun('ils');
    run.sample(on(1200, { locDots: -0.26, gsDots: 1.34 }));
    const by = Object.fromEntries(run.objectives().map(o => [o.id, o]));
    assert.deepEqual([by.locDots.params.value, by.locDots.ok], [0.3, true]);
    assert.deepEqual([by.gsDots.params.value, by.gsDots.ok], [1.3, false]);
    assert.deepEqual(by.ilsFlown.params, { top: T.topAglFt, bottom: T.bottomAglFt });
    setLang('en');
    assert.equal(messageText({ key: by.gsDots.labelKey, params: by.gsDots.params }), 'Glideslope: 1.3 dots off (max 1)');
    setLang('ca');
    assert.equal(messageText({ key: by.ilsFlown.labelKey, params: by.ilsFlown.params }), 'ILS seguit de 1.500 a 500 ft AGL');
    setLang('en');
  });
});

describe('llico 8 (ils): l instructor guia la intercepcio', () => {
  const L = LESSONS.find(l => l.id === 'ils'), G = L.guidance, T = L.ilsTolerance;
  const g = over => ilsGuidance({ hdgDeg: 91, rwyHdgDeg: 66, locValid: true, gsValid: true, locDots: 0, gsDots: 0,
    hatFt: 2000, aglFt: 2000, ...over }, G, T);

  test('fases, de lluny fins a terra', () => {
    assert.deepEqual(g({ locValid: false, locDots: null }), { phase: 'noSignal', side: null });
    // a l esquerra de l eix (locDots positiu): l agulla, i l eix, queden a la dreta
    assert.deepEqual(g({ locDots: 6.5 }), { phase: 'intercept', side: 'right' });
    assert.deepEqual(g({ locDots: -6.5, hdgDeg: 41 }), { phase: 'intercept', side: 'left' });
    assert.deepEqual(g({ locDots: G.locAliveDots }), { phase: 'joinLoc', side: 'left' });       // de 091 a 066: esquerra
    assert.deepEqual(g({ locDots: 1.5, hdgDeg: 66 }), { phase: 'joinLoc', side: 'right' });     // ja al rumb: centrar l agulla
    assert.deepEqual(g({ locDots: 0.2, hdgDeg: 70, gsDots: -3 }), { phase: 'belowGs', side: null });
    assert.deepEqual(g({ locDots: 0.2, hdgDeg: 70, gsValid: false, gsDots: null }), { phase: 'belowGs', side: null });
    assert.deepEqual(g({ locDots: 0.2, hdgDeg: 70, gsDots: 2 }), { phase: 'aboveGs', side: null });
    assert.deepEqual(g({ locDots: 0.2, hdgDeg: 70, gsDots: 0.5 }), { phase: 'established', side: null });
    assert.deepEqual(g({ hatFt: T.bottomAglFt - 1 }), { phase: 'land', side: null });
  });

  test('missatges amb els numeros de lessons.js i el costat traduit', () => {
    const run = new LessonRun('ils');
    setLang('en');
    run.sample(snap({ hatFt: 2000, aglFt: 2000, locValid: true, gsValid: true, locDots: 6, gsDots: -4, rwyHdgDeg: 66, hdgDeg: 91 }));
    assert.equal(messageText(run.instructorMessage()),
      'Intercept: hold this heading. The vertical needle (localiser) is off to the right; when it starts to move towards the centre, turn onto the runway heading.');
    run.sample(snap({ hatFt: 2000, aglFt: 2000, locValid: true, gsValid: true, locDots: 1.8, gsDots: -3, rwyHdgDeg: 66, hdgDeg: 91 }));
    assert.equal(messageText(run.instructorMessage()), 'Localiser alive: turn left towards runway heading 66° and keep the vertical needle centred.');
    run.sample(snap({ hatFt: 1200, aglFt: 1200, locValid: true, gsValid: true, locDots: 0.1, gsDots: 0.1, rwyHdgDeg: 66, hdgDeg: 66 }));
    assert.equal(run.instructorMessage().key, 'school.ils.established');
    assert.deepEqual(run.instructorMessage().params, { loc: T.locDots, gs: T.gsDots, top: T.topAglFt, bottom: T.bottomAglFt });
    setLang('ca');
    run.sample(snap({ hatFt: 2000, aglFt: 2000, locValid: true, gsValid: true, locDots: 1.8, gsDots: -3, rwyHdgDeg: 66, hdgDeg: 91 }));
    assert.equal(messageText(run.instructorMessage()), "Localitzador viu: gira a l'esquerra cap al rumb de pista 66° i mantén l'agulla vertical al centre.");
    setLang('en');
  });

  test('explica les dues agulles', () => {
    const tips = new LessonRun('ils').tips();
    assert.deepEqual(tips.map(x => x.key), ['school.tip.ilsNeedles']);
    setLang('en');
    assert.match(messageText(tips[0]), /vertical one is the localiser.*horizontal one is the glideslope/);
  });
});

describe('llico 7 (landing): l instructor parla de l arrodoniment', () => {
  test('tip amb l altura de la barra d arrodoniment de lessons.js', () => {
    const L = LESSONS.find(l => l.id === 'landing');
    const tips = new LessonRun('landing').tips();
    assert.deepEqual(tips, [{ key: 'school.tip.flare', params: { ft: L.flareBar.startAglFt } }]);
    setLang('ca');
    assert.match(messageText(tips[0]), /Des de 50 ft segueix la barra d'arrodoniment/);
    setLang('en');
  });
});

describe('objectives: llista del HUD generada dels criteris', () => {
  const EXPANDED = { stabilizedOnFinal: ['distance', 'height', 'gear', 'flaps', 'speed', 'sink', 'alignment', 'stabilizedOnFinal'],
    ilsFlown: ['locDots', 'gsDots', 'ilsFlown'] };

  test('cada llico: una fila per criteri (en ordre), mes timeLeft si te durationS', () => {
    for (const l of LESSONS) {
      const ids = new LessonRun(l.id).objectives().map(o => o.id);
      const expected = [...(l.durationS ? ['timeLeft'] : []), ...l.criteria.flatMap(c => EXPANDED[c.metric] ?? [c.metric])];
      assert.deepEqual(ids, expected, l.id);
    }
  });

  test('cada fila te clau i18n d etiqueta a en i ca', () => {
    for (const l of LESSONS) {
      for (const o of new LessonRun(l.id).objectives()) {
        assert.equal(o.labelKey, 'school.objective.' + o.id);
        assert.ok(Object.hasOwn(en, o.labelKey), 'en: ' + o.labelKey);
        assert.ok(Object.hasOwn(ca, o.labelKey), 'ca: ' + o.labelKey);
      }
    }
  });

  test('el llindar de cada fila surt de lessons.js', () => {
    const run = new LessonRun('exterior');
    assert.equal(run.objectives()[0].params.target, LESSONS.find(l => l.id === 'exterior').criteria[0].value);
    const landing = new LessonRun('landing').objectives().find(o => o.id === 'score');
    assert.equal(landing.params.target, BALANCE.school.passScore);
  });

  test('llico 1: valor actual i tic quan es compleix', () => {
    const run = new LessonRun('exterior');
    run.onView('chase');
    let [o] = run.objectives();
    assert.deepEqual([o.params.value, o.ok], [1, false]);
    for (const v of ['cockpit', 'orbit', 'tower']) run.onView(v);
    [o] = run.objectives();
    assert.deepEqual([o.params.value, o.ok], [4, true]);
  });

  test('llico 5: temps restant, graus virats i desviacio actual', () => {
    const run = new LessonRun('maneuvers');
    run.sample(snap({ altFt: 4000, hdgDeg: 0 }));
    run.sample(snap({ altFt: 4150, hdgDeg: 90 }));
    run.sample(snap({ altFt: 4050, hdgDeg: 190 }));
    const by = Object.fromEntries(run.objectives().map(o => [o.id, o]));
    assert.equal(by.timeLeft.params.value, 117);
    assert.equal(by.timeLeft.ok, false);
    assert.equal(by.altDeviationMaxFt.params.value, 50);   // la d ara, no la maxima
    assert.equal(by.altDeviationMaxFt.ok, true);
    assert.equal(by.headingChangeDeg.params.value, 190);
    assert.equal(by.headingChangeDeg.ok, true);
    setLang('en');
    assert.equal(messageText({ key: by.headingChangeDeg.labelKey, params: by.headingChangeDeg.params }), 'Turned: 190° of 180°');
    assert.equal(messageText({ key: by.timeLeft.labelKey, params: by.timeLeft.params }), 'Time left: 117 s');
  });

  test('llico 6: les condicions de D6 en viu', () => {
    const run = new LessonRun('circuit');
    const good = snap({ aglFt: 400, distThrNm: 2, rwyHdgDeg: 250, hdgDeg: 254, gearDown: true,
      flapsLanding: true, vrefKt: 110, iasKt: 118, vsFpm: -700 });
    run.sample({ ...good, gearDown: false, vsFpm: -1200 });
    let by = Object.fromEntries(run.objectives().map(o => [o.id, o]));
    assert.equal(by.gear.ok, false);
    assert.equal(by.flaps.ok, true);
    assert.equal(by.sink.ok, false);
    assert.equal(by.sink.params.value, 1200);
    run.sample(good);
    by = Object.fromEntries(run.objectives().map(o => [o.id, o]));
    for (const id of ['gear', 'flaps', 'speed', 'sink', 'alignment']) assert.equal(by[id].ok, true, id);
    assert.deepEqual(by.speed.params, { value: 118, low: 105, high: 130 });
    assert.equal(by.alignment.params.value, 4);
    assert.equal(by.stabilizedOnFinal.ok, false);
    setLang('ca');
    assert.equal(messageText({ key: by.speed.labelKey, params: by.speed.params }), 'Velocitat: 118 kt (105–130 kt)');
    setLang('en');
  });

  test('abans de la primera instantania, sense valor', () => {
    const by = Object.fromEntries(new LessonRun('circuit').objectives().map(o => [o.id, o]));
    assert.equal(by.speed.params.value, '—');
    assert.equal(by.gear.ok, false);
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
    assert.deepEqual(lessonGoalParams(LESSONS.find(l => l.id === 'ils')), { loc: 1, gs: 1, top: 1500, bottom: 500 });
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

describe('tips: explicacions de l instructor', () => {
  test('cada tip te text a en i ca i nomes fa servir comandaments de CONTROL_KEYS', () => {
    for (const l of LESSONS) for (const tip of l.tips || []) {
      assert.ok(Object.hasOwn(en, tip.key) && Object.hasOwn(ca, tip.key), tip.key);
      for (const control of Object.values(tip.keys || {})) assert.ok(Object.hasOwn(CONTROL_KEYS, control), control);
    }
  });

  test('una llico sense tips en torna cap', () => {
    assert.deepEqual(new LessonRun('cockpit').tips(), []);
  });

  test('cameraReset: una tecla que no fa servir cap altre comandament', () => {
    const others = Object.entries(CONTROL_KEYS).filter(([k]) => k !== 'cameraReset').flatMap(([, v]) => v);
    for (const code of CONTROL_KEYS.cameraReset) assert.ok(!others.includes(code), code);
  });

  test('llico 1: l instructor ensenya a girar la camera i la tecla de reinici, que surt de CONTROL_KEYS', () => {
    const tips = new LessonRun('exterior').tips();
    assert.deepEqual(tips, [{ key: 'school.tip.cameraDrag', params: { reset: keyLabel(CONTROL_KEYS.cameraReset[0]) } }]);
    setLang('en');
    assert.equal(messageText(tips[0]),
      'Outside views: hold the right mouse button and drag to turn the camera. Double-click the right button to put it back to the default angle (Home does it too).');
    setLang('ca');
    assert.equal(messageText(tips[0]),
      "Vistes exteriors: mantén premut el botó dret del ratolí i arrossega per girar la càmera. Fes doble clic amb el botó dret per tornar-la a l'angle per defecte (també amb Home).");
    setLang('en');
  });

  test('llico 1: cap criteri nou', () => {
    assert.deepEqual(LESSONS.find(l => l.id === 'exterior').criteria, [{ metric: 'viewsVisited', op: 'gte', value: 4 }]);
  });

  test('llico cockpit: la tecla de reinici de camera no identifica cap comandament', () => {
    const run = new LessonRun('cockpit');
    for (const code of CONTROL_KEYS.cameraReset) run.onKey(code);
    assert.equal(run.facts.controlsIdentified, 0);
  });
});

describe('llico 3 (taxi): l instructor explica com es roda', () => {
  test('Q i E giren la roda de morro, potencia, frens i fre d aparcament, amb les tecles de CONTROL_KEYS', () => {
    const [tip] = new LessonRun('taxi').tips();
    assert.deepEqual(tip, { key: 'school.tip.taxi',
      params: { left: 'Q', right: 'E', more: 'Shift', less: '-', brake: 'B', park: 'P' } });
    assert.deepEqual([CONTROL_KEYS.steerLeft[0], CONTROL_KEYS.steerRight[0]], ['KeyQ', 'KeyE']);
    setLang('en');
    assert.equal(messageText(tip), 'Taxiing: Q and E steer the nosewheel, Shift adds power and - takes it off, '
      + 'hold B to brake. P sets or releases the parking brake.');
    setLang('ca');
    assert.equal(messageText(tip), "Rodatge: Q i E giren la roda de morro, Shift dona potència i - en treu, "
      + "mantén B per frenar. P posa o treu el fre d'aparcament.");
    setLang('en');
  });

  test('keyLabel: el menys i el mes es mostren com a simbol', () => {
    assert.equal(keyLabel('Minus'), '-');
    assert.equal(keyLabel('NumpadSubtract'), '-');
    assert.equal(keyLabel('NumpadAdd'), '+');
  });

  test('la zona objectiu (rodona) nomes existeix a la llico taxi, i el centre es al llindar', () => {
    const m = new LessonRun('taxi').thresholdMark();
    assert.equal((m.fromM + m.toM) / 2, 0);
    assert.equal(m.halfWidthM, LESSONS.find(l => l.id === 'taxi').taxi.maxLatOffsetM);
  });
});

describe('llico 4 (takeoff): comandaments de vol i altitud MSL', () => {
  test('l instructor explica WASD i recorda Q/E, amb les tecles de CONTROL_KEYS', () => {
    const tips = new LessonRun('takeoff').tips();
    assert.deepEqual(tips, [
      { key: 'school.tip.flight', params: { down: 'W', up: 'S', left: 'A', right: 'D' } },
      { key: 'school.tip.rudder', params: { left: 'Q', right: 'E' } }
    ]);
    setLang('en');
    assert.equal(messageText(tips[0]), 'In flight: W lowers the nose and S raises it, A banks left and D banks right.');
    assert.equal(messageText(tips[1]), 'Remember: Q and E steer the nosewheel on the ground and move the rudder in the air.');
    setLang('ca');
    assert.equal(messageText(tips[0]), "En vol: W baixa el morro i S l'aixeca, A inclina a l'esquerra i D a la dreta.");
    setLang('en');
  });

  test('el comptador compta MSL, el mateix numero que l altimetre (D4 canviada), i l etiqueta diu ft', () => {
    const run = new LessonRun('takeoff');
    run.sample(snap({ altFt: 1017, aglFt: 1000 }));
    const [alt] = run.objectives();
    assert.equal(alt.params.value, 1020);                  // altimetre: Math.round(1017 / 10) * 10
    setLang('en');
    assert.equal(messageText({ key: alt.labelKey, params: alt.params }), 'Altitude: 1,020 of 3,000 ft');
    setLang('ca');
    assert.equal(messageText({ key: alt.labelKey, params: alt.params }), 'Altitud: 1.020 de 3.000 ft');
    setLang('en');
  });

  test('el comptador es del mateix pas que la instantania, sense retard', () => {
    const run = new LessonRun('takeoff');
    for (const alt of [120, 220, 320]) {
      run.sample(snap({ altFt: alt, aglFt: alt - 17 }));
      assert.equal(run.objectives()[0].params.value, alt);
    }
  });
});
