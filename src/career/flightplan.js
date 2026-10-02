/* Pla d un vol propi o de contracte (D3+D4, docs/DECISIONS.md 2026-10-02,
 * D3D4-1 a D3D4-4): dia i mes de partida mentre no hi ha rellotge, preu
 * recomanat, passatgers previstos, durada i combustible del pla, massa i
 * m_ruta de la meteo. Funcions pures: no toquen el CareerState.
 * NOU: tasques D3+D4 d ENGINEERING.md.
 *
 * EXPORTA: dispatchDay dispatchMonth departMinuteOf routeKm recommendedPrice
 *          priceBounds plannedPax plannedBlockMin tripFuelKg minFuelKg
 *          maxFuelKg inRange takeoffMassKg weatherBonusFor estimateOwnFlight
 *
 * IMPORTA: AIRCRAFT de core/ (masses), AIRPORT_DEFS, distanceKm i
 *   HARD_SEVERITY de world/ (dades), demand.js i economy.js.
 *
 * INTERFICIE (no la canviis, app/ i els tests en depenen):
 *   dispatchDay(state) = company.flightsFlown (D3D4-3: fins al rellotge de l E1)
 *   dispatchMonth(day) = 1 + (floor(day / 30) mod 12)
 *   departMinuteOf(day, hour) = day * MINUTES_PER_DAY + hour * 60. hour enter 0-23.
 *     Cap d aquestes toca clock.minute (nomes el modificara clock.js, E1).
 *   routeKm(from, to) -> km entre dos aeroports de world/ (llanca si no hi son)
 *   recommendedPrice(route) = round(route.pRef)   route = routeFor(from, to)
 *   priceBounds(route) -> [min, max] enters: ticketPriceRange * pRef
 *   plannedPax({ route, price, typeId, departMinute, weatherSeverity, reputation })
 *     -> demandPax limitat als seients de fleetTypes[typeId] (sense atzar)
 *   plannedBlockMin(typeId, km) = round(fixedMin[cls] + km / perf.kmh * 60)
 *   tripFuelKg(typeId, km) = round(perf.kgPerHour * plannedBlockMin / 60)
 *     (el que el pla preveu cremar: FlightRecord.fuelPlannedKg)
 *   minFuelKg(typeId, km) = round(trip * (1 + contingencyPct) + kgPerHour * reserveMin / 60)
 *   maxFuelKg(typeId, pax) = floor(min(mass.maxFuel, mtow - empty - pax * kgPerPax))
 *   inRange(typeId, km, pax) -> minFuelKg <= maxFuelKg
 *   takeoffMassKg(typeId, pax, fuelKg) = empty + pax * kgPerPax + fuelKg
 *   weatherBonusFor(weathers) -> bonus de m_ruta (DESIGN.md): per a cada meteo
 *     dura (hard), lerp(weatherBonus.min, .max, (severity - HARD_SEVERITY) /
 *     (1 - HARD_SEVERITY)); el maxim de totes, 0 si cap no ho es
 *   estimateOwnFlight({ typeId, from, to, ticketPrice, pax, crewCount,
 *                       weatherBonus, revenueMult })
 *     -> computeFlightResult d un vol nominal: la nota minima del tram de mult 1,
 *        durada i combustible del pla, a l hora. Nomes per al Dispatch i el
 *        briefing ("ingressos estimats"); la liquidacio fa servir el record real.
 */

import { AIRCRAFT, lerp } from '../core/index.js';
import { AIRPORT_DEFS, distanceKm, HARD_SEVERITY } from '../world/index.js';
import { BALANCE } from './balance.js';
import { lookup, MINUTES_PER_DAY } from './util.js';
import { demandPax } from './demand.js';
import { computeFlightResult } from './economy.js';

const MINUTES_PER_HOUR = 60;
const DAYS_PER_MONTH = 30;      // D3D4-3: mes de partida fins al rellotge (E1)
const MONTHS_PER_YEAR = 12;
const HOURS_PER_DAY = 24;

function fleetType(typeId, fn) {
  const ft = lookup(BALANCE.fleetTypes, typeId, null);
  if (!ft) throw new Error(fn + ': typeId desconegut a BALANCE.fleetTypes: ' + typeId);
  return ft;
}

