/* Carrega el terreny real (public/terrain/terrain-250.bin) per a les proves,
 * igual que el joc: World.load amb els bytes del fitxer.
 */
import { readFileSync } from 'node:fs';
import { World, TERRAIN_FILE } from '../../src/world/index.js';

export async function loadWorld() {
  if (!World.ready) await World.load(readFileSync(new URL('../../public/' + TERRAIN_FILE, import.meta.url)));
  return World;
}
