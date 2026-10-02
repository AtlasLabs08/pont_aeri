/* Proves de src/app/dispatch.js (D3+D4, D3D4-1 a D3D4-6): pla del vol propi,
 * model del Dispatch, opts del launcher, meta del FlightRecorder i
 * llancament i abandonament d una ordre.
 *
 * Node no te localStorage: cada prova injecta un doble a globalThis.
 *
 * Correr:  npm test
 */

import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { careerWithCommuter, record } from '../fixtures/careers.js';
import { BALANCE, MINUTES_PER_DAY, routeKm, plannedBlockMin, minFuelKg } from '../../src/career/index.js';
import { FlightRecorder } from '../../src/core/index.js';
import { AIRPORTS, setRunwayDifficulty, MAX_TAILWIND_KT } from '../../src/world/index.js';
import { on, _resetBus } from '../../src/app/bus.js';
import { setFlightLauncher, launchFlight, cancelFlight, onFlightFinished, _resetFlight } from '../../src/app/flight.js';
import { CAREER_KEY } from '../../src/app/save.js';
import { currentCareer, updateCareer, _resetAirline } from '../../src/app/airline.js';
import {
  planOwnFlight, dispatchModel, departureRunwayIndex, orderOpts, recorderMeta, arrivalMinute, finishExtras,
  airportAt, startOwnFlight, activeAirlineFlight, setArrivalPlanner, initDispatch, pendingDebrief, clearDebrief,
  recoverStaleOrders, planContract, startContract, debriefModel, _resetDispatch
} from '../../src/app/dispatch.js';

class FakeStorage {
  constructor() { this.data = new Map(); }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}
const ORIGINAL = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

before(() => setRunwayDifficulty('normal'));
beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new FakeStorage(), configurable: true, writable: true });
  _resetAirline(); _resetDispatch(); _resetFlight();
});
afterEach(() => {
  if (ORIGINAL) Object.defineProperty(globalThis, 'localStorage', ORIGINAL); else delete globalThis.localStorage;
  _resetBus(); _resetAirline(); _resetDispatch(); _resetFlight();
});

/** vol de la FlightRecorder: block segons amb l avio en moviment */
function fly(rec, seconds) {
  const f = { out: { gs: 120, ff: 0.08, altFt: 8000, nz: 1, roll: 0 }, wow: false };
  const ctl = { pitch: 0, roll: 0 };
  for (let i = 0; i < seconds; i++) rec.sample(f, ctl, 1);
}

