/* Fitxer de dades del terreny real (TA-1, docs/DECISIONS.md, 2026-10-02):
 * alcada i distancia signada a la costa a la graella G (250 m), generat per
 * tools/terrain-build.mjs a partir de Copernicus GLO-30 i comitejat a
 * public/terrain/. El joc el llegeix del mateix origen que la pagina; les
 * proves, del disc. Cap peticio a cap servei extern.
 *
 * EXPORTA: TERRAIN_FILE TERRAIN_MAGIC packTerrain unpackTerrain decodeTerrain
 *
 * IMPORTA: res. DecompressionStream es estandard al navegador i a Node.
 *
 * FORMAT (little endian):
 *   capcalera de 32 bytes sense comprimir: magic 'PATR', versio u16, reservat
 *   u16, nx u16, ny u16, cell u16, reservat u16, e0 i32, n0 i32, hScale f32
 *   (m per unitat d alcada), sdScale f32 (m per unitat de distancia).
 *   cos comprimit amb zlib (deflate): dues capes Int16 de nx*ny, primer
 *   l alcada i despres la distancia, fila 0 al sud. Cada fila es guarda en
 *   diferencies (el primer valor tal qual) i cada capa en dos plans de bytes
 *   (tots els bytes baixos, despres tots els alts): comprimeix molt millor.
 *
 * INTERFICIE (no la canviis, terrain.js, l script i les proves en depenen):
 *   packTerrain({ nx, ny, cell, e0, n0, hScale, sdScale, h, sd }) -> { header, body }
 *     h i sd ja quantitzats (Int16Array); body sense comprimir.
 *   unpackTerrain(header, body) -> { nx, ny, cell, e0, n0, h, sd }  h i sd en
 *     metres (Float32Array).
 *   decodeTerrain(bytes) -> Promise de l objecte d unpackTerrain
 */

export const TERRAIN_FILE = 'terrain/terrain-250.bin';
export const TERRAIN_MAGIC = 0x52544150;       // 'PATR'
const VERSION = 1, HEADER = 32;

/** capes Int16 -> capcalera i cos sense comprimir */
export function packTerrain({ nx, ny, cell, e0, n0, hScale, sdScale, h, sd }) {
  const N = nx * ny, body = new Uint8Array(4 * N);
  [h, sd].forEach((layer, L) => {
    const lo = body.subarray(2 * N * L, 2 * N * L + N), hi = body.subarray(2 * N * L + N, 2 * N * (L + 1));
    for (let j = 0; j < ny; j++) {
      let prev = 0;
      for (let i = 0; i < nx; i++) { const k = j * nx + i, d = (layer[k] - prev) & 0xffff; prev = layer[k]; lo[k] = d & 0xff; hi[k] = d >> 8; }
    }
  });
  const header = new Uint8Array(HEADER), v = new DataView(header.buffer);
  v.setUint32(0, TERRAIN_MAGIC, true); v.setUint16(4, VERSION, true); v.setUint16(8, nx, true); v.setUint16(10, ny, true); v.setUint16(12, cell, true);
  v.setInt32(16, e0, true); v.setInt32(20, n0, true); v.setFloat32(24, hScale, true); v.setFloat32(28, sdScale, true);
  return { header, body };
}

function readHeader(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, HEADER);
  if (bytes.length < HEADER || v.getUint32(0, true) !== TERRAIN_MAGIC) throw new Error('terrain file: bad magic');
  if (v.getUint16(4, true) !== VERSION) throw new Error('terrain file: unknown version');
  return { nx: v.getUint16(8, true), ny: v.getUint16(10, true), cell: v.getUint16(12, true), e0: v.getInt32(16, true), n0: v.getInt32(20, true),
    hScale: v.getFloat32(24, true), sdScale: v.getFloat32(28, true) };
}

/** capcalera i cos sense comprimir -> capes en metres */
export function unpackTerrain(header, body) {
  const H = readHeader(header), N = H.nx * H.ny;
  if (body.length < 4 * N) throw new Error('terrain file: truncated');
  const out = [H.hScale, H.sdScale].map((scale, L) => {
    const lo = body.subarray(2 * N * L, 2 * N * L + N), hi = body.subarray(2 * N * L + N, 2 * N * (L + 1)), f = new Float32Array(N);
    for (let j = 0; j < H.ny; j++) {
      let prev = 0;
      for (let i = 0; i < H.nx; i++) { const k = j * H.nx + i; prev = (prev + (lo[k] | hi[k] << 8)) << 16 >> 16; f[k] = prev * scale; }
    }
    return f;
  });
  return { nx: H.nx, ny: H.ny, cell: H.cell, e0: H.e0, n0: H.n0, h: out[0], sd: out[1] };
}

/** el fitxer sencer (capcalera + cos comprimit) -> capes en metres */
export async function decodeTerrain(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  readHeader(u8);
  const stream = new Blob([u8.subarray(HEADER)]).stream().pipeThrough(new DecompressionStream('deflate'));
  const body = new Uint8Array(await new Response(stream).arrayBuffer());
  return unpackTerrain(u8.subarray(0, HEADER), body);
}
