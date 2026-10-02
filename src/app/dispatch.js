/* Pestanya Dispatch, briefing i llancament dels vols d Airline (D3+D4,
 * docs/DECISIONS.md 2026-10-02, D3D4-1 a D3D4-6): models purs que ui/ nomes
 * pinta, i les operacions que canvien la partida (crear l ordre i llancar el
 * vol), que la desen i emeten 'career:changed' amb updateCareer.
 * NOU: tasques D3+D4 d ENGINEERING.md.
 *
 * EXPORTA: HOURS_PER_DAY AIRLINE_STOP_KT planOwnFlight dispatchModel departureRunwayIndex
 *          turbulenceLevel minuteParts orderOpts recorderMeta arrivalMinute finishExtras airportAt setArrivalPlanner
 *          AIRLINE_CONTACT_KM airlineClosing reportButtons
 *          planContract startFlight startOwnFlight startContract activeAirlineFlight initDispatch pendingDebrief
 *          clearDebrief debriefModel recoverStaleOrders _resetDispatch
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
 *   planContract(state, offerId, { fuelKg? }) -> el mateix pla per a una
 *     oferta de contractOffers (D3D4-9): contract true, offerId, fee, reg de
 *     l altra companyia, pax de l oferta, price 0, sense estimate. reason
 *     'unknown' si l oferta ja no hi es (el dia ha canviat).
 *   dispatchModel(state) -> { day, month, negative, aircraft: [{ airframe,
 *     name, ready, destinations: [{ icao, city, km, inRange }] }], hasPending,
 *     contracts: contractOffers amb name, fromCity i toCity }
 *     Els contractes hi son sempre, tambe amb el saldo negatiu (D3D4-9).
 *     destinations: AIRPORT_ORDER menys la ubicacio de l avio.
 *   turbulenceLevel(w) -> 'light' | 'moderate' (la que el simulador vola,
 *     toGameWeather) | 'strong' (turbulence >= 0,6), per al briefing
 *   minuteParts(minute) -> { day, hour, minute, hhmm } d un minut de partida
 *     ('09:05'), per pintar hores sense fer comptes a ui/
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
 *   finishExtras(airline, blockSeconds, landedAt, stoppedOffPavement = false)
 *     -> argument de FlightRecorder.finish: { arrivalMin, landedAt,
 *     stoppedOffPavement } amb airline, o { arrivalMin: null } sense.
 *   reportButtons({ airline }) -> botons de l informe d aterratge (revisio del
 *     PR #36, decisio del projecte): en un vol d Airline nomes 'continue' (tanca
 *     el vol amb airlineClosing i porta al debrief) i 'replay'; a Free Flight i
 *     a l escola, tambe 'restart' i 'menu', com sempre.
 *   AIRLINE_CONTACT_KM = 5
 *   airlineClosing({ leaving, contact, stopped, onGround, pavedAt })
 *     -> { action, landedAt, stoppedOffPavement }   que fa un vol d Airline
 *     (revisio del PR #36, decisio del projecte). contact = { e, n } del
 *     primer contacte amb terra, o null; stopped = a terra a menys
 *     d AIRLINE_STOP_KT; pavedAt = airportAt de la posicio actual (null fora
 *     de paviment o en vol); leaving = el pilot surt del vol.
 *       Sense contacte: 'cancel' si surt (abandonament sense cost), 'none' si no.
 *       Amb contacte, si no s ha aturat i no surt: 'none'.
 *       Aturat sobre paviment (sense sortir): 'close' a pavedAt (D3D4-7).
 *       Aturat fora de paviment, o surt: si el primer contacte es a menys
 *       d AIRLINE_CONTACT_KM km de l aeroport mes proper (nearestAirport),
 *       'close' a aquest aeroport, amb stoppedOffPavement = a terra fora de
 *       paviment; si no, 'crash' (com els tancaments automatics d index.html,
 *       'Terrain impact').
 *   setArrivalPlanner(fn)   index.html hi injecta el planificador del joc
 *     (Game.routePlan, H16-H17: descarta els caps sense ruta volable): fn(o)
 *     amb o = { aircraft, airport, dest, runway, windDir, windKt } -> { en,
 *     tailwindKt }. Per defecte (Node, proves): arrivalEnd amb el vent (H11).
 *     Sense argument torna al per defecte.
 *   AIRLINE_STOP_KT = 1   velocitat respecte de terra per sota de la qual
 *     l avio s ha aturat: index.html tanca el vol d Airline (D3D4-7)
 *   airportAt(e, n) -> ICAO de l aeroport amb paviment (airportPavedAt) en
 *     aquest punt del mon, o null (D3D4-7).
 *   startFlight(plan) -> { ok, reason?, order? }   crea l ordre
 *     (createOrder) i llanca el vol; nomes si launchFlight arrenca el vol, la
 *     desa i el deixa com a vol d Airline en marxa. reason 'none', 'launch'
 *     (launchFlight ha llancat: cap launcher o ja hi ha un altre vol en marxa;
 *     no es desa res) o el de planOwnFlight / createOrder. Si el vol s abandona (launchFlight
 *     resol null), l ordre es cancel.la i es desa. Es pot volar amb el saldo
 *     negatiu (D3D4-10 nomes bloqueja gastar).
 *   startOwnFlight(plan), startContract(plan)   startFlight nomes amb un pla
 *     del tipus que toca (reason 'contract' / 'unknown' si no).
 *   activeAirlineFlight() -> { orderId, airline } del vol en marxa, o null
 *   initDispatch()   subscriu la liquidacio a 'flight:finished' (un sol cop;
 *     airline-ui.js la crida en iniciar-se). Amb un vol d Airline en marxa:
 *     settleFlight (career/orders.js, l ordre de D3D4-8), updateCareer (desa
 *     i emet 'career:changed'), 'rank:up' { rankBefore, rankAfter } si el
 *     rang puja, i 'dispatch:resolved' { settlement, saved }. Sense vol
 *     d Airline en marxa no fa res.
 *   pendingDebrief() -> l ultim settlement, fins a clearDebrief()
 *   debriefModel(settlement) -> el compte de resultats del debrief (D3D4-12),
 *     tot del settlement: { mode, contract, route, landing, blockMin,
 *     arrivalDeltaMin, revenue: [{ key, value }], revenueTotal, costs,
 *     costsTotal (la fila finance nomes si no es 0), factor: { K, rotation, subtotal } (null al contracte), net,
 *     after: [{ key, value }] (cicles, danys i quotes, en negatiu),
 *     cashDelta, cashAfter, xp: { gained, total, rankBefore, rankAfter,
 *     rankUp, rankDown, next, remaining, progress }, wear: [{ key, before,
 *     after, delta }] o null, damage, reputation, divert } (divert null si no
 *     hi ha desviament). ui/ no fa cap compte.
 *   recoverStaleOrders() -> boolean   ordres del pilot que han quedat a la
 *     cua sense cap vol en marxa (s ha tancat el joc a mig vol): es
 *     cancel.len com un abandonament i es desa. true si n hi havia.
 *   _resetDispatch()   nomes per a proves
 */

