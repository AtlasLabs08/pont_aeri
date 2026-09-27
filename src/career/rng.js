/* Atzar reproduible del mode Airline (seccio 7 d ENGINEERING.md): cada tirada
 * surt de la llavor i del comptador desats a la partida.
 * NOU: tasca B5 (el primer que el fa servir es tools/balance.mjs).
 *
 * EXPORTA: draw
 *
 * INTERFICIE (no la canviis, app/, E2, E5, tools/ i els tests en depenen):
 *   draw(state) -> [0, 1). Avanca state.rngCounter en 1: es l unica cosa
 *     que modifica. Mateixa llavor i mateix comptador, mateix valor.
 *     Formula de la seccio 7:
 *     makeRng((rngSeed ^ imul(rngCounter, 0x9E3779B1)) >>> 0)()
 */

import { makeRng } from '../core/index.js';

/** Avanca el comptador i retorna [0, 1). */
export function draw(state) {
  const r = makeRng((state.rngSeed ^ Math.imul(state.rngCounter, 0x9E3779B1)) >>> 0);
  state.rngCounter++;
  return r();
}
