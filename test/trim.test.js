/* Proves de fdmSnapshot i fdmRestore (core/trim.js): restaurar un estat i
 * avancar dona exactament el mateix que no haver-lo desat. El replay de
 * Game en depen (ENGINEERING.md, seccio 4).
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  AIRCRAFT, AIRCRAFT_ORDER, FlightModel, PHYS_DT, FLAT_ENV, newCtl, trimAircraft, fdmSnapshot, fdmRestore
} from '../src/core/index.js';

const STEPS = 240;   // 2 s de fisica

/** Model en vol anivellat, trimat, amb un petit comandament de cabeceig. */
function airborne(id) {
  const cfg = AIRCRAFT[id], f = new FlightModel(cfg), ctl = newCtl();
  const tr = trimAircraft(f, { cas: 110, alt: 5000, gamma: 0, flaps: 0, gearDown: false,
    mass: cfg.mass.typical, fuel: cfg.mass.typFuel });
  assert.ok(tr.ok, id + ': el trimat ha de convergir');
  ctl.throttle = tr.throttle; ctl.trim = tr.trim; ctl.pitch = 0.05;
  return { f, ctl };
}

/** Avanca n passos i retorna una copia de l estat observable. */
function advance(f, ctl, n) {
  for (let i = 0; i < n; i++) f.step(PHYS_DT, ctl, FLAT_ENV);
  return fdmSnapshot(f);
}

describe('fdmSnapshot / fdmRestore', () => {
  for (const id of AIRCRAFT_ORDER) {
    test(id + ': restaurar i avancar dona el mateix que no haver-lo desat', () => {
      const ref = airborne(id);
      const expected = advance(ref.f, ref.ctl, STEPS);

      const { f, ctl } = airborne(id);
      const saved = fdmSnapshot(f);
      advance(f, ctl, STEPS / 2);                    // el vol "passa" i s ha de desfer
      fdmRestore(f, saved);
      const got = advance(f, ctl, STEPS);

      assert.deepEqual(got, expected);
    });
  }

  test('restaurar torna l estat desat, camp a camp', () => {
    const { f, ctl } = airborne('nb');
    const saved = fdmSnapshot(f), copy = structuredClone(saved);
    advance(f, ctl, 120);
    assert.notDeepEqual(fdmSnapshot(f), copy, 'la prova necessita que l estat hagi canviat');
    fdmRestore(f, saved);
    assert.deepEqual(fdmSnapshot(f), copy);
  });

  test('la instantania es una copia: seguir volant no la canvia', () => {
    const { f, ctl } = airborne('tp');
    const saved = fdmSnapshot(f), copy = structuredClone(saved);
    advance(f, ctl, 120);
    assert.deepEqual(saved, copy);
  });

  test('es pot restaurar mes d un cop: la mateixa instantania, el mateix resultat', () => {
    const { f, ctl } = airborne('commuter');
    const saved = fdmSnapshot(f);
    const first = advance(f, ctl, 120);
    fdmRestore(f, saved);
    assert.deepEqual(advance(f, ctl, 120), first);
    fdmRestore(f, saved);
    assert.deepEqual(advance(f, ctl, 120), first);
  });

  test('restaurar buida la cua d events', () => {
    const { f, ctl } = airborne('nb');
    const saved = fdmSnapshot(f);
    advance(f, ctl, 10);
    f.events.push({ type: 'test' });
    fdmRestore(f, saved);
    assert.equal(f.events.length, 0);
  });

  test('a terra: massa, combustible i amortidors tornen enrere', () => {
    const cfg = AIRCRAFT.nb, f = new FlightModel(cfg), ctl = newCtl();
    f.reset({ onGround: true, hdg: 0, mass: cfg.mass.typical, fuel: 1000 });
    ctl.throttle = 0.6;
    advance(f, ctl, 60);
    const saved = fdmSnapshot(f);
    const expected = advance(f, ctl, 240);
    fdmRestore(f, saved);
    const got = advance(f, ctl, 240);
    assert.deepEqual(got, expected);
    assert.ok(expected.fuel < saved.fuel, 'el combustible es crema');
  });
});
