/* Proves de career/flightplan.js (D3+D4, D3D4-1 a D3D4-4): dia i mes de
 * partida, preu recomanat, passatgers, durada, combustible i massa del pla.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  BALANCE, createCareer, routeFor, demandPax, MINUTES_PER_DAY,
  dispatchDay, dispatchMonth, departMinuteOf, routeKm, recommendedPrice, priceBounds, plannedPax,
  plannedBlockMin, tripFuelKg, minFuelKg, maxFuelKg, inRange, takeoffMassKg, weatherBonusFor, estimateOwnFlight
} from '../../src/career/index.js';
import { AIRCRAFT } from '../../src/core/index.js';
import { HARD_SEVERITY } from '../../src/world/index.js';

describe('D3D4-3: dia, mes i departMinute', () => {
  test('dia = vols fets; mes = 1 + floor(dia / 30) mod 12', () => {
    const s = createCareer({ name: 'x', seed: 1, createdAt: '' });
    s.company.flightsFlown = 47;
    assert.equal(dispatchDay(s), 47);
    assert.equal(dispatchMonth(0), 1);
    assert.equal(dispatchMonth(29), 1);
    assert.equal(dispatchMonth(30), 2);
    assert.equal(dispatchMonth(359), 12);
    assert.equal(dispatchMonth(360), 1);
  });

  test('departMinute = dia * 1440 + hora * 60, i clock.minute no canvia', () => {
    const s = createCareer({ name: 'x', seed: 1, createdAt: '' });
    s.company.flightsFlown = 3; s.clock.minute = 17;
    const before = structuredClone(s);
    assert.equal(departMinuteOf(dispatchDay(s), 9), 3 * MINUTES_PER_DAY + 540);
    dispatchMonth(dispatchDay(s));
    assert.deepEqual(s, before);
    assert.throws(() => departMinuteOf(1, 24));
    assert.throws(() => departMinuteOf(-1, 3));
  });
});

describe('preu recomanat i passatgers', () => {
  const route = routeFor('LEBL', 'LERS');

  test('preu recomanat = pRef arrodonit; limits 0,5x i 2x', () => {
    assert.equal(recommendedPrice(route), Math.round(route.pRef));
    const [lo, hi] = priceBounds(route);
    assert.equal(lo, Math.round(route.pRef * BALANCE.ticketPriceRange[0]));
    assert.equal(hi, Math.round(route.pRef * BALANCE.ticketPriceRange[1]));
  });

  test('passatgers = demandPax amb els seients del tipus; mes car, menys passatgers', () => {
    const args = { route, typeId: 'tp', departMinute: 600, weatherSeverity: 0, reputation: 50 };
    const p = plannedPax({ ...args, price: 200 });
    assert.equal(p, demandPax({ route, price: 200, seats: BALANCE.fleetTypes.tp.seats, minute: 600, reputation: 50 }));
    assert.ok(plannedPax({ ...args, price: 400 }) <= p);
    assert.ok(plannedPax({ ...args, price: 1 }) <= BALANCE.fleetTypes.tp.seats);
    assert.ok(plannedPax({ ...args, price: 200, weatherSeverity: 1 }) <= p);
  });
});

describe('combustible i durada del pla (D3D4-4)', () => {
  const km = routeKm('LEBL', 'LERS');

  test('LEBL-LERS ~ 80-90 km', () => {
    assert.ok(km > 75 && km < 95, String(km));
    assert.equal(routeKm('LERS', 'LEBL'), km);
    assert.throws(() => routeKm('LEBL', 'XXXX'));
  });

  test('durada i combustible del trajecte segons les dades del tipus', () => {
    const P = BALANCE.flightPlan;
    const block = plannedBlockMin('commuter', km);
    assert.equal(block, Math.round(P.fixedMin.commuter + km / P.perf.commuter.kmh * 60));
    assert.equal(tripFuelKg('commuter', km), Math.round(P.perf.commuter.kgPerHour * block / 60));
    assert.ok(plannedBlockMin('commuter', 2 * km) > block);
  });

  test('minim = trajecte + contingencia + reserva; maxim = diposit i MTOW', () => {
    const P = BALANCE.flightPlan, trip = tripFuelKg('commuter', km);
    assert.equal(minFuelKg('commuter', km), Math.round(trip * (1 + P.contingencyPct) + P.perf.commuter.kgPerHour * P.reserveMin / 60));
    const m = AIRCRAFT.commuter.mass;
    assert.equal(maxFuelKg('commuter', 0), Math.min(m.maxFuel, m.mtow - m.empty));
    assert.equal(maxFuelKg('commuter', 19), Math.floor(Math.min(m.maxFuel, m.mtow - m.empty - 19 * P.kgPerPax)));
    assert.ok(minFuelKg('commuter', km) < maxFuelKg('commuter', 19));
    assert.ok(inRange('commuter', km, 19));
    assert.equal(inRange('commuter', 20000, 19), false);
  });

  test('massa = buit + passatgers * kgPerPax + combustible', () => {
    assert.equal(takeoffMassKg('commuter', 10, 500), AIRCRAFT.commuter.mass.empty + 10 * BALANCE.flightPlan.kgPerPax + 500);
  });
});

describe('meteo i estimacio', () => {
  test('weatherBonusFor: 0 sense meteo dura; el maxim de les dures', () => {
    assert.equal(weatherBonusFor([{ hard: false, severity: 0.5 }, null]), 0);
    assert.equal(weatherBonusFor([{ hard: true, severity: HARD_SEVERITY }]), BALANCE.weatherBonus.min);
    assert.ok(Math.abs(weatherBonusFor([{ hard: true, severity: 1 }, { hard: true, severity: 0.8 }]) - BALANCE.weatherBonus.max) < 1e-9);
  });

  test('estimateOwnFlight: ingressos dels bitllets = preu * pax a m 1', () => {
    const r = estimateOwnFlight({ typeId: 'commuter', from: 'LEBL', to: 'LERS', ticketPrice: 300, pax: 15 });
    assert.equal(r.revenue.tickets, 300 * 15);
    assert.equal(r.landing.mult, 1);
    assert.ok(Number.isInteger(r.net));
  });
});