describe('planOwnFlight (D3D4-1, D3D4-4)', () => {
  test('Prat -> Reus amb el Mi-9: preu recomanat, pax, combustible minim i hora d arribada', () => {
    const s = careerWithCommuter();
    s.company.flightsFlown = 2;
    const p = planOwnFlight(s, { reg: 'EC-TST', to: 'LERS', hour: 9 });
    assert.equal(p.ok, true);
    assert.equal(p.from, 'LEBL');
    assert.equal(p.price, p.recommendedPrice);
    assert.equal(p.departMinute, 2 * MINUTES_PER_DAY + 9 * 60);
    assert.equal(p.plannedArrivalMin, p.departMinute + plannedBlockMin('commuter', routeKm('LEBL', 'LERS')));
    assert.equal(p.fuelKg, p.minFuelKg);
    assert.equal(p.minFuelKg, minFuelKg('commuter', p.km));
    assert.ok(p.pax > 0 && p.pax <= BALANCE.fleetTypes.commuter.seats);
    assert.equal(p.estimate.revenue.tickets, Math.round(p.price * p.pax * (1 + p.weatherBonus) * p.revenueMult));
    assert.ok(AIRPORTS.LERS.allEnds.some(en => en.id === p.arrivalRunway));
  });

  test('preu i combustible retallats als limits; mes car, menys o igual de passatgers', () => {
    const s = careerWithCommuter();
    const lo = planOwnFlight(s, { reg: 'EC-TST', to: 'LERS', hour: 9, price: 1, fuelKg: 1 });
    assert.equal(lo.price, lo.priceBounds[0]);
    assert.equal(lo.fuelKg, lo.minFuelKg);
    const hi = planOwnFlight(s, { reg: 'EC-TST', to: 'LERS', hour: 9, price: 1e9, fuelKg: 1e9 });
    assert.equal(hi.price, hi.priceBounds[1]);
    assert.equal(hi.fuelKg, hi.maxFuelKg);
    assert.ok(hi.pax <= lo.pax);
    assert.ok(hi.massKg > lo.massKg - (lo.pax - hi.pax) * BALANCE.flightPlan.kgPerPax);
  });

  test('desti igual a l origen o desconegut', () => {
    const s = careerWithCommuter();
    assert.equal(planOwnFlight(s, { reg: 'EC-TST', to: 'LEBL', hour: 9 }).reason, 'same');
    assert.equal(planOwnFlight(s, { reg: 'EC-TST', to: 'XXXX', hour: 9 }).reason, 'unknown');
  });

  test('D3D4-5: amb vent de cua a la pista d arribada, l alternatiu mes proper sense el problema', () => {
    const s = careerWithCommuter();
    // el planificador del joc (injectat) descarta caps pel terreny: aqui, LERS sempre amb 14 kt de cua
    setArrivalPlanner(o => o.dest === 'LERS' ? { en: AIRPORTS.LERS.allEnds[0], tailwindKt: 14 } : { en: AIRPORTS[o.dest].allEnds[0], tailwindKt: 0 });
    const p = planOwnFlight(s, { reg: 'EC-TST', to: 'LERS', hour: 9 });
    assert.equal(p.tailwindKt, 14);
    const others = ['LEPA', 'LEGE', 'LEIB', 'LEMH', 'LELL', 'LEDA', 'LESU'];
    const nearest = others.sort((a, b) => routeKm('LERS', a) - routeKm('LERS', b))[0];
    assert.equal(p.alternate, nearest);
    setArrivalPlanner();
    const calm = planOwnFlight(s, { reg: 'EC-TST', to: 'LERS', hour: 9 });
    assert.ok(calm.tailwindKt <= MAX_TAILWIND_KT, 'arrivalEnd mai no tria un cap amb cua si n hi ha un altre');
    assert.equal(calm.alternate, null);
  });
});

describe('dispatchModel', () => {
  test('destinacions = tots els aeroports menys la ubicacio, i el saldo negatiu', () => {
    const s = careerWithCommuter();
    const m = dispatchModel(s);
    assert.equal(m.aircraft.length, 1);
    assert.equal(m.aircraft[0].ready, true);
    assert.ok(!m.aircraft[0].destinations.some(d => d.icao === 'LEBL'));
    assert.equal(m.negative, false);
    assert.equal(dispatchModel({ ...s, company: { ...s.company, cash: -1 } }).negative, true);
  });
});

describe('launcher i FlightRecorder (D3D4-6)', () => {
  test('departureRunwayIndex: el cap amb mes vent de cara', () => {
    const A = AIRPORTS.LERS;
    const i = departureRunwayIndex(A, A.allEnds[1].hdg, 15);
    assert.equal(A.allEnds[i].id, A.allEnds[1].id);
  });

  test('orderOpts: sortida de porta en mode ruta, amb el vent del desti i el bloc airline', () => {
    const s = careerWithCommuter();
    const p = planOwnFlight(s, { reg: 'EC-TST', to: 'LERS', hour: 9 });
    const o = orderOpts({ id: 'O1', reg: 'EC-TST', from: 'LEBL', to: 'LERS', departMinute: p.departMinute,
      plannedArrivalMin: p.plannedArrivalMin, tripFuelKg: p.tripFuelKg, fuelKg: p.fuelKg, pax: p.pax }, p);
    assert.equal(o.start, 'gate');
    assert.equal(o.mode, 'route');
    assert.equal(o.dest, 'LERS');
    assert.equal(o.windDir, p.gameWeather.windDir);
    assert.deepEqual(o.airline, { orderId: 'O1', reg: 'EC-TST', departMinute: p.departMinute, plannedArrivalMin: p.plannedArrivalMin,
      tripFuelKg: p.tripFuelKg, fuelKg: p.fuelKg, paxOnBoard: p.pax, massKg: p.massKg });
  });

  test('un FlightRecord amb el pla real dona l arrivalDeltaMin correcte', () => {
    const airline = { departMinute: 600, plannedArrivalMin: 629, tripFuelKg: 160, paxOnBoard: 15 };
    const rec = new FlightRecorder();
    rec.start(recorderMeta({ aircraftTypeId: 'commuter', from: 'LEBL', to: 'LERS', fuelKg: 350, airline }));
    fly(rec, 35 * 60);
    const r = rec.finish(finishExtras(airline, rec.block, 'LERS'));
    assert.equal(arrivalMinute(airline, rec.block), 635);
    assert.equal(r.arrivalDeltaMin, 6);
    assert.equal(r.fuelPlannedKg, 160);
    assert.equal(r.paxOnBoard, 15);
  });

  test('sense airline (Free Flight i llicons), la meta i el tancament de sempre', () => {
    assert.deepEqual(recorderMeta({ aircraftTypeId: 'nb', from: 'LEBL', to: 'LEPA', fuelKg: 6500, airline: null }),
      { aircraftTypeId: 'nb', from: 'LEBL', to: 'LEPA', fuelPlannedKg: 6500, paxOnBoard: 0, plannedArrivalMin: null });
    assert.deepEqual(finishExtras(null, 1234, 'LEPA'), { arrivalMin: null });
  });

  test('airportAt: paviment de LEBL i res al mar', () => {
    const A = AIRPORTS.LEBL, en = A.allEnds[0];
    const w = A.toWorld(en.thr[0] + en.dir[0] * 500, en.thr[1] + en.dir[1] * 500);
    assert.equal(airportAt(w[0], w[1]), 'LEBL');
    assert.equal(airportAt(A.e + 30000, A.n - 30000), null);
  });
});

