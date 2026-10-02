/* Terreny real (TA-1 i TA-2, docs/DECISIONS.md, 2026-10-02): genera
 * public/terrain/terrain-250.bin a partir de Copernicus GLO-30.
 *
 *   node tools/terrain-build.mjs [dir]
 *
 * No forma part de npm test. Baixa (o llegeix de dir, si hi son) les
 * tessel.les de 1x1 grau de Copernicus GLO-30 que cobreixen la graella G de
 * world/terrain.js (DEM i la mascara d aigua WBM dels fitxers auxiliars), les
 * desa a dir si se n hi dona un, i escriu el fitxer del joc:
 *
 *   - Alcada: a cada node de G, la mitjana dels pixels de 30 m que cauen a la
 *     seva cel.la de 250 m (sense els pixels de mar), en metres enters. El
 *     remostreig es per lon/lat: cada pixel va al node que li toca segons la
 *     projeccio del joc (ll de world/geo.js), no per metres.
 *   - Costa: mar = WBM 1 (oceà). Els llacs i els rius (WBM 2 i 3) son terra
 *     amb la seva alcada. Mascara a 125 m (mar si la meitat dels pixels ho
 *     son), distancia euclidiana exacta (Felzenszwalb) a la vora i, a cada
 *     node, la distancia signada en metres (+ terra endins), retallada a
 *     +-SD_MAX.
 *   - Les tessel.les que no existeixen al bucket son mar obert.
 *
 * El fitxer resultant el llegeix world/terrain-data.js (format a la seva
 * capcalera). Copernicus DEM: (c) DLR e.V. 2010-2014 and (c) Airbus Defence and
 * Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA;
 * all rights reserved.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync, constants as Z } from 'node:zlib';

import { GEO } from '../src/world/geo.js';
import { World } from '../src/world/terrain.js';
import { packTerrain, TERRAIN_FILE } from '../src/world/terrain-data.js';

const BUCKET = 'https://copernicus-dem-30m.s3.amazonaws.com';
const SUB = 2;                 // la mascara de costa va a cell / SUB (125 m)
const SD_MAX = 30000;          // m: la distancia es retalla aqui (Int16, 1 m)
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = ROOT + 'public/' + TERRAIN_FILE;
const cacheDir = process.argv[2] || null;

const G = World.G, NX = G.nx, NY = G.ny, CELL = G.cell;
const lonOf = e => GEO.lon0 + e / GEO.kE, latOf = n => GEO.lat0 + n / GEO.kN;

/* ---- lector minim de GeoTIFF: tessel.lat, deflate, predictor 2 o 3, una banda ---- */
function readTiff(buf) {
  const le = buf[0] === 0x49, u16 = o => le ? buf.readUInt16LE(o) : buf.readUInt16BE(o), u32 = o => le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
  const off = u32(4), n = u16(off), T = {};
  for (let i = 0; i < n; i++) {
    const e = off + 2 + i * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4), sz = { 3: 2, 4: 4, 12: 8 }[type] || 1;
    const at = cnt * sz > 4 ? u32(e + 8) : e + 8, rd = k => type === 3 ? u16(at + 2 * k) : type === 4 ? u32(at + 4 * k) : type === 12 ? buf.readDoubleLE(at + 8 * k) : buf[at + k];
    T[tag] = cnt === 1 ? rd(0) : Array.from({ length: cnt }, (_, k) => rd(k));
  }
  const W = T[256], H = T[257], bits = T[258], tw = T[322], th = T[323], pred = T[317] || 1, fmt = T[339] || 1;
  if (T[259] !== 8) throw new Error('only deflate TIFFs are supported');
  const offs = [].concat(T[324]), lens = [].concat(T[325]), bps = bits / 8, out = bits === 32 ? new Float32Array(W * H) : new Uint8Array(W * H);
  const across = Math.ceil(W / tw), row = new Uint8Array(tw * bps), dv = new DataView(row.buffer);
  offs.forEach((o, t) => {
    const raw = inflateSync(buf.subarray(o, o + lens[t])), x0 = (t % across) * tw, y0 = Math.floor(t / across) * th;
    for (let y = 0; y < th && y0 + y < H; y++) {
      const r = raw.subarray(y * tw * bps, (y + 1) * tw * bps);
      if (pred === 3) {                                      // diferencies de bytes, despres plans de bytes (big endian)
        for (let k = 1; k < r.length; k++) r[k] = (r[k] + r[k - 1]) & 0xff;
        for (let x = 0; x < tw; x++) for (let b = 0; b < bps; b++) row[x * bps + b] = r[b * tw + x];
        for (let x = 0; x < tw && x0 + x < W; x++) out[(y0 + y) * W + x0 + x] = dv.getFloat32(x * bps, false);
      } else {
        if (pred === 2) for (let k = bps; k < r.length; k++) r[k] = (r[k] + r[k - bps]) & 0xff;
        for (let x = 0; x < tw && x0 + x < W; x++) out[(y0 + y) * W + x0 + x] = bits === 32 ? (fmt === 3 ? new DataView(r.buffer, r.byteOffset).getFloat32(x * 4, le) : 0) : r[x];
      }
    }
  });
  // tiepoint (pixel 0,0 -> lon, lat) i mida del pixel; GTRasterTypeGeoKey 2 = PixelIsPoint
  const tp = T[33922], sc = T[33550], keys = [].concat(T[34735] || []);
  let isPoint = false; for (let k = 4; k + 3 < keys.length; k += 4) if (keys[k] === 1025) isPoint = keys[k + 3] === 2;
  return { W, H, data: out, lon0: tp[3], lat0: tp[4], dx: sc[0], dy: sc[1], isPoint };
}

