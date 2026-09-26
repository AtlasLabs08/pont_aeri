/* Compte de resultats d un vol (DESIGN.md, "El compte de resultats d un vol").
 * NOU: tasca B2 d ENGINEERING.md. Funcio pura: no toca el CareerState.
 * Aplicar el resultat a la partida es feina d app/.
 *
 * EXPORTA: computeFlightResult
 *
 * IMPORTA: AIRCRAFT de core/ (la MTOW es dada fisica, no economia).
 *
 * INTERFICIE (no la canviis, app/, el B5 i els tests en depenen):
 *   computeFlightResult({ record, mode, ticketPrice, paxOnBoard, crewCount,
 *                         rankPayMult, weatherBonus, exclusive, financePerFlight })
 *   -> { mode, landing: { key, mult, xp },
 *        revenue: { tickets, contract, punctuality, fuelSaving },
 *        costs: { fuel, fees, crew, maintenance, finance },
 *        rotation, K, net }
 *
 *   mode 'own':      net = K * r * (ingressos - costos)
 *   mode 'contract': net = contractFeePerLeg[cls] * rankPayMult * m_aterratge,
 *                    sense costos; rotation i K valen 1 (no s apliquen)
 *   Sense aterratge (touchdown null) o amb accident: ingressos 0. En mode
 *   'own' els costos es paguen igualment. landing es el tram de la nota, o el
 *   de nota 0 si no hi ha touchdown.
 *   Cada partida en euros, sense K ni r, amb Math.round. net es Math.round del
 *   calcul sencer, una sola vegada al final (invariant de la seccio 5): la
 *   suma de partides arrodonides pot diferir de net en uns quants euros.
 *   Llanca un Error si l avio no es a BALANCE.fleetTypes o a AIRCRAFT, si el
 *   mode es desconegut o si en mode 'own' falta ticketPrice.
 */

import { AIRCRAFT } from '../core/index.js';
import { BALANCE } from './balance.js';
import { landingBand } from './landing.js';

const SECONDS_PER_HOUR = 3600;
const KG_PER_TONNE = 1000;

/** euros enters; converteix -0 en 0 */
const eur = x => Math.round(x) || 0;

const lookup = (table, key, fallback) => Object.hasOwn(table, key) ? table[key] : fallback;

/** Classe de l avio i MTOW en tones. */
function aircraftInfo(typeId) {
  const ft = lookup(BALANCE.fleetTypes, typeId, null);
  if (!ft) throw new Error('computeFlightResult: aircraftTypeId desconegut a BALANCE.fleetTypes: ' + typeId);
  const cfg = lookup(AIRCRAFT, typeId, null);
  if (!cfg || !Number.isFinite(cfg.mass?.mtow)) throw new Error('computeFlightResult: sense MTOW a AIRCRAFT per a ' + typeId);
  return { cls: ft.cls, mtowT: cfg.mass.mtow / KG_PER_TONNE };
}

/** Resultat economic d un tram. Vegeu la capcalera. */
export function computeFlightResult(input) {
  const { record, mode } = input;
  const { cls, mtowT } = aircraftInfo(record.aircraftTypeId);
  const td = record.touchdown;
  const failed = !td || record.crashCause != null;
  const band = landingBand(td ? td.score : 0);
  const landing = { key: band.key, mult: band.mult, xp: band.xp };

  if (mode === 'contract') {
    const rankPayMult = input.rankPayMult ?? BALANCE.ranks[0].payMult;
    const pay = failed ? 0 : BALANCE.contractFeePerLeg[cls] * rankPayMult * band.mult;
    return {
      mode, landing,
      revenue: { tickets: 0, contract: eur(pay), punctuality: 0, fuelSaving: 0 },
      costs: { fuel: 0, fees: 0, crew: 0, maintenance: 0, finance: 0 },
      rotation: 1, K: 1, net: eur(pay)
    };
  }
  if (mode !== 'own') throw new Error('computeFlightResult: mode desconegut: ' + mode);

  const { ticketPrice, crewCount = 0, weatherBonus = 0, exclusive = false, financePerFlight = 0 } = input;
  if (!Number.isFinite(ticketPrice)) throw new Error('computeFlightResult: en mode own cal ticketPrice');
  const pax = input.paxOnBoard ?? record.paxOnBoard ?? 0;
  const B = BALANCE, bon = B.bonuses;

  const rotation = Math.min(1 + B.rotation.perCrew * crewCount, B.rotation.cap[cls]);
  const mRoute = 1 + lookup(B.airportDifficulty, record.to, 0) + weatherBonus + (exclusive ? B.exclusivityBonus : 0);

  const fuelKg = record.fuelBurntKg + (record.skippedCruiseFuelKg ?? 0) * (1 + B.cruiseSkipFuelPenalty);
  const hours = record.blockSeconds / SECONDS_PER_HOUR;

  const tickets = failed ? 0 : ticketPrice * pax * mRoute * band.mult;
  let punctuality = 0, fuelSaving = 0;
  if (!failed && td.score >= bon.minScore) {
    if (Math.abs(record.arrivalDeltaMin) <= bon.punctualityWindowMin) punctuality = bon.punctualityPct * tickets;
    const savedKg = record.fuelPlannedKg - fuelKg;
    if (record.fuelPlannedKg > 0 && savedKg / record.fuelPlannedKg >= bon.fuelSavingThreshold) {
      fuelSaving = bon.fuelSavingShare * savedKg * B.fuelPricePerKg;
    }
  }

  const fuel = fuelKg * B.fuelPricePerKg;
  const fees = B.fees.airportsPerLeg * (B.fees.perTonneMTOW * mtowT + B.fees.perPax * pax);
  const crew = hours * B.crewRatePerBlockHour[cls];
  const maintenance = hours * B.maintAccrualPerHour[cls];
  const finance = financePerFlight;

  const revenue = tickets + punctuality + fuelSaving;
  const costs = fuel + fees + crew + maintenance + finance;
  return {
    mode, landing,
    revenue: { tickets: eur(tickets), contract: 0, punctuality: eur(punctuality), fuelSaving: eur(fuelSaving) },
    costs: { fuel: eur(fuel), fees: eur(fees), crew: eur(crew), maintenance: eur(maintenance), finance: eur(finance) },
    rotation, K: B.K,
    net: eur(B.K * rotation * (revenue - costs))
  };
}