describe('startOwnFlight', () => {
  test('crea l ordre, la desa, llanca el vol; abandonar el cancel.la', async () => {
    updateCareer(careerWithCommuter());
    let opts = null;
    setFlightLauncher(o => { opts = o; });
    const p = planOwnFlight(currentCareer(), { reg: 'EC-TST', to: 'LERS', hour: 9 });
    const r = startOwnFlight(p);
    assert.equal(r.ok, true);
    assert.equal(opts.airline.orderId, r.order.id);
    assert.equal(activeAirlineFlight().orderId, r.order.id);
    assert.equal(currentCareer().fleet[0].status, 'inFlight');
    assert.equal(currentCareer().dispatch.queue.length, 1);
    cancelFlight();
    await new Promise(res => setTimeout(res, 0));
    assert.equal(activeAirlineFlight(), null);
    assert.equal(currentCareer().fleet[0].status, 'ready');
    assert.deepEqual(currentCareer().dispatch.queue, []);
  });
});

describe('liquidacio en flight:finished (D3D4-8)', () => {
  function flyOne(extra = {}) {
    updateCareer(careerWithCommuter());
    setFlightLauncher(() => {});
    const p = planOwnFlight(currentCareer(), { reg: 'EC-TST', to: 'LERS', hour: 9 });
    const r = startOwnFlight(p);
    return { p, order: r.order, rec: record({ paxOnBoard: p.pax, fuelPlannedKg: p.tripFuelKg, ...extra }) };
  }

  test('liquida, desa, emet dispatch:resolved i deixa el debrief pendent', () => {
    initDispatch(); initDispatch();
    const resolved = [];
    on('dispatch:resolved', e => resolved.push(e));
    const { order, rec } = flyOne();
    const cash0 = currentCareer().company.cash;
    assert.equal(onFlightFinished(rec), true);
    assert.equal(resolved.length, 1, 'una sola liquidacio encara que initDispatch es cridi dues vegades');
    const st = resolved[0].settlement;
    assert.equal(resolved[0].saved, true);
    assert.equal(st.orderId, order.id);
    assert.equal(currentCareer().company.cash, st.cashAfter);
    assert.notEqual(st.cashAfter, cash0);
    assert.equal(currentCareer().fleet[0].location, 'LERS');
    assert.deepEqual(currentCareer().dispatch.queue, []);
    assert.equal(JSON.parse(localStorage.getItem(CAREER_KEY)).company.cash, st.cashAfter);
    assert.equal(pendingDebrief(), st);
    clearDebrief();
    assert.equal(pendingDebrief(), null);
    assert.equal(activeAirlineFlight(), null);
  });

  test('rank:up quan l XP passa el llindar del rang seguent', () => {
    initDispatch();
    const ups = [];
    on('rank:up', e => ups.push(e));
    const { rec } = flyOne();
    const s = currentCareer();
    updateCareer({ ...s, pilot: { ...s.pilot, xp: BALANCE.ranks[1].xp - 1 } });
    onFlightFinished(rec);
    assert.deepEqual(ups, [{ rankBefore: 'student', rankAfter: BALANCE.ranks[1].key }]);
  });

  test('un vol que no es d Airline no es liquida', () => {
    initDispatch();
    updateCareer(careerWithCommuter());
    const resolved = [];
    on('dispatch:resolved', e => resolved.push(e));
    setFlightLauncher(() => {});
    launchFlight({});
    onFlightFinished(record());
    assert.equal(resolved.length, 0);
    assert.equal(currentCareer().company.flightsFlown, 0);
  });

  test('recoverStaleOrders: ordres del pilot sense cap vol en marxa es cancel.len', () => {
    updateCareer(careerWithCommuter());
    setFlightLauncher(() => {});
    startOwnFlight(planOwnFlight(currentCareer(), { reg: 'EC-TST', to: 'LERS', hour: 9 }));
    assert.equal(recoverStaleOrders(), false, 'el vol encara es en marxa');
    _resetFlight();
    assert.equal(recoverStaleOrders(), true);
    assert.deepEqual(currentCareer().dispatch.queue, []);
    assert.equal(currentCareer().fleet[0].status, 'ready');
  });
});

