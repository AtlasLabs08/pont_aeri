/* Entorn d execucio: si el joc corre en una build de desenvolupament.
 * NOU: mateix calcul que l etiqueta DEV del final d index.html (tasca A2
 * d ENGINEERING.md). index.html encara te la seva copia: es migra al bloc M.
 *
 * EXPORTA: IS_DEV
 *
 * IMPORTA: res. Llegeix globalThis.location un sol cop, en carregar el modul.
 *
 * INTERFICIE (no la canviis, app/ i els tests en depenen):
 *   IS_DEV  true a *.pages.dev, a localhost o amb ?dev a la URL.
 *           false a Node (no hi ha location) o si no es pot llegir.
 */

function detectDev() {
  try {
    const loc = globalThis.location;
    if (!loc) return false;
    return loc.hostname.endsWith('.pages.dev') || loc.hostname === 'localhost' ||
      new URLSearchParams(loc.search).has('dev');
  } catch (e) { return false; }
}

export const IS_DEV = detectDev();
