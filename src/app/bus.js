/* Bus d esdeveniments de app/: perque ui/ es pugui subscriure sense conixer
 * qui emet. NOU: tasca C2 d ENGINEERING.md, seccio 3.
 *
 * EXPORTA: TOPICS on off emit _resetBus
 *
 * IMPORTA: res.
 *
 * INTERFICIE (no la canviis, ui/ i els tests en depenen):
 *   TOPICS            llista congelada dels temes valids
 *   on(topic, fn)      subscriu fn al tema. Tema fora de TOPICS: llanca
 *   off(topic, fn)     treu fn del tema. Si no hi era, no fa res
 *   emit(topic, payload)  crida tots els subscriptors amb payload. Tema fora
 *                      de TOPICS: llanca. Si un subscriptor llanca, es mostra
 *                      amb console.error i els altres el reben igualment:
 *                      emit mai llanca
 *   _resetBus()        nomes per a les proves: buida tots els subscriptors
 */

export const TOPICS = Object.freeze([
  'career:changed', 'flight:finished', 'dispatch:resolved', 'rank:up', 'save:error'
]);

let listeners = new Map();

function checkTopic(topic) {
  if (!TOPICS.includes(topic)) throw new Error(topic);
}

export function on(topic, fn) {
  checkTopic(topic);
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(fn);
}

export function off(topic, fn) {
  const set = listeners.get(topic);
  if (set) set.delete(fn);
}

export function emit(topic, payload) {
  checkTopic(topic);
  const set = listeners.get(topic);
  if (!set) return;
  for (const fn of Array.from(set)) {
    try { fn(payload); } catch (e) { console.error(e); }
  }
}

export function _resetBus() {
  listeners = new Map();
}
