/* Pestanya Dispatch, briefing i llancament dels vols d Airline (D3+D4,
 * docs/DECISIONS.md 2026-10-02, D3D4-1 a D3D4-6): models purs que ui/ nomes
 * pinta, i les operacions que canvien la partida (crear l ordre i llancar el
 * vol), que la desen i emeten 'career:changed' amb updateCareer.
 * NOU: tasques D3+D4 d ENGINEERING.md.
 *
 * EXPORTA: HOURS_PER_DAY planOwnFlight dispatchModel departureRunwayIndex
 *          orderOpts recorderMeta arrivalMinute finishExtras airportAt setArrivalPlanner
 *          startOwnFlight activeAirlineFlight _resetDispatch
 *
 * IMPORTA: career/ (flightplan.js, orders.js, demand.js, BALANCE...),
 *   world/ (AIRPORTS, AIRPORT_ORDER, AIRPORT_DEFS, weatherFor, toGameWeather,
 *   arrivalEnd, tailwindKt, MAX_TAILWIND_KT, airportPavedAt), AIRCRAFT de
 *   core/ (noms), launchFlight de flight.js, airline.js.
 *
 * INTERFICIE (no la canviis, ui/, index.html i els tests en depenen):
 *   planOwnFlight(state, { reg, to, hour, price?, fuelKg? }) -> pla (pur)
 *     { ok, reason?, reg, typeId, name, from, to, km, day, month, hour,
 *       departMinute, blockMin, plannedArrivalMin, route, recommendedPrice,
 *       priceBounds, price, pax, seats, weather: { origin, dest },
 *       gameWeather, arrivalRunway, tailwindKt, alternate, tripFuelKg,
 *       minFuelKg, maxFuelKg, fuelKg, massKg, weatherBonus, estimate,
 *       revenueMult }
 *     Meteo (D3D4-4) amb weatherFor(mes, hora, dia de D3D4-3): l origen a
 *     l hora de sortida i el desti a l hora d arribada prevista. El simulador
 *     nomes te un vent: vola amb el del desti (gameWeather = toGameWeather),
 *     que es el que tria la pista d arribada (arrivalEnd, H11). price per
 *     defecte el recomanat, dins de priceBounds; fuelKg per defecte el minim,
 *     dins de [minFuelKg, maxFuelKg]. alternate (D3D4-5): si la pista
 *     d arribada te mes de MAX_TAILWIND_KT de cua, l aeroport mes proper
 *     al desti amb una pista sense aquest problema (amb la seva meteo); si no,
 *     null. reason: 'unknown' (avio o desti), 'same' (desti = origen), 'range'.
 *   dispatchModel(state) -> { day, month, negative, aircraft: [{ airframe,
 *     name, ready, destinations: [{ icao, city, km, inRange }] }], hasPending }
 *     destinations: AIRPORT_ORDER menys la ubicacio de l avio.
 *   departureRunwayIndex(A, windDir, windKt) -> index a A.allEnds del cap amb
 *     mes vent de cara (sense vent, la pista mes llarga; empat, el primer).
 *   orderOpts(order, plan) -> opts del launcher (D3D4-6): { aircraft, airport,
 *     dest, runway, start: 'gate', hours, windDir, windKt, turb, mode: 'route',
 *     difficulty: 'normal', airline: { orderId, reg, departMinute,
 *     plannedArrivalMin, tripFuelKg, fuelKg, paxOnBoard, massKg } }. El launcher
 *     d index.html treu airline d opts (Game.opts no hi guanya cap camp).
 *   recorderMeta({ aircraftTypeId, from, to, fuelKg, airline })
 *     -> meta de FlightRecorder.start: amb airline, els valors reals del pla
 *     (fuelPlannedKg = tripFuelKg, paxOnBoard, plannedArrivalMin); sense (Free
 *     Flight, llicons), com fins ara: fuelPlannedKg = fuelKg, 0 i null.
 *   arrivalMinute(airline, blockSeconds, skippedSeconds = 0)
 *     = round(departMinute + (blockSeconds + skippedSeconds) / 60)
 *   finishExtras(airline, blockSeconds, landedAt) -> argument de
 *     FlightRecorder.finish: { arrivalMin, landedAt } amb airline, o
 *     { arrivalMin: null } sense.
 *   setArrivalPlanner(fn)   index.html hi injecta el planificador del joc
 *     (Game.routePlan, H16-H17: descarta els caps sense ruta volable): fn(o)
 *     amb o = { aircraft, airport, dest, runway, windDir, windKt } -> { en,
 *     tailwindKt }. Per defecte (Node, proves): arrivalEnd amb el vent (H11).
 *     Sense argument torna al per defecte.
 *   airportAt(e, n) -> ICAO de l aeroport amb paviment (airportPavedAt) en
 *     aquest punt del mon, o null (D3D4-7).
 *   startOwnFlight(plan) -> { ok, reason?, order? }   crea l ordre
 *     (createOrder), la desa i llanca el vol. reason 'none', 'negative'... o
 *     el de planOwnFlight / createOrder. Si el vol s abandona (launchFlight
 *     resol null), l ordre es cancel.la i es desa.
 *   activeAirlineFlight() -> { orderId, airline } del vol en marxa, o null
 *   _resetDispatch()   nomes per a proves
 */

