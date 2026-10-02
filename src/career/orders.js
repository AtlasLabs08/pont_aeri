/* Ordres de vol del Dispatch (D3+D4, docs/DECISIONS.md 2026-10-02): crear-les,
 * cancel.lar-les i liquidar-les quan el vol acaba (settleFlight). Una ordre
 * existeix mentre el vol es pendent; en liquidar-se surt de la cua i queda al
 * logbook (D3D4-11). Funcions pures: no modifiquen la partida que reben, en
 * retornen una de nova. Desar i emetre es feina d app/.
 * NOU: tasques D3+D4 d ENGINEERING.md.
 *
 * EXPORTA: SETTLE_DRAWS PILOT_CREW_ID createOrder cancelOrder releaseGrounded
 *          reputationDelta settleFlight
 *
 * INTERFICIE (no la canviis, app/ i els tests en depenen):
 *   SETTLE_DRAWS = ['crashSeverity']   tirades de draw(state) de cada vol, en
 *     aquest ordre fix. createOrder les reserva: order.rngCounter = el
 *     rngCounter de la partida i la partida l avanca SETTLE_DRAWS.length.
 *     settleFlight les tira sobre { rngSeed, rngCounter: order.rngCounter },
 *     totes, sempre (tambe sense accident): aixi el resultat nomes depen de la
 *     partida desada i del record, i una tirada nova va al final de la llista.
 *   PILOT_CREW_ID = 'pilot'   crewId dels vols que pilota el jugador
 *   createOrder(state, plan) -> { ok: true, state, order } o { ok: false, reason }
 *     plan: { reg, typeId, from, to, departMinute, ticketPrice, pax, fuelKg,
 *     tripFuelKg, plannedArrivalMin, arrivalRunway, alternate, weather, contract }.
 *     reason, en aquest ordre: 'pending' (ja hi ha un vol del pilot a la
 *     cua), 'rating' (el pilot no pot volar el tipus), i nomes als vols
 *     propis: 'unknown' (la reg no es de la flota), 'type' (typeId no hi
 *     coincideix), 'status' (no es 'ready'), 'location' (no es a from).
 *     id = 'O' + rngCounter. L avio propi passa a 'inFlight'.
 *   cancelOrder(state, orderId) -> partida sense l ordre i, si l avio era
 *     'inFlight', de nou 'ready'. Les tirades reservades no es tornen.
 *     Sense aquesta ordre, la mateixa partida.
 *   releaseGrounded(state, minute) -> els avions 'maintenance' amb
 *     groundedUntilMinute <= minute passen a 'ready' (la mateixa partida si no
 *     en canvia cap).
 *   reputationDelta({ record, diverted }) -> punts: el tram de
 *     reputationChange.landing de la nota (crash: reputationChange.crash;
 *     sense touchdown, el de nota 0), mes divert.reputation si diverted.
 *   settleFlight(state, orderId, record) -> { state, settlement }
 *     La liquidacio (D3D4-8). Una sola crida a computeFlightResult (mode
 *     'own' o 'contract'; revenueMult = el de la categoria, per
 *     divert.revenueMult si l avio ha aterrat a un altre aeroport; al mode
 *     contract el factor de desviament s aplica al pagament i al net) i
 *     despres, en aquest ordre: cash + net; quotes de tots els prestecs vius
 *     (nomes vols propis; redueixen el capital pendent, el prestec tornat es
 *     queda amb balance 0); applyFlightWear amb el wearMult de la categoria
 *     (nomes propis; resta cycleCost); assessDamage (playerCost; en contracte,
 *     0) i, si hi ha dies a terra, status 'maintenance' i groundedUntilMinute
 *     = (dia + dies) * MINUTES_PER_DAY; XP (flightXp - xpLoss, applyXp) i
 *     rang; reputacio (reputationDelta, retallada a 0..100); flightsFlown + 1,
 *     lifetimeRevenue, routesFlown; ubicacio (landedAt; sense, el desti, o
 *     l origen si no ha aterrat); logbook (append) i l ordre surt de la cua.
 *     El pla mana: fuelPlannedKg = order.tripFuelKg i arrivalDeltaMin el del
 *     record; una ordre sense tripFuelKg o sense plannedArrivalMin no cobra
 *     l estalvi de combustible ni la puntualitat (no es regalen).
 *     settlement: { orderId, mode, contract, result, instalments, cycleCost,
 *     damage, xp: { gained, before, after, rankBefore, rankAfter, change,
 *     next }, reputation: { before, after, delta }, wear: { before, after } o
 *     null, diverted, landedAt, to, location, groundedDays, cashBefore,
 *     cashAfter, draws, logEntry }. Llanca un Error si l ordre no hi es.
 */

import { toGameWeather } from '../world/index.js';
import { BALANCE } from './balance.js';
import { MINUTES_PER_DAY } from './util.js';
import { draw } from './rng.js';
import { routeKey } from './demand.js';
import { computeFlightResult } from './economy.js';
import { applyFlightWear } from './wear.js';
import { assessDamage } from './damage.js';
import { flightXp, applyXp, rankPayMult, canFlyType, nextRank } from './progression.js';
import { payInstalment } from './finance.js';
import { tierOf, airframeTier } from './market.js';
import { weatherBonusFor, dispatchDay } from './flightplan.js';