export function dispatchDay(state) {
  return state.company.flightsFlown;
}

export function dispatchMonth(day) {
  return 1 + (Math.floor(day / DAYS_PER_MONTH) % MONTHS_PER_YEAR);
}

export function departMinuteOf(day, hour) {
  if (!Number.isInteger(day) || day < 0) throw new Error('departMinuteOf: day ha de ser un enter >= 0');
  if (!Number.isInteger(hour) || hour < 0 || hour >= HOURS_PER_DAY) throw new Error('departMinuteOf: hour ha de ser un enter de 0 a 23');
  return day * MINUTES_PER_DAY + hour * MINUTES_PER_HOUR;
}

export function routeKm(from, to) {
  const A = lookup(AIRPORT_DEFS, from, null), B = lookup(AIRPORT_DEFS, to, null);
  if (!A || !B) throw new Error('routeKm: aeroport desconegut: ' + (A ? to : from));
  return distanceKm(A.lat, A.lon, B.lat, B.lon);
}

export function recommendedPrice(route) {
  return Math.round(route.pRef);
}

export function priceBounds(route) {
  const [lo, hi] = BALANCE.ticketPriceRange;
  return [Math.round(route.pRef * lo), Math.round(route.pRef * hi)];
}

export function plannedPax({ route, price, typeId, departMinute, weatherSeverity = 0, reputation }) {
  return demandPax({ route, price, seats: fleetType(typeId, 'plannedPax').seats, minute: departMinute, weatherSeverity, reputation });
}

export function plannedBlockMin(typeId, km) {
  const ft = fleetType(typeId, 'plannedBlockMin'), P = BALANCE.flightPlan;
  return Math.round(P.fixedMin[ft.cls] + km / P.perf[typeId].kmh * MINUTES_PER_HOUR);
}

export function tripFuelKg(typeId, km) {
  return Math.round(BALANCE.flightPlan.perf[typeId].kgPerHour * plannedBlockMin(typeId, km) / MINUTES_PER_HOUR);
}

export function minFuelKg(typeId, km) {
  const P = BALANCE.flightPlan;
  return Math.round(tripFuelKg(typeId, km) * (1 + P.contingencyPct) + P.perf[typeId].kgPerHour * P.reserveMin / MINUTES_PER_HOUR);
}

export function maxFuelKg(typeId, pax) {
  fleetType(typeId, 'maxFuelKg');
  const m = AIRCRAFT[typeId].mass;
  return Math.floor(Math.min(m.maxFuel, m.mtow - m.empty - pax * BALANCE.flightPlan.kgPerPax));
}

export function inRange(typeId, km, pax) {
  return minFuelKg(typeId, km) <= maxFuelKg(typeId, pax);
}

export function takeoffMassKg(typeId, pax, fuelKg) {
  fleetType(typeId, 'takeoffMassKg');
  return AIRCRAFT[typeId].mass.empty + pax * BALANCE.flightPlan.kgPerPax + fuelKg;
}

export function weatherBonusFor(weathers) {
  const W = BALANCE.weatherBonus;
  return weathers.reduce((best, w) => !w || !w.hard ? best
    : Math.max(best, lerp(W.min, W.max, Math.min(1, (w.severity - HARD_SEVERITY) / (1 - HARD_SEVERITY)))), 0);
}

export function estimateOwnFlight({ typeId, from, to, ticketPrice, pax, crewCount = 0, weatherBonus = 0, revenueMult = 1 }) {
  const km = routeKm(from, to), blockMin = plannedBlockMin(typeId, km), fuel = tripFuelKg(typeId, km);
  const record = {
    aircraftTypeId: typeId, from, to, blockSeconds: blockMin * 60, fuelBurntKg: fuel, fuelPlannedKg: fuel,
    paxOnBoard: pax, skippedCruiseFuelKg: 0, arrivalDeltaMin: 0, crashCause: null,
    touchdown: { score: BALANCE.landingBands.find(b => b.mult === 1).min, fpm: 0, g: 1 }
  };
  return computeFlightResult({ record, mode: 'own', ticketPrice, paxOnBoard: pax, crewCount, weatherBonus, revenueMult });
}
