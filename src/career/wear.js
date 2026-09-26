/* Desgast, revisions i probabilitat d avaria d un avio propi
 * (DESIGN.md, "Manteniment"). NOU: tasca B3 d ENGINEERING.md. Funcions pures:
 * cap no modifica l Airframe que rep, retornen objectes nous. Aplicar-les a
 * la partida es feina d app/; tirar l avaria es d E2.
 *
 * EXPORTA: flightDay applyFlightWear failureChance checksDue performCheck
 *
 * INTERFICIE (no la canviis, app/, E2, E5, el B5 i els tests en depenen):
 *   flightDay(record, cls) -> { hours, cycles }
 *     Cada vol pilotat compta com un dia d operacio (docs/DECISIONS.md):
 *     hours = max(operations.dayHours[cls], blockSeconds / 3600)
 *     cycles = max(1, round(hours / max(hores de bloc, operations.minLegHours[cls])))
 *     El tram minim evita que un vol molt curt (accident a l enlairament,
 *     circuit) compti centenars de cicles.
 *   applyFlightWear(airframe, record) -> { airframe, cycleCost }
 *     Suma hours i cycles de flightDay i resta el desgast de BALANCE.wear a
 *     cada condicio. El tren perd, a mes, gearPerExtraFpm per cada fpm de
 *     |touchdown.fpm| per sobre de gearFreeFpm (nomes si hi ha touchdown).
 *     Condicions retallades a [0, 100] i arrodonides a 1 decimal.
 *     cycleCost = round(cycles * maintCostPerCycle[cls]), en euros.
 *     Llanca un Error si airframe.typeId no es a BALANCE.fleetTypes, si
 *     record.aircraftTypeId no hi coincideix, si blockSeconds no es un numero
 *     finit >= 0 (flightDay tambe) o si hi ha touchdown i fpm o g no son finits.
 *   failureChance(condition) -> probabilitat d avaria per vol, [0, 1)
 *     0 si condition >= failure.threshold; per sota, corba quadratica que
 *     passa per pAtThreshold al llindar i per pAtRef a refCondition. Per sota
 *     de refCondition la corba continua, sense retallar.
 *   checksDue(airframe) -> array amb 'A' i/o 'C' (hours >= nextAHours / nextCHours)
 *   performCheck(airframe, kind) -> { airframe, cost, groundedDays }
 *     kind 'A' | 'C' | 'engine' (BALANCE.checks). restore posa el valor, boost
 *     suma fins a 100. cost = round(pctOfValue * airframe.value). Per a 'A' i
 *     'C', nextXHours = hours + intervalHours. L engine overhaul no te
 *     comptador. Ajornar una revisio es no cridar-la. Llanca un Error si kind
 *     es desconegut.
 */

import { BALANCE } from './balance.js';

const SECONDS_PER_HOUR = 3600;
const CONDITION_MAX = 100;         // escala de condicio 0..100
const CONDITION_DECIMALS = 10;     // arrodoniment a 1 decimal

const lookup = (table, key, fallback) => Object.hasOwn(table, key) ? table[key] : fallback;

/** euros enters; converteix -0 en 0 */
const eur = x => Math.round(x) || 0;

/** retalla a [0, 100] i arrodoneix a 1 decimal */
const cond = x => Math.round(Math.min(CONDITION_MAX, Math.max(0, x)) * CONDITION_DECIMALS) / CONDITION_DECIMALS;

/** Copia nova de l avio, amb els objectes de dins copiats tambe. */
const copyAirframe = a => structuredClone(a);

function classOf(typeId, fn) {
  const ft = lookup(BALANCE.fleetTypes, typeId, null);
  if (!ft) throw new Error(fn + ': typeId desconegut a BALANCE.fleetTypes: ' + typeId);
  return ft.cls;
}

/** Hores i cicles d operacio que compta un vol pilotat. Vegeu la capcalera. */
export function flightDay(record, cls) {
  const dayHours = lookup(BALANCE.operations.dayHours, cls, null);
  if (dayHours === null) throw new Error('flightDay: classe desconeguda a operations.dayHours: ' + cls);
  if (!Number.isFinite(record.blockSeconds) || record.blockSeconds < 0) {
    throw new Error('flightDay: blockSeconds ha de ser un numero finit no negatiu');
  }
  const blockHours = record.blockSeconds / SECONDS_PER_HOUR;
  const legHours = Math.max(blockHours, BALANCE.operations.minLegHours[cls]);
  const hours = Math.max(dayHours, blockHours);
  const cycles = Math.max(1, Math.round(hours / legHours));
  return { hours, cycles };
}

/** Avio despres del desgast d un vol, i el cost per cicle. Vegeu la capcalera. */
export function applyFlightWear(airframe, record) {
  const cls = classOf(airframe.typeId, 'applyFlightWear');
  if (record.aircraftTypeId !== airframe.typeId) {
    throw new Error('applyFlightWear: el record es d un ' + record.aircraftTypeId + ' i l avio es ' + airframe.typeId);
  }
  const td = record.touchdown;
  if (td && (!Number.isFinite(td.fpm) || !Number.isFinite(td.g))) {
    throw new Error('applyFlightWear: touchdown.fpm i touchdown.g han de ser numeros finits');
  }
  const { hours, cycles } = flightDay(record, cls);
  const W = BALANCE.wear;
  const extraFpm = td ? Math.max(0, Math.abs(td.fpm) - W.gearFreeFpm) : 0;

  const a = copyAirframe(airframe);
  const c = a.condition;
  a.hours += hours;
  a.cycles += cycles;
  c.engines = cond(c.engines - W.enginesPerHour * hours);
  c.avionics = cond(c.avionics - W.avionicsPerHour * hours);
  c.airframe = cond(c.airframe - W.airframePerCycle * cycles);
  c.gear = cond(c.gear - W.gearPerCycle * cycles - W.gearPerExtraFpm * extraFpm);
  return { airframe: a, cycleCost: eur(cycles * BALANCE.maintCostPerCycle[cls]) };
}

/** Probabilitat d avaria per vol d un sistema amb aquesta condicio. */
export function failureChance(condition) {
  const F = BALANCE.failure;
  if (condition >= F.threshold) return 0;
  const x = (F.threshold - condition) / (F.threshold - F.refCondition);
  return F.pAtThreshold + (F.pAtRef - F.pAtThreshold) * x * x;
}

/** Revisions amb calendari que ja toquen: 'A' i/o 'C'. */
export function checksDue(airframe) {
  const m = airframe.maintenance, due = [];
  if (airframe.hours >= m.nextAHours) due.push('A');
  if (airframe.hours >= m.nextCHours) due.push('C');
  return due;
}

/** Avio despres d una revisio, el seu cost i els dies a terra. */
export function performCheck(airframe, kind) {
  const chk = lookup(BALANCE.checks, kind, null);
  if (!chk) throw new Error('performCheck: revisio desconeguda: ' + kind);
  const a = copyAirframe(airframe);
  const c = a.condition;
  for (const [k, v] of Object.entries(chk.restore ?? {})) c[k] = v;
  for (const [k, v] of Object.entries(chk.boost ?? {})) c[k] = cond(c[k] + v);
  if (kind === 'A') a.maintenance.nextAHours = a.hours + chk.intervalHours;
  if (kind === 'C') a.maintenance.nextCHours = a.hours + chk.intervalHours;
  return { airframe: a, cost: eur(chk.pctOfValue * airframe.value), groundedDays: chk.groundedDays };
}