import {
  BALANCE, routeFor, dispatchDay, dispatchMonth, departMinuteOf, routeKm, recommendedPrice, priceBounds,
  plannedPax, plannedBlockMin, tripFuelKg, minFuelKg, maxFuelKg, inRange, takeoffMassKg, weatherBonusFor,
  estimateOwnFlight, contractOffers, createOrder, cancelOrder, releaseGrounded, settleFlight, tierOf, airframeTier, MINUTES_PER_DAY, PILOT_CREW_ID
} from '../career/index.js';
import {
  AIRPORTS, AIRPORT_ORDER, AIRPORT_DEFS, weatherFor, toGameWeather, arrivalEnd, tailwindKt, MAX_TAILWIND_KT, airportPavedAt,
  nearestAirport
} from '../world/index.js';
import { AIRCRAFT, DEG } from '../core/index.js';
import { launchFlight, isFlightInProgress } from './flight.js';
import { on, emit } from './bus.js';
import { currentCareer, updateCareer } from './airline.js';

export const HOURS_PER_DAY = 24;
export const AIRLINE_STOP_KT = 1;
export const AIRLINE_CONTACT_KM = 5;
const M_PER_KM = 1000;
const MINUTES_PER_HOUR = 60;

let active = null, listening = false, lastSettlement = null;

export function activeAirlineFlight() { return active; }
export function _resetDispatch() { active = null; planner = defaultPlanner; listening = false; lastSettlement = null; }