async function fetchTile(name) {
  const local = cacheDir && `${cacheDir}/${name.split('/').pop()}`;
  if (local && existsSync(local)) return readFileSync(local);
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(`${BUCKET}/${name}`);
      if (r.status === 404 || r.status === 403) return null;          // el bucket no te tessel.les de mar obert
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const b = Buffer.from(await r.arrayBuffer());
      if (local) { mkdirSync(cacheDir, { recursive: true }); writeFileSync(local, b); }
      return b;
    } catch (e) { if (k >= 3) throw e; await new Promise(r => setTimeout(r, 2000 * 2 ** k)); }
  }
}
const tileName = (lat, lon, aux) => {
  const ns = (lat >= 0 ? 'N' : 'S') + String(Math.abs(lat)).padStart(2, '0'), ew = (lon >= 0 ? 'E' : 'W') + String(Math.abs(lon)).padStart(3, '0');
  const id = `Copernicus_DSM_COG_10_${ns}_00_${ew}_00`;
  return aux ? `${id}_DEM/AUXFILES/${id}_${aux}.tif` : `${id}_DEM/${id}_DEM.tif`;
};

/* ---- distancia euclidiana exacta (Felzenszwalb i Huttenlocher), al quadrat, en pixels ---- */
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    while ((s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])) <= z[k]) k--;
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = q - v[k]; d[q] = r * r + f[v[k]]; }
}
/** quadrat de la distancia de cada pixel al pixel mes proper amb seed[k] = 1 */
function edt(seed, W, H) {
  const INF = 1e20, g = new Float64Array(W * H), n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = seed[y * W + x] ? 0 : INF; edt1d(f, H, d, v, z); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = g[y * W + x]; edt1d(f, W, d, v, z); for (let x = 0; x < W; x++) g[y * W + x] = d[x]; }
  return g;
}

