/* Imatges dels avions del Market (docs/DECISIONS.md 01/10/2026, K5): fitxer de
 * dades. Un tipus sense imatge mostra la silueta de la seva classe (dibuixada
 * a ui/silhouettes.js). NOU: tasca "Market en targetes".
 *
 * EXPORTA: AIRCRAFT_IMAGES IMAGE_DIR SILHOUETTES silhouetteOf imageOf
 *
 * INTERFICIE (no la canviis, app/market.js, ui/ i els tests en depenen):
 *   AIRCRAFT_IMAGES   typeId -> nom de fitxer dins de public/aircraft/.
 *     Buit fins que hi hagi els renders definitius.
 *   IMAGE_DIR = 'aircraft/'   ruta relativa: Vite serveix public/ a l arrel
 *     del lloc i el build fa servir base './', aixi que funciona a github.io,
 *     a pages.dev i en local.
 *   SILHOUETTES = ['commuter', 'turboprop', 'regionalJet', 'narrowbody',
 *     'widebody', 'jumbo']
 *   silhouetteOf(typeId) -> una de SILHOUETTES (cada typeId de
 *     BALANCE.fleetTypes i BALANCE.usedPrice en te una)
 *   imageOf(typeId, map = AIRCRAFT_IMAGES) -> URL relativa o null (map es per a les proves)
 */

export const AIRCRAFT_IMAGES = Object.freeze({
  // typeId: 'nom-del-fitxer.webp'
});

export const IMAGE_DIR = 'aircraft/';

export const SILHOUETTES = Object.freeze(['commuter', 'turboprop', 'regionalJet', 'narrowbody', 'widebody', 'jumbo']);

const SILHOUETTE_OF = Object.freeze({
  commuter: 'commuter',
  tpShort: 'turboprop', tp: 'turboprop',
  rj: 'regionalJet',
  nbShort: 'narrowbody', nb: 'narrowbody', nbStretch: 'narrowbody',
  wb: 'widebody', wbEr: 'widebody',
  jumbo: 'jumbo'
});

export function silhouetteOf(typeId) {
  return Object.hasOwn(SILHOUETTE_OF, typeId) ? SILHOUETTE_OF[typeId] : 'narrowbody';
}

export function imageOf(typeId, map = AIRCRAFT_IMAGES) {
  return Object.hasOwn(map, typeId) ? IMAGE_DIR + map[typeId] : null;
}
