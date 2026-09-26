/* Demanda de passatgers d una ruta: preu de referencia, demanda base i
 * elasticitat al preu (DESIGN.md, "Rutes, demanda i contractes").
 * NOU: tasca B2 d ENGINEERING.md. Funcions pures.
 *
 * El preu de referencia i la demanda base es calculen a partir de la
 * distancia i de la mida dels dos aeroports, no es busquen en una taula per
 * ruta: el B5 simula rutes que encara no existeixen. BALANCE.routeExceptions
 * corregeix les rutes especials.
 *
 * EXPORTA: routeKey routeModel routeFor hourFactor weatherFactor demandPax
 *
 * IMPORTA: AIRPORT_DEFS i distanceKm de world/ (nomes dades i utilitats).
 *
 * INTERFICIE (no la canviis, economy.js, el B5 i els tests en depenen):
 *   routeKey(a, b)       -> 'AAAA-BBBB', els dos ICAO en ordre alfabetic
 *   routeModel({ distanceKm, sizeA, sizeB, exception })
 *                        -> { pRef, dBase, kind }. Mides: claus de
 *                           BALANCE.demand.sizeWeight. exception opcional: els
 *                           seus camps pRef, dBase i kind substitueixen el
 *                           valor calculat
 *   routeFor(from, to)   -> el mateix per a dos ICAO de world/, o null si
 *                           algun no hi es. Simetric
 *   hourFactor(minuteOfDay)     -> peak, off o 1 (minut 0..1439, intervals [inici, fi))
 *   weatherFactor(severity)     -> 1 a severity 0, weatherFactorMin a severity 1
 *   demandPax({ route, price, seats, minuteOfDay, weatherSeverity, reputation })
 *                        -> passatgers, enter entre 0 i seats. 0 si price <= 0
 *                           o no es finit
 */

import { clamp } from '../core/index.js';
import { AIRPORT_DEFS, distanceKm } from '../world/index.js';
import { BALANCE } from './balance.js';

const REPUTATION_SCALE = 100;   // la reputacio va de 0 a 100 (esquema, state.js)

/** 'AAAA-BBBB' amb els dos ICAO en ordre alfabetic. */
export function routeKey(a, b) {
  return a <= b ? a + '-' + b : b + '-' + a;
}

function sizeWeight(size) {
  const w = BALANCE.demand.sizeWeight[size];
  if (w === undefined) throw new Error('demand: mida d aeroport desconeguda: ' + size);
  return w;
}

/** Preu de referencia, demanda base i tipus d una ruta, sense tocar world/. */
export function routeModel({ distanceKm: km, sizeA, sizeB, exception = null }) {
  const d = BALANCE.demand;
  const model = {
    pRef: d.pRef.base + d.pRef.perKm * km,
    dBase: d.dBase.scale * Math.sqrt(sizeWeight(sizeA) * sizeWeight(sizeB)) * (1 + km / d.dBase.distanceKm),
    kind: d.defaultKind
  };
  if (exception) {
    for (const k of ['pRef', 'dBase', 'kind']) if (exception[k] !== undefined) model[k] = exception[k];
  }
  return model;
}

/** routeModel per a dos aeroports reals de world/; null si algun no existeix. */
export function routeFor(from, to) {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const A = Object.hasOwn(AIRPORT_DEFS, a) ? AIRPORT_DEFS[a] : null;
  const B = Object.hasOwn(AIRPORT_DEFS, b) ? AIRPORT_DEFS[b] : null;
  if (!A || !B) return null;
  const size = icao => Object.hasOwn(BALANCE.airportSize, icao) ? BALANCE.airportSize[icao] : BALANCE.demand.defaultSize;
  const key = routeKey(a, b);
  return routeModel({
    distanceKm: distanceKm(A.lat, A.lon, B.lat, B.lon),
    sizeA: size(a), sizeB: size(b),
    exception: Object.hasOwn(BALANCE.routeExceptions, key) ? BALANCE.routeExceptions[key] : null
  });
}

const inAny = (m, intervals) => intervals.some(([from, to]) => m >= from && m < to);

/** Factor horari: punta, matinada o 1. */
export function hourFactor(minuteOfDay) {
  const { hours, hourFactor: f } = BALANCE.demand;
  if (inAny(minuteOfDay, hours.peak)) return f.peak;
  if (inAny(minuteOfDay, hours.off)) return f.off;
  return 1;
}

/** Factor de meteo. severity 0..1 (es retalla); si no es finita, compta com 0. */
export function weatherFactor(severity) {
  const s = Number.isFinite(severity) ? clamp(severity, 0, 1) : 0;
  return 1 - (1 - BALANCE.demand.weatherFactorMin) * s;
}

/** Passatgers que compren bitllet, amb el tope de seients. */
export function demandPax({ route, price, seats, minuteOfDay, weatherSeverity = 0,
                            reputation = BALANCE.reputation.start }) {
  if (!Number.isFinite(seats)) throw new Error('demandPax: seats ha de ser un numero');
  if (!Number.isFinite(price) || price <= 0) return 0;
  const d = BALANCE.demand;
  const e = d.elasticity[route.kind];
  if (e === undefined) throw new Error('demandPax: tipus de ruta desconegut: ' + route.kind);
  const fRep = d.reputation.base + d.reputation.span * reputation / REPUTATION_SCALE;
  const n = route.dBase * (route.pRef / price) ** e * hourFactor(minuteOfDay) * weatherFactor(weatherSeverity) * fRep;
  return Math.max(0, Math.min(seats, Math.floor(n)));
}
