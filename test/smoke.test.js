/* Proves de fum: que els modules carreguin i que el que ha d'estar exportat
 * hi sigui. Corren en mil.lisegons i cacen el 90% dels errors de migracio,
 * que son imports mal escrits i exports oblidats.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../src/core/index.js';
import * as world from '../src/world/index.js';
import * as app from '../src/app/index.js';

test('core exporta el que ha d exportar', () => {
  for (const name of [
    'DEG', 'FT', 'KT', 'NM', 'G0', 'FPM',
    'clamp', 'lerp', 'wrap360', 'wrapPi', 'quatFromEuler',
    'isa', 'tasFromCas', 'casFromMach',
    'AIRCRAFT', 'AIRCRAFT_ORDER',
    'FlightModel', 'PHYS_DT', 'SURF',
    'trimAircraft',
    'Autopilot', 'AutoTrim',
    'Harness', 'newCtl',
    'FlightRecorder', 'CRASH_CAUSES', 'EVENT_TYPES', 'RECORD_KEYS', 'OPTIONAL_RECORD_KEYS',
    'LandingWatch'
  ]) {
    assert.ok(name in core, `falta l export: ${name}`);
  }
});

test('world exporta el que ha d exportar', () => {
  for (const name of ['GEO', 'AIRPORTS', 'AIRPORT_ORDER', 'World', 'ILS', 'distanceKm', 'bearingDeg', 'AIRPORT_DATA', 'arrivalEnd', 'flightApproach', 'finalFix', 'approachFix', 'legFlyable', 'legMeaFt', 'planRoute', 'planArrival', 'tailwindKt', 'MAX_TAILWIND_KT', 'thresholdDistNm', 'destinationEnd',
    'buildTaxiGraph', 'taxiRoute', 'nearestOnPolyline']) {
    assert.ok(name in world, `falta l export: ${name}`);
  }
});

test('app exporta el que ha d exportar', () => {
  for (const name of [
    'TOPICS', 'on', 'off', 'emit',
    'setFlightLauncher', 'launchFlight', 'onFlightFinished', 'cancelFlight', 'isFlightInProgress',
    'CAREER_KEY', 'loadCareer', 'saveCareer', 'backupCareer', 'discardCareer',
    'LessonRun', 'lessonGoalParams', 'attemptMessage',
    'debriefRows', 'BOUNCE_PENALTY_PTS', 'TAIL_STRIKE_PENALTY_PTS',
    'openAirline', 'currentCareer', 'entryScreen', 'createAirline', 'recordLesson',
    'needsGraduation', 'graduateCareer', 'exportCareer', 'importCareer', 'topBarModel'
  ]) {
    assert.ok(name in app, `falta l export: ${name}`);
  }
});

test('hi ha deu avions i tots tenen configuracio completa', () => {
  assert.equal(core.AIRCRAFT_ORDER.length, 10);
  for (const id of core.AIRCRAFT_ORDER) {
    const c = core.AIRCRAFT[id];
    assert.ok(c, `${id} no existeix a AIRCRAFT`);
    assert.ok(c.name, `${id} sense nom`);
    assert.ok(c.mass && c.mass.typical > 0, `${id} sense massa`);
    assert.ok(c.test, `${id} sense bloc test: el harness no el pot validar`);
  }
});

test('un FlightModel es pot instanciar i avancar amb valors plausibles', () => {
  for (const id of core.AIRCRAFT_ORDER) {
    const cfg = core.AIRCRAFT[id];
    const f = new core.FlightModel(cfg);
    const ctl = core.newCtl();

    // a terra, sense motors: un segon i l avio segueix quiet, a l alcada del camp
    f.reset({ onGround: true, hdg: 0, mass: cfg.mass.typical, fuel: 1000 });
    for (let i = 0; i < 120; i++) f.step(core.PHYS_DT, ctl, core.FLAT_ENV);
    assert.ok(f.out.ias >= 0 && f.out.ias < 5, `${id}: IAS a terra fora de rang: ${f.out.ias}`);
    assert.ok(f.out.altFt > -100 && f.out.altFt < 200, `${id}: alcada a terra fora de rang: ${f.out.altFt}`);
  }
});

test('un FlightModel trimat en vol avanca mantenint velocitat i alcada', () => {
  for (const id of core.AIRCRAFT_ORDER) {
    const cfg = core.AIRCRAFT[id];
    const f = new core.FlightModel(cfg);
    const ctl = core.newCtl();
    const cas = 110;                                   // m/s, ~214 kt
    const tr = core.trimAircraft(f, { cas, alt: 1500,         // metres (~4.920 ft)
      gamma: 0, flaps: 0, gearDown: false,
      mass: cfg.mass.typical, fuel: cfg.mass.typFuel });
    ctl.throttle = tr.throttle; ctl.trim = tr.trim;
    for (let i = 0; i < 120; i++) f.step(core.PHYS_DT, ctl, core.FLAT_ENV);
    assert.ok(Number.isFinite(f.out.ias) && Number.isFinite(f.out.altFt), `${id}: sortida no finita`);
    assert.ok(f.out.ias > 190 && f.out.ias < 240, `${id}: IAS fora de rang: ${f.out.ias}`);
    assert.ok(f.out.altFt > 4700 && f.out.altFt < 5100, `${id}: alcada fora de rang: ${f.out.altFt}`);
  }
});