import {
  BALANCE, routeFor, dispatchDay, dispatchMonth, departMinuteOf, routeKm, recommendedPrice, priceBounds,
  plannedPax, plannedBlockMin, tripFuelKg, minFuelKg, maxFuelKg, inRange, takeoffMassKg, weatherBonusFor,
  estimateOwnFlight, createOrder, cancelOrder, releaseGrounded, tierOf, airframeTier, MINUTES_PER_DAY, PILOT_CREW_ID
} from '../career/index.js';
import {
  AIRPORTS, AIRPORT_ORDER, AIRPORT_DEFS, weatherFor, toGameWeather, arrivalEnd, tailwindKt, MAX_TAILWIND_KT, airportPavedAt
} from '../world/index.js';
import { AIRCRAFT, DEG } from '../core/index.js';
import { launchFlight } from './flight.js';
import { currentCareer, updateCareer } from './airline.js';

export const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

let active = null;

export function activeAirlineFlight() { return active; }
export function _resetDispatch() { active = null; planner = defaultPlanner; }

const nameOf = typeId => AIRCRAFT[typeId] ? AIRCRAFT[typeId].name : typeId;
const clampInt = (x, lo, hi) => Math.min(hi, Math.max(lo, Math.round(x)));

/** meteo d un aeroport en un minut de partida (D3D4-3: mes i dia del minut) */
function weatherAt(state, icao, minute) {
  const day = Math.floor(minute / MINUTES_PER_DAY);
  return weatherFor({ icao, month: dispatchMonth(day), hour: Math.floor((minute % MINUTES_PER_DAY) / MINUTES_PER_HOUR), day, seed: state.rngSeed });
}

/** planificador per defecte de la pista d arribada: H11 amb el vent (arrivalEnd, sense terreny) */
function defaultPlanner(o) {
  const A = AIRPORTS[o.dest], en = arrivalEnd(A, o.windDir, o.windKt);
  return { en, tailwindKt: tailwindKt(en, o.windDir, o.windKt) };
}
let planner = defaultPlanner;

export function setArrivalPlanner(fn) { planner = typeof fn === 'function' ? fn : defaultPlanner; }

/** cap d arribada i vent de cua d un vol de from a icao amb una meteo al desti */
function arrivalOf(typeId, from, icao, w) {
  const g = toGameWeather(w);
  const o = { aircraft: typeId, airport: from, dest: icao, runway: departureRunwayIndex(AIRPORTS[from], g.windDir, g.windKt),
    windDir: g.windDir, windKt: g.windKt };
  return planner(o);
}