/** D3D4-8: liquidacio del vol d Airline en marxa. Els altres vols (Free Flight, llicons) no hi passen */
function onFlightFinishedRecord(record) {
  if (!active) return;
  const { orderId } = active;
  active = null;
  const state = currentCareer();
  if (!state || !state.dispatch.queue.some(o => o.id === orderId)) return;
  const { state: next, settlement } = settleFlight(state, orderId, record);
  lastSettlement = settlement;
  const saved = updateCareer(next);
  if (settlement.xp.change === 'up') emit('rank:up', { rankBefore: settlement.xp.rankBefore, rankAfter: settlement.xp.rankAfter });
  emit('dispatch:resolved', { settlement, saved });
}

export function initDispatch() {
  if (listening) return;
  on('flight:finished', onFlightFinishedRecord);
  listening = true;
}

export function pendingDebrief() { return lastSettlement; }

const CONDITION_KEYS = ['engines', 'gear', 'airframe', 'avionics'];

export function debriefModel(st) {
  const r = st.result, own = st.mode === 'own';
  const revenue = own
    ? [['tickets', r.revenue.tickets], ['punctuality', r.revenue.punctuality], ['fuelSaving', r.revenue.fuelSaving]]
    : [['contract', r.revenue.contract]];
  const costs = own
    ? [['fuel', r.costs.fuel], ['crew', r.costs.crew], ['fees', r.costs.fees], ['maintenance', r.costs.maintenance], ['finance', r.costs.finance]]
      .filter(([key, v]) => key !== 'finance' || v !== 0)   // el lloguer (G1) encara no existeix
    : [];
  const rows = list => list.map(([key, value]) => ({ key, value }));
  const sum = list => list.reduce((s, [, v]) => s + v, 0);
  const after = own
    ? [['cycles', -st.cycleCost], ['damage', -st.damage.playerCost], ['instalments', -st.instalments]]
    : [['damage', -st.damage.playerCost]];
  const next = st.xp.next;
  const floor = BALANCE.ranks.find(k => k.key === st.xp.rankAfter).xp;
  return {
    mode: st.mode, contract: st.contract,
    route: { from: st.logEntry.from, to: st.to, landedAt: st.landedAt, diverted: st.diverted, location: st.location },
    landing: { key: r.landing.key, score: st.logEntry.score, mult: r.landing.mult },
    blockMin: st.logEntry.blockMin, arrivalDeltaMin: st.arrivalDeltaMin,
    revenue: rows(revenue), revenueTotal: sum(revenue),
    costs: rows(costs), costsTotal: sum(costs),
    factor: own ? { K: r.K, rotation: r.rotation, subtotal: sum(revenue) - sum(costs) } : null,
    net: r.net,
    after: rows(after),
    cashDelta: st.cashAfter - st.cashBefore, cashAfter: st.cashAfter,
    xp: { gained: st.xp.gained, total: st.xp.after, rankBefore: st.xp.rankBefore, rankAfter: st.xp.rankAfter,
      rankUp: st.xp.change === 'up', rankDown: st.xp.change === 'down',
      next: next ? next.key : null, remaining: next ? next.remaining : null,
      progress: next ? (st.xp.after - floor) / (next.xp - floor) : 1 },
    wear: st.wear ? CONDITION_KEYS.map(key => ({ key, before: st.wear.before[key], after: st.wear.after[key],
      delta: Math.round((st.wear.after[key] - st.wear.before[key]) * 10) / 10 })) : null,
    damage: { items: st.damage.items.map(i => ({ id: i.id, cost: i.cost, groundedDays: i.groundedDays })),
      playerCost: st.damage.playerCost, groundedDays: st.groundedDays, xpLoss: st.damage.xpLoss },
    reputation: { before: Math.round(st.reputation.before * 10) / 10, after: Math.round(st.reputation.after * 10) / 10, delta: st.reputation.delta },
    divert: st.diverted ? { landedAt: st.landedAt, revenueMult: BALANCE.divert.revenueMult, reputation: BALANCE.divert.reputation } : null
  };
}
export function clearDebrief() { lastSettlement = null; }

export function recoverStaleOrders() {
  const state = currentCareer();
  if (!state || isFlightInProgress()) return false;
  const stale = state.dispatch.queue.filter(o => o.crewId === PILOT_CREW_ID);
  if (stale.length === 0) return false;
  updateCareer(stale.reduce((s, o) => cancelOrder(s, o.id), state));
  return true;
}

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

