/* Contractacio de tripulacions, que pugen el factor de rotacio d un avio
 * (DESIGN.md, "Escala economica", i pestanya Crew). NOU: tasca B5 d
 * ENGINEERING.md. Funcions pures: no toquen el CareerState. Aplicar-les a
 * la partida (restar el cost, desar el nombre de tripulacions) es feina d app/.
 *
 * EXPORTA: maxCrew hireCrew
 *
 * INTERFICIE (no la canviis, app/, tools/balance.mjs i els tests en depenen):
 *   maxCrew(cls) -> nombre de tripulacions a partir del qual una mes ja no
 *     puja el factor de rotacio: ceil((rotation.cap[cls] - 1) / rotation.perCrew),
 *     0 si el sostre es 1 o menys. Llanca un Error si la classe no es a
 *     BALANCE.rotation.cap.
 *   hireCrew({ cls, crewCount, cash }) -> { ok: true, cost, crewCount }
 *     o { ok: false, reason }. cost = BALANCE.crewHireCost[cls], un sol cop
 *     per tripulacio; crewCount = crewCount + 1. reason 'max' si crewCount
 *     >= maxCrew(cls), 'cash' si cash < cost, en aquest ordre. No resta
 *     diners: nomes diu el cost. El sou no es aqui: ja es dins dels costos
 *     de cada tram, multiplicats pel factor de rotacio (economy.js).
 *     Llanca un Error si la classe es desconeguda, si crewCount no es un
 *     enter >= 0 o si cash no es un numero finit.
 */

import { BALANCE } from './balance.js';

const EPSILON = 1e-9;   // tolerancia de coma flotant a la divisio, no es economia

const lookup = (table, key, fallback) => Object.hasOwn(table, key) ? table[key] : fallback;

/** Tripulacions que encara pugen el factor de rotacio d aquesta classe. */
export function maxCrew(cls) {
  const cap = lookup(BALANCE.rotation.cap, cls, null);
  if (cap === null) throw new Error('maxCrew: classe desconeguda a rotation.cap: ' + cls);
  return Math.max(0, Math.ceil((cap - 1) / BALANCE.rotation.perCrew - EPSILON));
}

/** Contracta una tripulacio mes. Vegeu la capcalera. */
export function hireCrew({ cls, crewCount, cash }) {
  const cost = lookup(BALANCE.crewHireCost, cls, null);
  if (cost === null) throw new Error('hireCrew: classe desconeguda a crewHireCost: ' + cls);
  if (!Number.isInteger(crewCount) || crewCount < 0) throw new Error('hireCrew: crewCount ha de ser un enter no negatiu');
  if (!Number.isFinite(cash)) throw new Error('hireCrew: cash ha de ser un numero finit');
  if (crewCount >= maxCrew(cls)) return { ok: false, reason: 'max' };
  if (cash < cost) return { ok: false, reason: 'cash' };
  return { ok: true, cost, crewCount: crewCount + 1 };
}