describe('contractes al Dispatch (D3D4-9)', () => {
  test('el model porta les ofertes; planContract i startContract volen l avio de l altra companyia', () => {
    initDispatch();
    const broke = careerWithCommuter();
    broke.company.cash = -1000;
    updateCareer(broke);
    const m = dispatchModel(currentCareer());
    assert.equal(m.negative, true);
    assert.equal(m.contracts.length, BALANCE.contracts.offers);
    const offer = m.contracts[0];
    const p = planContract(currentCareer(), offer.id);
    assert.equal(p.ok, true);
    assert.equal(p.contract, true);
    assert.equal(p.reg, offer.reg);
    assert.equal(p.pax, offer.pax);
    assert.equal(planContract(currentCareer(), 'C9-9').reason, 'unknown');
    let opts = null;
    setFlightLauncher(o => { opts = o; });
    const r = startContract(p);
    assert.equal(r.ok, true);
    assert.equal(r.order.contract, true);
    assert.equal(opts.aircraft, offer.typeId);
    assert.equal(opts.airport, offer.from);
    assert.equal(currentCareer().fleet[0].status, 'ready', 'la flota no es toca');
    onFlightFinished(record({ aircraftTypeId: offer.typeId, from: offer.from, to: offer.to, landedAt: offer.to, paxOnBoard: offer.pax }));
    assert.ok(currentCareer().company.cash > -1000);
    assert.equal(pendingDebrief().mode, 'contract');
    assert.equal(startContract(planOwnFlight(currentCareer(), { reg: 'EC-TST', to: 'LERS', hour: 9 })).reason, 'unknown');
  });
});

describe('debriefModel (D3D4-12)', () => {
  test('tots els numeros surten del settlement', () => {
    initDispatch();
    updateCareer(careerWithCommuter());
    setFlightLauncher(() => {});
    const p = planOwnFlight(currentCareer(), { reg: 'EC-TST', to: 'LERS', hour: 9 });
    startOwnFlight(p);
    onFlightFinished(record({ paxOnBoard: p.pax, landedAt: 'LEGE' }));
    const st = pendingDebrief(), m = debriefModel(st);
    const R = st.result;
    assert.deepEqual(m.revenue.map(r => r.value), [R.revenue.tickets, R.revenue.punctuality, R.revenue.fuelSaving]);
    assert.deepEqual(m.costs.map(c => c.value), [R.costs.fuel, R.costs.crew, R.costs.fees, R.costs.maintenance]);
    assert.equal(R.costs.finance, 0, 'sense lloguer, la fila no surt');
    assert.equal(m.net, R.net);
    assert.deepEqual(m.after.map(a => a.value), [-st.cycleCost, -st.damage.playerCost, -st.instalments]);
    assert.equal(m.net + m.after.reduce((s, a) => s + a.value, 0), m.cashDelta);
    assert.equal(m.cashAfter, currentCareer().company.cash);
    assert.equal(m.xp.gained, st.xp.gained);
    assert.equal(m.wear.length, 4);
    assert.equal(m.divert.landedAt, 'LEGE');
    assert.equal(m.route.location, 'LEGE');
    assert.equal(m.arrivalDeltaMin, 2);
    assert.ok(m.xp.progress >= 0 && m.xp.progress <= 1);
  });
});