export const SETTLE_DRAWS = Object.freeze(['crashSeverity']);
export const PILOT_CREW_ID = 'pilot';

const REPUTATION_MAX = 100;     // escala de la reputacio (esquema, state.js)

const PLAN_KEYS = ['typeId', 'pax', 'fuelKg', 'tripFuelKg', 'plannedArrivalMin', 'arrivalRunway', 'alternate', 'weather', 'contract'];

export function createOrder(state, plan) {
  if (state.dispatch.queue.some(o => o.crewId === PILOT_CREW_ID)) return { ok: false, reason: 'pending' };
  if (!canFlyType(state.pilot, plan.typeId)) return { ok: false, reason: 'rating' };
  const contract = plan.contract === true;
  let fleet = state.fleet;
  if (!contract) {
    const a = state.fleet.find(x => x.reg === plan.reg);
    if (!a) return { ok: false, reason: 'unknown' };
    if (a.typeId !== plan.typeId) return { ok: false, reason: 'type' };
    if (a.status !== 'ready') return { ok: false, reason: 'status' };
    if (a.location !== plan.from) return { ok: false, reason: 'location' };
    fleet = state.fleet.map(x => x.reg === a.reg ? { ...x, status: 'inFlight' } : x);
  }
  const order = {
    id: 'O' + state.rngCounter, reg: plan.reg, from: plan.from, to: plan.to, crewId: PILOT_CREW_ID,
    departMinute: plan.departMinute, ticketPrice: plan.ticketPrice, rngCounter: state.rngCounter
  };
  for (const k of PLAN_KEYS) if (plan[k] !== undefined) order[k] = structuredClone(plan[k]);
  order.contract = contract;
  return {
    ok: true, order,
    state: { ...state, rngCounter: state.rngCounter + SETTLE_DRAWS.length, fleet,
      dispatch: { ...state.dispatch, queue: [...state.dispatch.queue, order] } }
  };
}

export function cancelOrder(state, orderId) {
  const order = state.dispatch.queue.find(o => o.id === orderId);
  if (!order) return state;
  return {
    ...state,
    fleet: order.contract ? state.fleet : state.fleet.map(a => a.reg === order.reg && a.status === 'inFlight' ? { ...a, status: 'ready' } : a),
    dispatch: { ...state.dispatch, queue: state.dispatch.queue.filter(o => o.id !== orderId) }
  };
}

export function releaseGrounded(state, minute) {
  if (!state.fleet.some(a => a.status === 'maintenance' && a.groundedUntilMinute <= minute)) return state;
  return { ...state, fleet: state.fleet.map(a => a.status === 'maintenance' && a.groundedUntilMinute <= minute ? { ...a, status: 'ready' } : a) };
}

export function reputationDelta({ record, diverted }) {
  const R = BALANCE.reputationChange;
  let d;
  if (record.crashCause != null) d = R.crash;
  else {
    const score = record.touchdown ? record.touchdown.score : 0;
    d = (R.landing.find(b => score >= b.min) ?? R.landing[R.landing.length - 1]).delta;
  }
  return d + (diverted ? BALANCE.divert.reputation : 0);
}

