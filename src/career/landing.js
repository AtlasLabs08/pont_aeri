/* Nota d aterratge -> tram de BALANCE.landingBands (multiplicador, XP i clau
 * i18n del missatge). Funcio pura.
 * NOU: tasca B2 d ENGINEERING.md.
 *
 * EXPORTA: landingBand
 *
 * INTERFICIE (no la canviis, economy.js i els tests en depenen):
 *   landingBand(score) -> { min, mult, xp, key }, el primer tram amb
 *                         score >= min. score es retalla a [0, SCORE_MAX] i,
 *                         si no es un numero finit, compta com 0. Sense
 *                         arrodonir: 98.9 cau al tram de 95.
 */

import { clamp } from '../core/index.js';
import { BALANCE } from './balance.js';

const SCORE_MAX = 100;   // escala de Touchdown.score (seccio 4), no es economia

/** Tram de BALANCE.landingBands per a una nota 0..100. */
export function landingBand(score) {
  const s = Number.isFinite(score) ? clamp(score, 0, SCORE_MAX) : 0;
  const bands = BALANCE.landingBands;
  return bands.find(b => s >= b.min) ?? bands[bands.length - 1];
}
