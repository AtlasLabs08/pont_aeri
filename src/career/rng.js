/* Atzar reproduible del mode Airline (seccio 7 d ENGINEERING.md): cada tirada
 * surt de la llavor i del comptador desats a la partida.
 * NOU: tasca B5 (el primer que el fa servir es tools/balance.mjs). derivedRng:
 * D2+D5 (mercat d ocasio).
 *
 * EXPORTA: draw derivedRng
 *
 * INTERFICIE (no la canviis, app/, E2, E5, tools/ i els tests en depenen):
 *   draw(state) -> [0, 1). Avanca state.rngCounter en 1: es l unica cosa
 *     que modifica. Mateixa llavor i mateix comptador, mateix valor.
 *     Formula de la seccio 7:
 *     makeRng((rngSeed ^ imul(rngCounter, 0x9E3779B1)) >>> 0)()
 *   derivedRng(seed, tag, key) -> funcio que retorna [0, 1) a cada crida.
 *     Flux derivat, pur: depen nomes de la llavor (rngSeed), d un nom de
 *     flux (tag, text) i d un enter (key, p. ex. l epoch del mercat). No
 *     toca cap partida ni rngCounter: generar-lo dues vegades dona la
 *     mateixa sequencia. Cada us nou te el seu tag, perque dos fluxos no
 *     coincideixin mai amb la mateixa key. Llanca un Error si tag no es un
 *     text no buit o si key no es un enter.
 */

import { makeRng } from '../core/index.js';

/** Avanca el comptador i retorna [0, 1). */
export function draw(state) {
  const r = makeRng((state.rngSeed ^ Math.imul(state.rngCounter, 0x9E3779B1)) >>> 0);
  state.rngCounter++;
  return r();
}

/** Barreja final de MurmurHash3: cada bit de l entrada canvia la meitat dels de la sortida. */
function fmix32(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B);
  h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** FNV-1a de 32 bits d un text. */
function hashText(text) {
  let h = 0x811C9DC5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Flux derivat de (seed, tag, key), sense tocar la partida. Vegeu la capcalera. */
export function derivedRng(seed, tag, key) {
  if (typeof tag !== 'string' || tag.length === 0) throw new Error('derivedRng: tag ha de ser un text no buit');
  if (!Number.isInteger(key)) throw new Error('derivedRng: key ha de ser un enter');
  const s = fmix32(fmix32((seed ^ hashText(tag)) >>> 0) ^ fmix32(key >>> 0));
  return makeRng(s);
}