function alternateFor(state, plan) {
  const others = AIRPORT_ORDER.filter(id => id !== plan.to && id !== plan.from && AIRPORTS[id])
    .map(id => ({ id, km: routeKm(plan.to, id) })).sort((a, b) => a.km - b.km || (a.id < b.id ? -1 : 1));
  for (const { id } of others) {
    if (arrivalOf(plan.typeId, plan.from, id, weatherAt(state, id, plan.plannedArrivalMin)).tailwindKt <= MAX_TAILWIND_KT) return id;
  }
  return null;
}

export function planOwnFlight(state, { reg, to, hour, price, fuelKg }) {
  const a = state.fleet.find(x => x.reg === reg);
  if (!a || !AIRPORTS[to]) return { ok: false, reason: 'unknown' };
  const from = a.location, typeId = a.typeId;
  if (to === from) return { ok: false, reason: 'same' };
  const km = routeKm(from, to), day = dispatchDay(state), month = dispatchMonth(day);
  const departMinute = departMinuteOf(day, hour);
  const blockMin = plannedBlockMin(typeId, km), plannedArrivalMin = departMinute + blockMin;
  const route = routeFor(from, to), bounds = priceBounds(route), rec = recommendedPrice(route);
  const ticket = clampInt(price ?? rec, bounds[0], bounds[1]);
  const weather = { origin: weatherAt(state, from, departMinute), dest: weatherAt(state, to, plannedArrivalMin) };
  const pax = plannedPax({ route, price: ticket, typeId, departMinute, weatherSeverity: Math.max(weather.origin.severity, weather.dest.severity), reputation: state.company.reputation });
  const arr = arrivalOf(typeId, from, to, weather.dest);
  const minF = minFuelKg(typeId, km), maxF = maxFuelKg(typeId, pax);
  const fuel = clampInt(fuelKg ?? minF, minF, Math.max(minF, maxF));
  const bonus = weatherBonusFor([weather.origin, weather.dest]);
  const revenueMult = tierOf(airframeTier(a)).revenueMult;
  const plan = {
    ok: inRange(typeId, km, pax), reg, typeId, name: nameOf(typeId), from, to, km, day, month, hour,
    departMinute, blockMin, plannedArrivalMin, route, recommendedPrice: rec, priceBounds: bounds, price: ticket,
    pax, seats: BALANCE.fleetTypes[typeId].seats, weather, gameWeather: toGameWeather(weather.dest),
    arrivalRunway: arr.en.id, tailwindKt: Math.round(arr.tailwindKt), alternate: null,
    tripFuelKg: tripFuelKg(typeId, km), minFuelKg: minF, maxFuelKg: maxF, fuelKg: fuel,
    massKg: takeoffMassKg(typeId, pax, fuel), weatherBonus: bonus, revenueMult,
    estimate: estimateOwnFlight({ typeId, from, to, ticketPrice: ticket, pax, crewCount: state.company.crewCount ?? 0, weatherBonus: bonus, revenueMult })
  };
  if (!plan.ok) plan.reason = 'range';
  if (arr.tailwindKt > MAX_TAILWIND_KT) plan.alternate = alternateFor(state, plan);
  return plan;
}

export function dispatchModel(state) {
  const day = dispatchDay(state);
  const s = releaseGrounded(state, day * MINUTES_PER_DAY);
  return {
    day, month: dispatchMonth(day), negative: state.company.cash < 0,
    hasPending: state.dispatch.queue.some(o => o.crewId === PILOT_CREW_ID),
    aircraft: s.fleet.map(a => ({
      airframe: a, name: nameOf(a.typeId), ready: a.status === 'ready' && !!AIRPORTS[a.location],
      destinations: AIRPORT_ORDER.filter(id => id !== a.location && AIRPORTS[id] && AIRPORT_DEFS[a.location]).map(id => {
        const km = routeKm(a.location, id);
        return { icao: id, city: AIRPORT_DEFS[id].city, km, inRange: inRange(a.typeId, km, 0) };
      })
    }))
  };
}