/** hora, meteo, pista, combustible i massa d un vol, comuns al vol propi i al contracte */
function flightBasics(state, { typeId, from, to, hour }) {
  const km = routeKm(from, to), day = dispatchDay(state), month = dispatchMonth(day);
  const departMinute = departMinuteOf(day, hour);
  const blockMin = plannedBlockMin(typeId, km), plannedArrivalMin = departMinute + blockMin;
  const weather = { origin: weatherAt(state, from, departMinute), dest: weatherAt(state, to, plannedArrivalMin) };
  const arr = arrivalOf(typeId, from, to, weather.dest);
  return {
    typeId, name: nameOf(typeId), from, to, km, day, month, hour, departMinute, blockMin, plannedArrivalMin,
    seats: BALANCE.fleetTypes[typeId].seats, weather, gameWeather: toGameWeather(weather.dest),
    arrivalRunway: arr.en.id, tailwindKt: Math.round(arr.tailwindKt), alternate: null,
    tripFuelKg: tripFuelKg(typeId, km), weatherBonus: weatherBonusFor([weather.origin, weather.dest])
  };
}

/** combustible (minim, maxim, triat), massa, abast i alternatiu del pla */
function finishPlan(state, plan, fuelKg) {
  const minF = minFuelKg(plan.typeId, plan.km), maxF = maxFuelKg(plan.typeId, plan.pax);
  plan.minFuelKg = minF; plan.maxFuelKg = maxF;
  plan.fuelKg = clampInt(fuelKg ?? minF, minF, Math.max(minF, maxF));
  plan.massKg = takeoffMassKg(plan.typeId, plan.pax, plan.fuelKg);
  plan.ok = inRange(plan.typeId, plan.km, plan.pax);
  if (!plan.ok) plan.reason = 'range';
  if (plan.tailwindKt > MAX_TAILWIND_KT) plan.alternate = alternateFor(state, plan);
  return plan;
}

export function planOwnFlight(state, { reg, to, hour, price, fuelKg }) {
  const a = state.fleet.find(x => x.reg === reg);
  if (!a || !AIRPORTS[to]) return { ok: false, reason: 'unknown' };
  if (to === a.location) return { ok: false, reason: 'same' };
  const plan = { reg, contract: false, ...flightBasics(state, { typeId: a.typeId, from: a.location, to, hour }) };
  const route = routeFor(plan.from, to), bounds = priceBounds(route), rec = recommendedPrice(route);
  const ticket = clampInt(price ?? rec, bounds[0], bounds[1]);
  const W = plan.weather;
  plan.route = route; plan.recommendedPrice = rec; plan.priceBounds = bounds; plan.price = ticket;
  plan.pax = plannedPax({ route, price: ticket, typeId: plan.typeId, departMinute: plan.departMinute,
    weatherSeverity: Math.max(W.origin.severity, W.dest.severity), reputation: state.company.reputation });
  plan.revenueMult = tierOf(airframeTier(a)).revenueMult;
  plan.estimate = estimateOwnFlight({ typeId: plan.typeId, from: plan.from, to, ticketPrice: ticket, pax: plan.pax,
    crewCount: state.company.crewCount ?? 0, weatherBonus: plan.weatherBonus, revenueMult: plan.revenueMult });
  return finishPlan(state, plan, fuelKg);
}

export function planContract(state, offerId, { fuelKg } = {}) {
  const offer = contractOffers(state).find(o => o.id === offerId);
  if (!offer) return { ok: false, reason: 'unknown' };
  const plan = { reg: offer.reg, contract: true, offerId, fee: offer.fee,
    ...flightBasics(state, { typeId: offer.typeId, from: offer.from, to: offer.to, hour: offer.hour }) };
  plan.pax = offer.pax; plan.price = 0; plan.revenueMult = 1;
  return finishPlan(state, plan, fuelKg);
}

export function dispatchModel(state) {
  const day = dispatchDay(state);
  const s = releaseGrounded(state, day * MINUTES_PER_DAY);
  return {
    day, month: dispatchMonth(day), negative: state.company.cash < 0,
    hasPending: state.dispatch.queue.some(o => o.crewId === PILOT_CREW_ID),
    contracts: contractOffers(state).map(o => ({ ...o, name: nameOf(o.typeId), fromCity: AIRPORT_DEFS[o.from].city, toCity: AIRPORT_DEFS[o.to].city })),
    aircraft: s.fleet.map(a => ({
      airframe: a, name: nameOf(a.typeId), ready: a.status === 'ready' && !!AIRPORTS[a.location],
      destinations: AIRPORT_ORDER.filter(id => id !== a.location && AIRPORTS[id] && AIRPORT_DEFS[a.location]).map(id => {
        const km = routeKm(a.location, id);
        return { icao: id, city: AIRPORT_DEFS[id].city, km, inRange: inRange(a.typeId, km, 0) };
      })
    }))
  };
}

