/* Proves de career/orders.js (D3+D4, D3D4-8 i D3D4-11): crear i cancel.lar
 * ordres, reserva de tirades, avions a terra i reputacio.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { careerWithCommuter, plan } from '../fixtures/careers.js';
import {
  BALANCE, validate,
  SETTLE_DRAWS, PILOT_CREW_ID, createOrder, cancelOrder, releaseGrounded, reputationDelta
} from '../../src/career/index.js';

describe('createOrder', () => {
  test('reserva les tirades, posa l avio inFlight i la cua te l ordre', () => {
    const s = careerWithCommuter(); s.rngCounter = 12;
    const r = createOrder(s, plan());
    assert.equal(r.ok, true);
    assert.equal(r.order.rngCounter, 12);
    assert.equal(r.order.id, 'O12');
    assert.equal(r.order.crewId, PILOT_CREW_ID);
    assert.equal(r.state.rngCounter, 12 + SETTLE_DRAWS.length);
    assert.equal(r.state.fleet[0].status, 'inFlight');
    assert.deepEqual(r.state.dispatch.queue, [r.order]);
    assert.equal(s.fleet[0].status, 'ready', 'no modifica l entrada');
    assert.deepEqual(validate(r.state), { ok: true, errors: [] });
  });

  test('motius, en ordre', () => {
    const s = careerWithCommuter();
    const pending = createOrder(s, plan()).state;
    assert.equal(createOrder(pending, plan()).reason, 'pending');
    assert.equal(createOrder(s, plan({ typeId: 'nb' })).reason, 'rating');
    assert.equal(createOrder(s, plan({ reg: 'EC-ZZZ' })).reason, 'unknown');
    assert.equal(createOrder(s, plan({ from: 'LEPA' })).reason, 'location');
    const busy = { ...s, fleet: [{ ...s.fleet[0], status: 'maintenance' }] };
    assert.equal(createOrder(busy, plan()).reason, 'status');
  });

  test('un contracte no toca la flota i la reg pot ser d una altra companyia', () => {
    const s = careerWithCommuter();
    const r = createOrder(s, plan({ reg: 'EC-CTR', contract: true, ticketPrice: 0 }));
    assert.equal(r.ok, true);
    assert.equal(r.state.fleet, s.fleet);
    assert.deepEqual(validate(r.state), { ok: true, errors: [] });
  });

  test('cancelOrder treu l ordre i torna l avio a ready', () => {
    const s = careerWithCommuter();
    const r = createOrder(s, plan());
    const c = cancelOrder(r.state, r.order.id);
    assert.deepEqual(c.dispatch.queue, []);
    assert.equal(c.fleet[0].status, 'ready');
    assert.equal(c.rngCounter, r.state.rngCounter, 'les tirades reservades no es tornen');
    assert.equal(cancelOrder(c, 'O999'), c);
  });
});

describe('releaseGrounded i reputationDelta', () => {
  test('els avions a terra tornen a ready quan arriba el minut', () => {
    const s = careerWithCommuter();
    const g = { ...s, fleet: [{ ...s.fleet[0], status: 'maintenance', groundedUntilMinute: 2880 }] };
    assert.equal(releaseGrounded(g, 2879), g);
    assert.equal(releaseGrounded(g, 2880).fleet[0].status, 'ready');
  });

  test('tram de la nota, accident i desviament', () => {
    const R = BALANCE.reputationChange;
    assert.equal(reputationDelta({ record: { crashCause: null, touchdown: { score: 99 } }, diverted: false }), R.landing[0].delta);
    assert.equal(reputationDelta({ record: { crashCause: null, touchdown: null }, diverted: false }), R.landing[R.landing.length - 1].delta);
    assert.equal(reputationDelta({ record: { crashCause: 'water', touchdown: null }, diverted: false }), R.crash);
    assert.equal(reputationDelta({ record: { crashCause: null, touchdown: { score: 99 } }, diverted: true }), R.landing[0].delta + BALANCE.divert.reputation);
  });
});
