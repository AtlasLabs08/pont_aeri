/* Proves de src/app/flight.js (tasca C2).
 *
 * Correr:  npm test
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { RECORD_KEYS } from '../../src/core/index.js';
import { on, _resetBus } from '../../src/app/bus.js';
import {
  setFlightLauncher, launchFlight, onFlightFinished, cancelFlight,
  isFlightInProgress, _resetFlight
} from '../../src/app/flight.js';

/** un FlightRecord minim pero complet: totes les claus de RECORD_KEYS */
function makeRecord(overrides = {}) {
  const r = {};
  for (const k of RECORD_KEYS) r[k] = null;
  return { ...r, ...overrides };
}

afterEach(() => { _resetFlight(); _resetBus(); });

describe('flight', () => {
  test('sense launcher, launchFlight llanca', () => {
    assert.throws(() => launchFlight({}));
  });

  test('dos launch seguits llancen', () => {
    setFlightLauncher(() => {});
    launchFlight({}).catch(() => {});
    assert.throws(() => launchFlight({}));
    cancelFlight();
  });

  test('launch -> onFlightFinished resol amb el record i emet flight:finished', async () => {
    let rebutOpts = null;
    setFlightLauncher(opts => { rebutOpts = opts; });
    const rebuts = [];
    on('flight:finished', r => rebuts.push(r));

    const p = launchFlight({ from: 'LEBL', to: 'LEPA' });
    assert.deepEqual(rebutOpts, { from: 'LEBL', to: 'LEPA' });

    const record = makeRecord({ from: 'LEBL', to: 'LEPA' });
    assert.equal(onFlightFinished(record), true);
    const resolved = await p;
    assert.equal(resolved, record);
    assert.deepEqual(rebuts, [record]);
  });

  test('onFlightFinished sense vol en marxa retorna false i no emet', () => {
    const rebuts = [];
    on('flight:finished', r => rebuts.push(r));
    assert.equal(onFlightFinished(makeRecord()), false);
    assert.deepEqual(rebuts, []);
  });

  test('una segona crida a onFlightFinished s ignora', async () => {
    setFlightLauncher(() => {});
    const p = launchFlight({});
    const record = makeRecord();
    assert.equal(onFlightFinished(record), true);
    assert.equal(onFlightFinished(makeRecord()), false);
    await p;
  });

  test('un record sense una clau rebutja la promesa i deixa l estat lliure', async () => {
    setFlightLauncher(() => {});
    const p = launchFlight({});
    const record = makeRecord();
    delete record.maxAltFt;
    assert.equal(onFlightFinished(record), true);
    await assert.rejects(p);
    assert.equal(isFlightInProgress(), false);
    setFlightLauncher(() => {});
    const p2 = launchFlight({});
    onFlightFinished(makeRecord());
    await p2;
  });

  test('cancelFlight resol amb null, i despres un launch nou funciona', async () => {
    setFlightLauncher(() => {});
    const p = launchFlight({});
    cancelFlight();
    assert.equal(await p, null);
    assert.equal(isFlightInProgress(), false);

    const record = makeRecord();
    const p2 = launchFlight({});
    onFlightFinished(record);
    assert.equal(await p2, record);
  });

  test('cancelFlight sense vol en marxa no fa res', () => {
    assert.doesNotThrow(() => cancelFlight());
  });

  test('opts es copia: modificar l original despres no afecta el que ha rebut el launcher', () => {
    let rebutOpts = null;
    setFlightLauncher(opts => { rebutOpts = opts; });
    const original = { from: 'LEBL', to: 'LEPA' };
    launchFlight(original).catch(() => {});
    original.from = 'CANVIAT';
    assert.equal(rebutOpts.from, 'LEBL');
    cancelFlight();
  });

  test('isFlightInProgress reflecteix l estat', () => {
    assert.equal(isFlightInProgress(), false);
    setFlightLauncher(() => {});
    launchFlight({}).catch(() => {});
    assert.equal(isFlightInProgress(), true);
    cancelFlight();
    assert.equal(isFlightInProgress(), false);
  });
});
