/* Utilitats compartides de career/. Cap valor economic: tot son unitats
 * o funcions pures sobre BALANCE.
 *
 * EXPORTA: eur lookup MINUTES_PER_DAY effectiveFuelKg
 *
 * INTERFICIE (no la canviis, els tests en depenen):
 *   eur(x)                 euros enters; converteix -0 en 0
 *   lookup(table, k, fb)   table[k] si k es clau propia, si no fb
 *   MINUTES_PER_DAY        minuts d un dia de partida
 *   effectiveFuelKg(record) combustible efectiu d un vol: cremat mes el del
 *                          salt de creuer amb la penalitzacio
 *                          (cruiseSkipFuelPenalty). economy.js i school.js
 */

import { BALANCE } from './balance.js';

export const MINUTES_PER_DAY = 1440;

/** euros enters; converteix -0 en 0 */
export const eur = x => Math.round(x) || 0;

export const lookup = (table, key, fallback) => Object.hasOwn(table, key) ? table[key] : fallback;

/** Combustible efectiu del vol (kg): el cremat mes el del tram saltat amb la penalitzacio. */
export const effectiveFuelKg = record =>
  record.fuelBurntKg + (record.skippedCruiseFuelKg ?? 0) * (1 + BALANCE.cruiseSkipFuelPenalty);
