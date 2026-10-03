/* Proves de career/contracts.js i de la liquidacio en mode contract (D3+D4,
 * D3D4-9 i D3D4-10): determinisme, rngCounter intacte, sempre disponibles.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { careerWithCommuter, plan, record } from '../fixtures/careers.js';
import {
  BALANCE, contractOffers, createOrder, settleFlight, computeFlightResult, rankPayMult, routeKm, inRange, validate
} from '../../src/career/index.js';
import { AIRPORT_ORDER } from '../../src/world/index.js';

describe('contractOffers', () => {
  test('mateixa partida i mateix dia, mateixes ofertes; rngCounter intacte', () => {
    const s = careerWithCommuter(); s.rngCounter = 41;
    const before = structuredClone(s);
    const a = contractOffers(s), b = contractOffers(s);
    assert.deepEqual(a, b);
    assert.equal(a.length, BALANCE.contracts.offers);
    assert.deepEqual(s, before);
  });

  test('canvien amb el dia i amb la llavor', () => {
    const s = careerWithCommuter();
    const next = { ...s, company: { ...s.company, flightsFlown: 1 } };
    assert.notDeepEqual(contractOffers(s), contractOffers(next));
    assert.notDeepEqual(contractOffers(careerWithCommuter(1)), contractOffers(careerWithCommuter(2)));
  });

  test('tipus que el pilot pot volar, rutes dins del limit i de l abast, tarifa del rang', () => {
    const s = careerWithCommuter();
    for (const o of contractOffers(s)) {
      assert.ok(s.pilot.ratings.includes(BALANCE.fleetTypes[o.typeId].rating), o.typeId);
      assert.ok(AIRPORT_ORDER.includes(o.from) && AIRPORT_ORDER.includes(o.to) && o.from !== o.to);
      assert.ok(o.km <= BALANCE.contracts.maxKm && Math.abs(o.km - routeKm(o.from, o.to)) < 1e-9);
      assert.ok(inRange(o.typeId, o.km, o.pax));
      assert.ok(o.hour >= BALANCE.contracts.hours[0] && o.hour < BALANCE.contracts.hours[1]);
      assert.ok(o.pax > 0 && o.pax <= BALANCE.fleetTypes[o.typeId].seats);
      assert.equal(o.fee, Math.round(BALANCE.contractFeePerLeg[BALANCE.fleetTypes[o.typeId].cls] * rankPayMult(s.pilot.rank)));
      assert.ok(!s.fleet.some(a => a.reg === o.reg));
    }
  });

  test('disponibles amb el saldo negatiu; sense habilitacions, cap', () => {
    const s = careerWithCommuter();
    const broke = { ...s, company: { ...s.company, cash: -500000 } };
    assert.equal(contractOffers(broke).length, BALANCE.contracts.offers);
    assert.deepEqual(contractOffers({ ...s, pilot: { ...s.pilot, ratings: [] } }), []);
  });
});

describe('liquidacio en mode contract', () => {
  function contract(extraRecord, cash) {
    const s = careerWithCommuter();
    if (cash !== undefined) s.company.cash = cash;
    const r = createOrder(s, plan({ reg: 'EC-CXY', contract: true, ticketPrice: 0 }));
    return { before: r.state, ...settleFlight(r.state, r.order.id, record(extraRecord)) };
  }

  test('es cobra computeFlightResult en mode contract; ni flota, ni quotes, ni danys', () => {
    const { before, state, settlement: st } = contract();
    const res = computeFlightResult({ record: { ...record(), fuelPlannedKg: 160 }, mode: 'contract', rankPayMult: rankPayMult(before.pilot.rank) });
    assert.deepEqual(st.result, res);
    assert.equal(st.mode, 'contract');
    assert.equal(st.instalments, 0);
    assert.equal(st.cycleCost, 0);
    assert.equal(st.damage.playerCost, 0);
    assert.equal(state.company.cash, before.company.cash + res.net);
    assert.deepEqual(state.company.loans, before.company.loans);
    assert.deepEqual(state.fleet, before.fleet);
    assert.ok(state.pilot.xp > before.pilot.xp);
    assert.equal(state.company.flightsFlown, before.company.flightsFlown + 1);
    assert.equal(state.pilot.logbook.at(-1).mode, 'contract');
    assert.deepEqual(validate(state), { ok: true, errors: [] });
  });

  test('amb el saldo negatiu, un contracte el fa pujar', () => {
    const { state } = contract({}, -20000);
    assert.ok(state.company.cash > -20000);
  });

  test('un contracte desviat cobra divert.revenueMult de la tarifa', () => {
    const normal = contract().settlement, div = contract({ landedAt: 'LEGE' }).settlement;
    assert.equal(div.result.net, Math.round(normal.result.revenue.contract * BALANCE.divert.revenueMult));
    assert.equal(div.location, null);
  });
});

describe('saldo negatiu (D3D4-10): les funcions de career/ no deixen gastar', () => {
  test('comprar, contractar tripulacio i pagar habilitacions, bloquejats', async () => {
    const { buyAircraft, hireCrew, purchaseRating, purchaseRule } = await import('../../src/career/index.js');
    const s = careerWithCommuter();
    const broke = { ...s, company: { ...s.company, cash: -1 } };
    const listing = { reg: 'EC-NEG', typeId: 'commuter', tier: 'basic', yearBuilt: 2000, hours: 0, cycles: 0,
      condition: { engines: 80, gear: 80, airframe: 80, avionics: 80 }, maintenance: { nextAHours: 500, nextCHours: 6000 }, price: 100000 };
    assert.equal(buyAircraft(broke, listing, 'financed').ok, false);
    assert.equal(buyAircraft(broke, listing, 'cash').ok, false);
    assert.equal(purchaseRule({ cash: -1, loans: [], price: 1, mode: 'cash' }).ok, false);
    assert.equal(hireCrew({ cls: 'commuter', crewCount: 0, cash: -1 }).ok, false);
    assert.equal(purchaseRating({ ...broke.pilot, rank: 'private' }, -1, 'turboprop').ok, false);
  });
});