export function departureRunwayIndex(A, windDir, windKt) {
  const calm = !(windKt > 0);
  const score = en => calm ? en.rw.len : windKt * Math.cos((windDir - en.hdg) * DEG);
  let best = 0;
  A.allEnds.forEach((en, i) => { if (score(en) > score(A.allEnds[best]) + 1e-9) best = i; });
  return best;
}

export function orderOpts(order, plan) {
  const g = plan.gameWeather;
  return {
    aircraft: plan.typeId, airport: order.from, dest: order.to,
    runway: departureRunwayIndex(AIRPORTS[order.from], g.windDir, g.windKt),
    start: 'gate', hours: plan.hour, windDir: g.windDir, windKt: g.windKt, turb: g.turb,
    mode: 'route', difficulty: 'normal',
    airline: {
      orderId: order.id, reg: order.reg, departMinute: order.departMinute, plannedArrivalMin: order.plannedArrivalMin,
      tripFuelKg: order.tripFuelKg, fuelKg: order.fuelKg, paxOnBoard: order.pax, massKg: plan.massKg
    }
  };
}

export function recorderMeta({ aircraftTypeId, from, to, fuelKg, airline }) {
  if (!airline) return { aircraftTypeId, from, to, fuelPlannedKg: fuelKg, paxOnBoard: 0, plannedArrivalMin: null };
  return { aircraftTypeId, from, to, fuelPlannedKg: airline.tripFuelKg, paxOnBoard: airline.paxOnBoard,
    plannedArrivalMin: airline.plannedArrivalMin };
}

export function arrivalMinute(airline, blockSeconds, skippedSeconds = 0) {
  return Math.round(airline.departMinute + (blockSeconds + skippedSeconds) / 60);
}

export function finishExtras(airline, blockSeconds, landedAt) {
  return airline ? { arrivalMin: arrivalMinute(airline, blockSeconds), landedAt: landedAt ?? null } : { arrivalMin: null };
}

export function airportAt(e, n) {
  for (const id of AIRPORT_ORDER) {
    const A = AIRPORTS[id];
    if (!A) continue;
    const l = A.toLocal(e, n);
    if (airportPavedAt(A, l[0], l[1])) return id;
  }
  return null;
}

/** crea l ordre del pla, la desa i llanca el vol */
function launch(planFields, plan) {
  const saved = currentCareer();
  if (!saved) return { ok: false, reason: 'none' };
  const state = releaseGrounded(saved, dispatchDay(saved) * MINUTES_PER_DAY);
  const r = createOrder(state, planFields);
  if (!r.ok) return r;
  updateCareer(r.state);
  const opts = orderOpts(r.order, plan);
  active = { orderId: r.order.id, airline: opts.airline };
  launchFlight(opts).then(record => { if (record === null) abandon(r.order.id); }, () => abandon(r.order.id));
  return { ok: true, order: r.order };
}

/** vol abandonat abans de liquidar-se: l ordre es cancel.la, sense cap cost */
function abandon(orderId) {
  if (active && active.orderId === orderId) active = null;
  const state = currentCareer();
  if (state && state.dispatch.queue.some(o => o.id === orderId)) updateCareer(cancelOrder(state, orderId));
}

export function startOwnFlight(plan) {
  if (!plan || !plan.ok) return { ok: false, reason: plan ? plan.reason : 'unknown' };
  return launch({
    reg: plan.reg, typeId: plan.typeId, from: plan.from, to: plan.to, departMinute: plan.departMinute,
    ticketPrice: plan.price, pax: plan.pax, fuelKg: plan.fuelKg, tripFuelKg: plan.tripFuelKg,
    plannedArrivalMin: plan.plannedArrivalMin, arrivalRunway: plan.arrivalRunway, alternate: plan.alternate,
    weather: plan.weather, contract: false
  }, plan);
}
