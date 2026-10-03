/* Proves de career/orders.js (D3+D4, D3D4-8 i D3D4-11): crear i cancel.lar
 * ordres, reserva de tirades, avions a terra i reputacio.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { careerWithCommuter, plan, record } from '../fixtures/careers.js';
import {
  BALANCE, validate,
  SETTLE_DRAWS, PILOT_CREW_ID, createOrder, cancelOrder, releaseGrounded, reputationDelta,
  settleFlight, computeFlightResult, applyFlightWear, assessDamage, payInstalment, flightXp, draw, tierOf,
  rankPayMult, MINUTES_PER_DAY
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

/** ordre creada i liquidada amb el record */
function settled(extraPlan, extraRecord, seed) {
  const s = careerWithCommuter(seed);
  const r = createOrder(s, plan(extraPlan));
  return { before: r.state, order: r.order, ...settleFlight(r.state, r.order.id, record(extraRecord)) };
}

describe('settleFlight (D3D4-8)', () => {
  test('cash = abans + net - quotes - cicles - danys; prestecs, desgast, XP, logbook i ubicacio', () => {
    const { before, order, state, settlement: st } = settled();
    const rec = record();
    const res = computeFlightResult({ record: rec, mode: 'own', ticketPrice: 250, paxOnBoard: 15, crewCount: 0,
      weatherBonus: 0, revenueMult: tierOf('standard').revenueMult });
    assert.deepEqual(st.result, res);
    const loan0 = before.company.loans[0], paid = payInstalment(loan0);
    assert.equal(st.instalments, paid.paid);
    assert.equal(state.company.loans[0].balance, paid.loan.balance);
    assert.ok(state.company.loans[0].balance < loan0.balance);
    const worn = applyFlightWear(before.fleet[0], rec, tierOf('standard').wearMult);
    assert.equal(st.cycleCost, worn.cycleCost);
    assert.deepEqual(state.fleet[0].condition, worn.airframe.condition);
    assert.equal(state.fleet[0].hours, worn.airframe.hours);
    assert.equal(state.fleet[0].cycles, worn.airframe.cycles);
    assert.equal(st.damage.playerCost, 0);
    assert.equal(state.company.cash, before.company.cash + res.net - paid.paid - worn.cycleCost);
    assert.equal(st.cashAfter, state.company.cash);
    const xp = flightXp({ landingXp: res.landing.xp, turbulence: false, hardWeather: false, destination: 'LERS' });
    assert.equal(state.pilot.xp, before.pilot.xp + xp);
    assert.equal(state.pilot.logbook.length, before.pilot.logbook.length + 1);
    assert.deepEqual(state.pilot.logbook.at(-1), st.logEntry);
    assert.equal(st.logEntry.cashDelta, state.company.cash - before.company.cash);
    assert.equal(st.logEntry.arrivalMin, order.plannedArrivalMin + 2);
    assert.equal(state.fleet[0].location, 'LERS');
    assert.equal(state.fleet[0].status, 'ready');
    assert.deepEqual(state.dispatch.queue, []);
    assert.equal(state.company.flightsFlown, before.company.flightsFlown + 1);
    assert.ok(state.network.routesFlown.includes('LEBL-LERS'));
    assert.equal(state.company.reputation, before.company.reputation + reputationDelta({ record: rec, diverted: false }));
    assert.equal(state.rngCounter, before.rngCounter, 'les tirades ja eren reservades');
    assert.deepEqual(validate(state), { ok: true, errors: [] });
  });

  test('la categoria: revenueMult als ingressos i wearMult al desgast', () => {
    const s = careerWithCommuter();
    const deluxe = { ...s, fleet: [{ ...s.fleet[0], tier: 'deluxe' }] };
    const r = createOrder(deluxe, plan());
    const st = settleFlight(r.state, r.order.id, record()).settlement;
    const std = settled().settlement;
    const T = tierOf('deluxe');
    assert.equal(st.result.revenue.tickets, Math.round(std.result.revenue.tickets / tierOf('standard').revenueMult * T.revenueMult));
    assert.deepEqual(settleFlight(r.state, r.order.id, record()).state.fleet[0].condition,
      applyFlightWear(r.state.fleet[0], record(), T.wearMult).airframe.condition);
  });

  test('mateixa llavor i mateix record, mateix resultat; la partida d entrada no canvia', () => {
    const a = settled(), b = settled();
    assert.deepEqual(a.state, b.state);
    assert.deepEqual(a.settlement, b.settlement);
    const frozen = structuredClone(a.before);
    settleFlight(a.before, a.order.id, record());
    assert.deepEqual(a.before, frozen);
  });

  test('ordre de les tirades: SETTLE_DRAWS des de order.rngCounter, i la gravetat de l accident en surt', () => {
    assert.deepEqual(SETTLE_DRAWS, ['crashSeverity']);
    const { before, order, settlement: st } = settled({}, { crashCause: 'terrain', touchdown: null, landedAt: null }, 99);
    const rng = { rngSeed: before.rngSeed, rngCounter: order.rngCounter };
    assert.equal(st.draws.crashSeverity, draw(rng));
    const dmg = assessDamage({ record: record({ crashCause: 'terrain', touchdown: null }), airframeValue: before.fleet[0].value,
      mode: 'own', crashSeverity: st.draws.crashSeverity });
    assert.deepEqual(st.damage, dmg);
    assert.ok(st.damage.playerCost > 0 && st.groundedDays > 0);
  });

  test('accident: avio a terra a l origen, XP perduda i reputacio de crash', () => {
    const { before, state, settlement: st } = settled({}, { crashCause: 'terrain', touchdown: null, landedAt: null }, 5);
    assert.equal(state.fleet[0].location, 'LEBL');
    assert.equal(state.fleet[0].status, 'maintenance');
    assert.equal(state.fleet[0].groundedUntilMinute, (before.company.flightsFlown + st.groundedDays) * MINUTES_PER_DAY);
    assert.equal(st.reputation.delta, BALANCE.reputationChange.crash);
    assert.ok(st.xp.gained < 0);
    assert.equal(st.result.revenue.tickets, 0);
    assert.ok(!state.network.routesFlown.includes('LEBL-LERS'));
  });

  test('amb el pla, puntualitat i estalvi; sense pla, no es regalen', () => {
    const withPlan = settled({}, { arrivalDeltaMin: 2, fuelBurntKg: 140 }).settlement.result.revenue;
    assert.ok(withPlan.punctuality > 0);
    assert.ok(withPlan.fuelSaving > 0);
    const late = settled({}, { arrivalDeltaMin: 25 }).settlement.result.revenue;
    assert.equal(late.punctuality, 0);
    const noPlan = settled({ plannedArrivalMin: undefined, tripFuelKg: undefined }, { arrivalDeltaMin: 0, fuelPlannedKg: 350, fuelBurntKg: 140 }).settlement.result.revenue;
    assert.equal(noPlan.punctuality, 0);
    assert.equal(noPlan.fuelSaving, 0);
  });
});

