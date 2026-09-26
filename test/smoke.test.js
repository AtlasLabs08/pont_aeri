/* Proves de fum: que els modules carreguin i que el que ha d'estar exportat
 * hi sigui. Corren en mil.lisegons i cacen el 90% dels errors de migracio,
 * que son imports mal escrits i exports oblidats.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../src/core/index.js';
import * as world from '../src/world/index.js';

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
    'FlightRecorder', 'CRASH_CAUSES', 'EVENT_TYPES', 'RECORD_KEYS'
  ]) {
    assert.ok(name in core, `falta l export: ${name}`);
  }
});

test('world exporta el que ha d exportar', () => {
  for (const name of ['GEO', 'AIRPORTS', 'AIRPORT_ORDER', 'World', 'ILS']) {
    assert.ok(name in world, `falta l export: ${name}`);
  }
});

test('hi ha quatre avions i tots tenen configuracio completa', () => {
  assert.equal(core.AIRCRAFT_ORDER.length, 4);
  for (const id of core.AIRCRAFT_ORDER) {
    const c = core.AIRCRAFT[id];
    assert.ok(c, `${id} no existeix a AIRCRAFT`);
    assert.ok(c.name, `${id} sense nom`);
    assert.ok(c.mass && c.mass.typical > 0, `${id} sense massa`);
    assert.ok(c.test, `${id} sense bloc test: el harness no el pot validar`);
  }
});

test('un FlightModel es pot instanciar i avancar sense petar', () => {
  const id = core.AIRCRAFT_ORDER[0];
  const cfg = core.AIRCRAFT[id];
  const f = new core.FlightModel(cfg);
  const ctl = core.newCtl();

  f.reset({ onGround: true, hdg: 0, mass: cfg.mass.typical, fuel: 1000 });
  for (let i = 0; i < 120; i++) f.step(core.PHYS_DT, ctl, core.FLAT_ENV);

  assert.ok(isFinite(f.out.ias), 'IAS no finita despres d un segon de simulacio');
  assert.ok(isFinite(f.out.altFt), 'sense altitud a out');
});
