/* Proves de app/lesson-session.js: l intent de llico lligat al seu vol,
 * inclos reiniciar-lo (UI.restart d index.html: cancelFlight i tornar a
 * llancar la mateixa llico).
 *
 * Correr:  npm test
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  startLesson, currentLesson, currentLessonId, lastLessonId, abandonLesson
} from '../../src/app/lesson-session.js';
import { setFlightLauncher, onFlightFinished, cancelFlight, _resetFlight } from '../../src/app/flight.js';
import { LESSONS, recordLessonAttempt } from '../../src/career/index.js';
import { RECORD_KEYS } from '../../src/core/index.js';

/** FlightRecord complet amb valors neutres; over sobreescriu camps */
const record = (over = {}) => {
  const r = Object.fromEntries(RECORD_KEYS.map(k => [k, 0]));
  return { ...r, aircraftTypeId: 'commuter', from: 'LEBL', to: 'LEBL', touchdown: null,
    tailStrike: false, crashCause: null, events: [], ...over };
};

const snap = (over = {}) => ({
  replay: false, dt: 1, altFt: 4000, aglFt: 4000, hdgDeg: 70, iasKt: 180,
  gsKt: 180, vsFpm: 0, onGround: false, gearDown: false, flapsLanding: false,
  vrefKt: null, distThrNm: null, distToThrM: null, latOffsetM: null,
  rwyHdgDeg: null, locDots: null, gsDots: null, locValid: false, gsValid: false,
  ...over
});

/** deixa correr les promeses pendents (el then del vol cancel lat) */
const settle = () => new Promise(r => setImmediate(r));

/** school amb totes les llicons anteriors a lessonId aprovades */
const schoolUpTo = lessonId => ({
  lessonsPassed: LESSONS.slice(0, LESSONS.findIndex(l => l.id === lessonId)).map(l => l.id),
  attempts: {}, graduated: false
});

let launched;
beforeEach(() => {
  _resetFlight(); abandonLesson();
  launched = [];
  setFlightLauncher(opts => launched.push(opts));
});

describe('llico 5 (maneuvers): reiniciar i baixar 300 ft suspen', () => {
  test("spawn 'airborne', reiniciar, baixar 300 ft abans dels 120 s: suspen", async () => {
    const S = LESSONS.find(l => l.id === 'maneuvers').spawn;
    const opts = { start: 'airborne', spawnAglFt: S.aglFt };
    startLesson('maneuvers', opts);
    // UI.restart: cancelFlight() i tornar a llancar la mateixa llico
    cancelFlight();
    const done = startLesson('maneuvers', opts);
    await settle();
    assert.equal(launched.length, 2);
    assert.equal(launched[1].start, 'airborne');
    const run = currentLesson();
    assert.ok(run, 'la llico reiniciada ha de seguir en marxa');
    assert.equal(run.done, false);
    // baixa 300 ft en 60 s i s hi queda
    for (let s = 0; s < 120 && !run.readyToEnd(); s++) {
      const alt = S.aglFt - Math.min(300, s * 5);
      run.sample(snap({ altFt: alt, aglFt: alt, hdgDeg: (70 + s * 2) % 360 }));
    }
    assert.equal(run.readyToEnd(), true);
    onFlightFinished(record());
    const outcome = await done;
    assert.ok(outcome.facts.altDeviationMaxFt > 200);
    const result = recordLessonAttempt(schoolUpTo('maneuvers'), outcome.lessonId, outcome.facts);
    assert.equal(result.passed, false);
  });
});

describe('startLesson', () => {
  test('la LessonRun es currentLesson() mentre dura el vol', async () => {
    const done = startLesson('exterior', { start: 'runway' });
    assert.equal(currentLessonId(), 'exterior');
    for (const v of ['cockpit', 'chase', 'orbit', 'tower']) currentLesson().onView(v);
    onFlightFinished(record());
    const outcome = await done;
    assert.equal(outcome.lessonId, 'exterior');
    assert.equal(outcome.facts.viewsVisited, 4);
    assert.equal(currentLesson(), null);
  });

  test('un vol cancel lat resol null i no toca la llico nova', async () => {
    const first = startLesson('exterior', {});
    cancelFlight();
    startLesson('exterior', {});
    const fresh = currentLesson();
    assert.equal(await first, null);
    assert.equal(currentLesson(), fresh);
    assert.equal(fresh.done, false);
  });

  test('si ja hi ha un vol en marxa llanca i no canvia la llico en marxa', () => {
    startLesson('exterior', {});
    const run = currentLesson();
    assert.throws(() => startLesson('cockpit', {}));
    assert.equal(currentLesson(), run);
    assert.equal(currentLessonId(), 'exterior');
  });
});

describe('lastLessonId: Restart despres d acabar torna a la mateixa llico', () => {
  test('despres d un crash es la llico acabada', async () => {
    const done = startLesson('maneuvers', { start: 'airborne' });
    currentLesson().crash();
    onFlightFinished(record({ crashCause: 'water' }));
    await done;
    assert.equal(currentLesson(), null);
    assert.equal(lastLessonId(), 'maneuvers');
  });

  test('abandonLesson (tornar al menu) la oblida', () => {
    startLesson('maneuvers', {});
    abandonLesson();
    assert.equal(currentLesson(), null);
    assert.equal(lastLessonId(), null);
  });
});