const STRONG_TURBULENCE = 0.6;   // escala 0..1 de weatherFor; moderada = la que vola el simulador (toGameWeather)

export function turbulenceLevel(w) {
  return w.turbulence >= STRONG_TURBULENCE ? 'strong' : toGameWeather(w).turb ? 'moderate' : 'light';
}

export function minuteParts(minute) {
  const day = Math.floor(minute / MINUTES_PER_DAY), m = minute - day * MINUTES_PER_DAY;
  const hour = Math.floor(m / MINUTES_PER_HOUR), min = m % MINUTES_PER_HOUR;
  return { day, hour, minute: min, hhmm: String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0') };
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

export function finishExtras(airline, blockSeconds, landedAt, stoppedOffPavement = false) {
  return airline
    ? { arrivalMin: arrivalMinute(airline, blockSeconds), landedAt: landedAt ?? null, stoppedOffPavement: stoppedOffPavement === true }
    : { arrivalMin: null };
}

export function reportButtons({ airline }) {
  return airline ? ['continue', 'replay'] : ['continue', 'replay', 'restart', 'menu'];
}

export function airlineClosing({ leaving, contact, stopped, onGround, pavedAt }) {
  if (!contact) return { action: leaving ? 'cancel' : 'none', landedAt: null, stoppedOffPavement: false };
  if (!stopped && !leaving) return { action: 'none', landedAt: null, stoppedOffPavement: false };
  if (stopped && pavedAt && !leaving) return { action: 'close', landedAt: pavedAt, stoppedOffPavement: false };
  const A = nearestAirport(contact.e, contact.n, AIRPORTS[AIRPORT_ORDER[0]]);
  if (!A || Math.hypot(contact.e - A.e, contact.n - A.n) >= AIRLINE_CONTACT_KM * M_PER_KM) {
    return { action: 'crash', landedAt: null, stoppedOffPavement: false };
  }
  return { action: 'close', landedAt: A.icao, stoppedOffPavement: !!onGround && !pavedAt };
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
  const opts = orderOpts(r.order, plan);
  // l ordre nomes existeix si el vol arrenca: si launchFlight llanca (cap launcher, o ja hi ha un altre vol en
  // marxa), no es desa res i cap vol que acabi despres no es liquida amb aquesta ordre
  let flight;
  try { flight = launchFlight(opts); } catch (e) { active = null; return { ok: false, reason: 'launch' }; }
  active = { orderId: r.order.id, airline: opts.airline };
  updateCareer(r.state);
  flight.then(record => { if (record === null) abandon(r.order.id); }, () => abandon(r.order.id));
  return { ok: true, order: r.order };
}

/** vol abandonat abans de liquidar-se: l ordre es cancel.la, sense cap cost */
function abandon(orderId) {
  if (active && active.orderId === orderId) active = null;
  const state = currentCareer();
  if (state && state.dispatch.queue.some(o => o.id === orderId)) updateCareer(cancelOrder(state, orderId));
}

export function startFlight(plan) {
  if (!plan || !plan.ok) return { ok: false, reason: plan ? plan.reason : 'unknown' };
  return launch({
    reg: plan.reg, typeId: plan.typeId, from: plan.from, to: plan.to, departMinute: plan.departMinute,
    ticketPrice: plan.price, pax: plan.pax, fuelKg: plan.fuelKg, tripFuelKg: plan.tripFuelKg,
    plannedArrivalMin: plan.plannedArrivalMin, arrivalRunway: plan.arrivalRunway, alternate: plan.alternate,
    weather: plan.weather, contract: plan.contract === true
  }, plan);
}

export function startOwnFlight(plan) {
  return startFlight(plan && plan.contract ? { ...plan, ok: false, reason: 'contract' } : plan);
}

export function startContract(plan) {
  return startFlight(plan && plan.contract ? plan : { ...plan, ok: false, reason: 'unknown' });
}