export function settleFlight(state, orderId, record) {
  const order = state.dispatch.queue.find(o => o.id === orderId);
  if (!order) throw new Error('settleFlight: no hi ha cap ordre ' + orderId);
  const contract = order.contract === true;
  const mode = contract ? 'contract' : 'own';
  const co = state.company;

  // tirades reservades, en l ordre de SETTLE_DRAWS
  const rng = { rngSeed: state.rngSeed, rngCounter: order.rngCounter };
  const draws = {};
  for (const k of SETTLE_DRAWS) draws[k] = draw(rng);

  const crashed = record.crashCause != null;
  const landedAt = record.landedAt ?? null;
  const diverted = landedAt !== null && landedAt !== order.to;
  const airframe = contract ? null : state.fleet.find(a => a.reg === order.reg);
  if (!contract && !airframe) throw new Error('settleFlight: l avio ' + order.reg + ' no es a la flota');
  const typeId = record.aircraftTypeId;
  const tier = tierOf(airframe ? airframeTier(airframe) : null);
  const weathers = order.weather ? [order.weather.origin, order.weather.dest] : [];
  const divertMult = diverted ? BALANCE.divert.revenueMult : 1;

  // sense pla (ordre sense plannedArrivalMin o sense tripFuelKg) no hi ha puntualitat ni estalvi que premiar
  const rec = {
    ...record,
    arrivalDeltaMin: order.plannedArrivalMin != null ? record.arrivalDeltaMin : Infinity,
    fuelPlannedKg: order.tripFuelKg != null ? order.tripFuelKg : 0
  };

  // 1. una sola crida a computeFlightResult
  let result = computeFlightResult({
    record: rec, mode, ticketPrice: order.ticketPrice, paxOnBoard: order.pax ?? record.paxOnBoard,
    crewCount: co.crewCount ?? 0, rankPayMult: rankPayMult(state.pilot.rank),
    weatherBonus: weatherBonusFor(weathers), exclusive: false, financePerFlight: 0,
    revenueMult: tier.revenueMult * divertMult
  });
  if (contract && diverted) {
    const pay = Math.round(result.revenue.contract * divertMult);
    result = { ...result, revenue: { ...result.revenue, contract: pay }, net: pay };
  }
  const cashBefore = co.cash;
  let cash = co.cash + result.net;

  // 2. quotes dels prestecs (nomes vols propis: un contracte no gasta les quotes)
  let instalments = 0, loans = co.loans;
  if (!contract) {
    loans = co.loans.map(l => {
      const p = payInstalment(l);
      instalments += p.paid;
      return { ...p.loan, id: l.id };
    });
    cash -= instalments;
  }

  // 3. desgast amb el wearMult de la categoria
  let af = airframe, cycleCost = 0;
  if (!contract) {
    const w = applyFlightWear(airframe, record, tier.wearMult);
    af = w.airframe; cycleCost = w.cycleCost;
    cash -= cycleCost;
  }

  // 4. danys
  const damage = assessDamage({ record, airframeValue: af ? af.value : BALANCE.usedPrice[typeId], mode, crashSeverity: draws.crashSeverity });
  cash -= damage.playerCost;
  const day = dispatchDay(state);

  // 5. XP i rang
  const xpGained = flightXp({
    landingXp: result.landing.xp,
    turbulence: weathers.some(w => w && toGameWeather(w).turb),
    hardWeather: weathers.some(w => w && w.hard),
    destination: landedAt ?? order.to
  }) - damage.xpLoss;
  const up = applyXp(state.pilot, xpGained);

  // 6. reputacio
  const repDelta = reputationDelta({ record, diverted });
  const repAfter = Math.min(REPUTATION_MAX, Math.max(0, co.reputation + repDelta));

  // 7. hores i cicles (applyFlightWear), vols de la companyia i rutes
  const landed = !!record.touchdown && !crashed;
  const arrivedAt = landedAt ?? (landed ? order.to : order.from);
  const routes = state.network.routesFlown;
  const key = routeKey(order.from, arrivedAt);
  const routesFlown = landed && arrivedAt !== order.from && !routes.includes(key) ? [...routes, key] : routes;

  // 8. ubicacio i estat de l avio
  let fleet = state.fleet;
  if (!contract) {
    const grounded = damage.groundedDays > 0;
    af = { ...af, location: arrivedAt, status: grounded ? 'maintenance' : 'ready',
      groundedUntilMinute: grounded ? (day + damage.groundedDays) * MINUTES_PER_DAY : af.groundedUntilMinute };
    fleet = state.fleet.map(a => a.reg === af.reg ? af : a);
  }

  // 9. logbook (append) i l ordre surt de la cua
  cash = Math.round(cash);
  const logEntry = {
    orderId: order.id, mode, day, departMinute: order.departMinute,
    arrivalMin: order.plannedArrivalMin != null ? order.plannedArrivalMin + record.arrivalDeltaMin : order.departMinute + Math.round(record.blockSeconds / 60),
    reg: order.reg, typeId, from: order.from, to: order.to, landedAt,
    blockMin: Math.round(record.blockSeconds / 60), score: record.touchdown ? record.touchdown.score : null,
    pax: order.pax ?? record.paxOnBoard, net: result.net, cashDelta: cash - cashBefore, xp: xpGained
  };
  const revenue = result.revenue.tickets + result.revenue.contract + result.revenue.punctuality + result.revenue.fuelSaving;

  const next = {
    ...state,
    pilot: { ...up.pilot, logbook: [...state.pilot.logbook, logEntry] },
    company: { ...co, cash, loans, reputation: repAfter, flightsFlown: co.flightsFlown + 1, lifetimeRevenue: co.lifetimeRevenue + revenue },
    fleet,
    network: { ...state.network, routesFlown },
    dispatch: { ...state.dispatch, queue: state.dispatch.queue.filter(o => o.id !== order.id) }
  };
  return {
    state: next,
    settlement: {
      orderId: order.id, mode, contract, result, instalments, cycleCost, damage,
      xp: { gained: xpGained, before: state.pilot.xp, after: up.pilot.xp, rankBefore: up.rankBefore, rankAfter: up.rankAfter,
        change: up.change, next: nextRank(up.pilot.xp) },
      reputation: { before: co.reputation, after: repAfter, delta: repDelta },
      wear: contract ? null : { before: { ...airframe.condition }, after: { ...af.condition } },
      diverted, landedAt, to: order.to, location: contract ? null : arrivedAt, groundedDays: contract ? 0 : damage.groundedDays,
      cashBefore, cashAfter: cash, draws, logEntry
    }
  };
}
