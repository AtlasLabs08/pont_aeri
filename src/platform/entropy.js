/* Llavor i data de creacio d una partida nova (docs/DECISIONS.md, 30/09/2026,
 * E1). career/ no pot fer servir Math.random() ni Date: app/ les demana aqui
 * i les injecta a createCareer.
 * NOU: tasca C5 d ENGINEERING.md.
 *
 * EXPORTA: randomSeed nowIso
 *
 * IMPORTA: res. Llegeix globalThis.crypto a cada crida, com storage.js amb
 * localStorage: les proves hi poden injectar un doble.
 *
 * INTERFICIE (no la canviis, app/ i els tests en depenen):
 *   randomSeed() -> enter de 32 bits sense signe, de crypto.getRandomValues.
 *     Si no hi ha crypto (o llanca), la data en ms truncada a 32 bits. Mai llanca.
 *   nowIso()     -> new Date().toISOString()
 */

export function randomSeed() {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.getRandomValues === 'function') return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  } catch (e) { /* cau a la data */ }
  return Date.now() >>> 0;
}

export function nowIso() {
  return new Date().toISOString();
}