describe('desviament (D3D4-7)', () => {
  test('ingressos x divert.revenueMult, reputacio i l avio queda a landedAt', () => {
    const normal = settled();
    const div = settled({}, { landedAt: 'LEGE' });
    const f = BALANCE.divert.revenueMult;
    assert.equal(div.settlement.diverted, true);
    assert.equal(div.settlement.result.revenue.tickets, Math.round(normal.settlement.result.revenue.tickets * f));
    assert.equal(div.settlement.reputation.delta, normal.settlement.reputation.delta + BALANCE.divert.reputation);
    assert.equal(div.state.fleet[0].location, 'LEGE');
    assert.equal(div.state.pilot.logbook.at(-1).to, 'LERS');
    assert.equal(div.state.pilot.logbook.at(-1).landedAt, 'LEGE');
    assert.ok(div.state.network.routesFlown.includes('LEBL-LEGE'));
    // el proper vol surt de LEGE
    assert.equal(createOrder(div.state, plan({ from: 'LEBL' })).reason, 'location');
    assert.equal(createOrder(div.state, plan({ from: 'LEGE', to: 'LEBL' })).ok, true);
  });

  test('aterrar al desti planificat no es desviament', () => {
    assert.equal(settled().settlement.diverted, false);
    assert.equal(settled({}, { landedAt: null }).settlement.diverted, false);
  });
});