async function main() {
  const t0 = Date.now();
  const sumH = new Float64Array(NX * NY), cntL = new Uint16Array(NX * NY);                // alcada: suma i pixels de terra
  const SX = NX * SUB, SY = NY * SUB, SC = CELL / SUB, sea = new Uint16Array(SX * SY), cnt = new Uint16Array(SX * SY);
  const latA = Math.floor(latOf(G.n0 - CELL)), latB = Math.floor(latOf(G.n0 + NY * CELL)), lonA = Math.floor(lonOf(G.e0 - CELL)), lonB = Math.floor(lonOf(G.e0 + NX * CELL));
  let tiles = 0;
  for (let lat = latA; lat <= latB; lat++) for (let lon = lonA; lon <= lonB; lon++) {
    const demBuf = await fetchTile(tileName(lat, lon));
    if (!demBuf) { console.log(`  ${lat} ${lon}: no hi ha tessel.la (mar)`); continue; }
    const wbmBuf = await fetchTile(tileName(lat, lon, 'WBM'));
    if (!wbmBuf) throw new Error(`${lat} ${lon}: falta la WBM`);
    const D = readTiff(demBuf), M = readTiff(wbmBuf);
    if (M.W !== D.W || M.H !== D.H) throw new Error(`${lat} ${lon}: WBM i DEM de mides diferents`);
    const half = D.isPoint ? 0 : 0.5;
    for (let y = 0; y < D.H; y++) {
      const la = D.lat0 - (y + half) * D.dy, n = (la - GEO.lat0) * GEO.kN, j = Math.round((n - G.n0) / CELL), sj = Math.round((n - G.n0) / SC);
      if (sj < 0 || sj >= SY) continue;
      for (let x = 0; x < D.W; x++) {
        const lo = D.lon0 + (x + half) * D.dx, e = (lo - GEO.lon0) * GEO.kE, si = Math.round((e - G.e0) / SC);
        if (si < 0 || si >= SX) continue;
        const k = y * D.W + x, isSea = M.data[k] === 1, s = sj * SX + si;
        cnt[s]++; if (isSea) sea[s]++;
        const i = Math.round((e - G.e0) / CELL);
        if (!isSea && i >= 0 && i < NX && j >= 0 && j < NY) { sumH[j * NX + i] += D.data[k]; cntL[j * NX + i]++; }
      }
    }
    tiles++; console.log(`  ${lat} ${lon}: ${D.W}x${D.H} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }

  // alcada en metres enters; sense pixels de terra, 0
  const h = new Int16Array(NX * NY);
  let hMax = -1e9, hMin = 1e9;
  for (let k = 0; k < h.length; k++) { const v = cntL[k] ? Math.round(sumH[k] / cntL[k]) : 0; h[k] = Math.max(-32768, Math.min(32767, v)); if (v > hMax) hMax = v; if (v < hMin) hMin = v; }

  // costa: mascara a 125 m, distancia exacta a cada costat i, als nodes, la distancia signada
  const land = new Uint8Array(SX * SY), water = new Uint8Array(SX * SY);
  for (let s = 0; s < land.length; s++) { const w = !cnt[s] || sea[s] * 2 >= cnt[s]; water[s] = w ? 1 : 0; land[s] = w ? 0 : 1; }
  const dLand = edt(land, SX, SY), dWater = edt(water, SX, SY);
  const sd = new Int16Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const s = j * SUB * SX + i * SUB, v = land[s] ? (Math.sqrt(dWater[s]) - 0.5) * SC : -(Math.sqrt(dLand[s]) - 0.5) * SC;
    sd[j * NX + i] = Math.round(Math.max(-SD_MAX, Math.min(SD_MAX, v)));
  }

  const { header, body } = packTerrain({ nx: NX, ny: NY, cell: CELL, e0: G.e0, n0: G.n0, hScale: 1, sdScale: 1, h, sd });
  const z = deflateSync(body, { level: Z.Z_BEST_COMPRESSION, memLevel: 9 });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.concat([header, z]));
  console.log(`${tiles} tessel.les; alcada ${hMin}..${hMax} m; ${OUT}: ${((header.length + z.length) / 1048576).toFixed(2)} MB (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

main().catch(e => { console.error(e); process.exit(1); });
