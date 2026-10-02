/* Vols de contracte del Dispatch: la xarxa de seguretat (DESIGN.md, "Els vols
 * de contracte com a xarxa de seguretat"; D3+D4, D3D4-9). Es vola l avio
 * d una altra companyia per una tarifa fixa: no gasta la flota ni les quotes,
 * i sempre n hi ha, tambe amb el saldo negatiu. Funcions pures.
 * NOU: tasques D3+D4 d ENGINEERING.md.
 *
 * EXPORTA: contractOffers
 *
 * IMPORTA: AIRPORT_ORDER de world/ (dades), derivedRng de rng.js.
 *
 * INTERFICIE (no la canviis, app/ i els tests en depenen):
 *   contractOffers(state) -> [{ id, typeId, reg, from, to, km, hour, pax, fee }]
 *     BALANCE.contracts.offers ofertes del dia de partida (dispatchDay), amb
 *     el flux derivat derivedRng(rngSeed, 'contracts', dia): no toca
 *     rngCounter, i la mateixa partida dona les mateixes ofertes. typeId: un
 *     tipus que el pilot pot volar (pilot.ratings), uniforme entre tots; from
 *     i to: dos aeroports d AIRPORT_ORDER a contracts.maxKm com a molt i dins
 *     de l abast del tipus; hour: dins de contracts.hours; pax = round(seients * loadFactor);
 *     fee = contractFeePerLeg[cls] * rankPayMult(rang), el pagament amb un
 *     aterratge solid. reg: matricula de l altra companyia ('EC-C' + 2
 *     lletres). id = 'C' + dia + '-' + index. Sense habilitacions, [].
 */

import { AIRPORT_ORDER } from '../world/index.js';
import { BALANCE } from './balance.js';
import { derivedRng } from './rng.js';
import { rankPayMult } from './progression.js';
import { dispatchDay, routeKm, inRange } from './flightplan.js';

const LETTERS = 26, CHAR_A = 65;

const pick = (rnd, list) => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];

export function contractOffers(state) {
  const types = Object.keys(BALANCE.fleetTypes).filter(id => state.pilot.ratings.includes(BALANCE.fleetTypes[id].rating));
  if (types.length === 0) return [];
  const day = dispatchDay(state), rnd = derivedRng(state.rngSeed, 'contracts', day);
  const C = BALANCE.contracts, pay = rankPayMult(state.pilot.rank), offers = [];
  for (let i = 0; i < C.offers; i++) {
    const typeId = pick(rnd, types), ft = BALANCE.fleetTypes[typeId];
    const pax = Math.round(ft.seats * (C.loadFactor[0] + (C.loadFactor[1] - C.loadFactor[0]) * rnd()));
    const pairs = [];
    for (const a of AIRPORT_ORDER) for (const b of AIRPORT_ORDER) {
      if (a === b) continue;
      const km = routeKm(a, b);
      if (km <= C.maxKm && inRange(typeId, km, pax)) pairs.push({ from: a, to: b, km });
    }
    if (pairs.length === 0) continue;
    const { from, to, km } = pick(rnd, pairs);
    const hour = C.hours[0] + Math.floor(rnd() * (C.hours[1] - C.hours[0]));
    const reg = 'EC-C' + String.fromCharCode(CHAR_A + Math.floor(rnd() * LETTERS)) + String.fromCharCode(CHAR_A + Math.floor(rnd() * LETTERS));
    offers.push({ id: 'C' + day + '-' + i, typeId, reg, from, to, km, hour, pax,
      fee: Math.round(BALANCE.contractFeePerLeg[ft.cls] * pay) });
  }
  return offers;
}
