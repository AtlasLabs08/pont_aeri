/* Graella del terreny real (alcada i distancia signada a la costa) i funcio
 * d alcada del terreny.
 * ORIGEN: linies 1466-1638 de l'original.
 *
 * EXPORTA: World URBAN_SMOOTH
 *
 * IMPORTA: ../core/constants.js, ../core/noise.js (vnoise, la vora de les
 *          ciutats), ../core/flight-model.js (nomes SURF), ./geo.js,
 *          ./airports.js, ./terrain-data.js (el fitxer de dades)
 *
 * TERRENY REAL (fase A, docs/DECISIONS.md, 2026-10-02, TA-1 a TA-7):
 *   - World.G es la graella de 250 m del fitxer public/terrain/terrain-250.bin
 *     (tools/terrain-build.mjs, Copernicus GLO-30): G.h = alcada en m, G.data =
 *     distancia signada a la costa en m (+ terra endins), de la mascara d aigua
 *     de Copernicus. World.load(bytes) el descodifica i crida build(); sense
 *     dades, el mon no esta llest (ready = false).
 *   - Alcada: bilineal (heightDem). Mar on sd <= 0, amb el fons de sempre a
 *     partir de la distancia. Normals: slopeAt, diferencies centrades amb un
 *     estencil igual a la cel.la (+-125 m): continues, sense facetes.
 *   - Zones URBAN: el model de superficie inclou els edificis. build() fa una
 *     obertura (minim i despres maxim de 3x3 cel.les) i un suavitzat de 3x3,
 *     i nomes rebaixa, com a molt l alcada d un edifici (URBAN_SMOOTH).
 *   - Aeroports (TA-4): plataforma plana a A.elev a tot el rectangle (bounds) i
 *     transicio smoothstep de 700 m fins al terreny real (_airportBlend). Res
 *     de valls ni excavacions.
 *   - Photo (TA-7): on hi ha el seu DEM de 5 m, mana el seu (heightAt).
 */

import { DEG, clamp, lerp, smoothstep } from '../core/constants.js';
import { vnoise } from '../core/noise.js';
import { SURF } from '../core/flight-model.js';
import { ll, COAST, URBAN, ROADS } from './geo.js';
import { AIRPORTS, AIRPORT_ORDER, airportPavedAt } from './airports.js';
import { decodeTerrain } from './terrain-data.js';

/* suavitzat de les zones URBAN (TA-5): pes complet fins a r = full, cap a r = edge (r = 1 a la vora de l el.lipse);
 * rebaixa com a molt maxCutM (l alcada d un edifici): els turons de debo (Montjuic) es queden */
export const URBAN_SMOOTH = { full: 0.8, edge: 1.2, maxCutM: 25 };

/* ---------------------------------------------------------------------------
 * Photo (escenari fotografic) es queda a index.html perque depen de THREE,
 * de fetch i de location, i per tant no pot viure en aquesta capa headless.
 * El terreny nomes necessita saber si esta actiu i consultar-ne l alcada.
 *
 * Injeccio de dependencia: index.html crida setPhoto(Photo) despres de
 * definir-lo. Sense escenari fotografic, el marcador de posicio amb on:false
 * dona el terreny de la graella, que es el que passa quan la carpeta
 * scenery/ no hi es.
 * ------------------------------------------------------------------------- */
let Photo = { on: false };
export function setPhoto(p) { Photo = p; }
export const World = {
  G: { e0: -160000, n0: -300000, cell: 250, nx: 1640, ny: 1840, data: null, h: null },
  ready: false,

  /** el fitxer de dades sencer (public/terrain/terrain-250.bin) -> build */
  async load(bytes) { this.build(await decodeTerrain(bytes)); },

  /** T = unpackTerrain(...): capes de la graella G en metres */
  build(T) {
    const G = this.G;
    if (!T || T.nx !== G.nx || T.ny !== G.ny || T.cell !== G.cell || T.e0 !== G.e0 || T.n0 !== G.n0) throw new Error('terrain data does not match World.G');
    const data = G.data = Float32Array.from(T.sd), H = G.h = Float32Array.from(T.h);
    this.coastPolys = Object.keys(COAST).map(k => COAST[k].map(q => ll(q[0], q[1])));       // el ND dibuixa la costa de geo.js
    // forced land: airports (oriented rectangles)
    const rects = [];
    for (const id of AIRPORT_ORDER) { const A = AIRPORTS[id], b = A.bounds, c = A.toWorld((b[0] + b[1]) / 2, (b[2] + b[3]) / 2); rects.push({ e: c[0], n: c[1], ua: A.ua, uc: A.uc, ha: (b[1] - b[0]) / 2 + 250, hc: (b[3] - b[2]) / 2 + 250 }); }
    const port = ll(2.166, 41.338), pr = 24 * DEG; this.port = { e: port[0], n: port[1], ua: [Math.sin(pr), Math.cos(pr)], uc: [-Math.cos(pr), Math.sin(pr)], ha: 3600, hc: 750 };
    for (const R of rects) {
      const rad = Math.hypot(R.ha, R.hc) + 600, i0 = Math.max(0, Math.floor((R.e - rad - G.e0) / G.cell)), i1 = Math.min(G.nx - 1, Math.ceil((R.e + rad - G.e0) / G.cell));
      const j0 = Math.max(0, Math.floor((R.n - rad - G.n0) / G.cell)), j1 = Math.min(G.ny - 1, Math.ceil((R.n + rad - G.n0) / G.cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const de = G.e0 + i * G.cell - R.e, dn = G.n0 + j * G.cell - R.n, a = Math.abs(de * R.ua[0] + dn * R.ua[1]) - R.ha, c = Math.abs(de * R.uc[0] + dn * R.uc[1]) - R.hc;
        const s = -(Math.max(a, c) > 0 ? Math.hypot(Math.max(a, 0), Math.max(c, 0)) : Math.max(a, c));
        if (s > data[j * G.nx + i]) data[j * G.nx + i] = s;
      }
    }
    this.urban = URBAN.map(u => { const p = ll(u.c[0], u.c[1]), r = u.rot * DEG; return { e: p[0], n: p[1], a: u.a * 1000, b: u.b * 1000, ua: [Math.sin(r), Math.cos(r)], d: u.d, grid: u.grid, core: u.core || 0, name: u.n }; });
    this.roads = ROADS.map(r => r.map(q => ll(q[0], q[1])));
    this._smoothUrban(H);
    this.ready = true;
  },

  /** TA-5: dins de cada zona URBAN, obertura de 3x3 cel.les i suavitzat de 3x3; nomes rebaixa, fins a maxCutM */
  _smoothUrban(H) {
    const G = this.G, nx = G.nx, ny = G.ny, w = new Float32Array(nx * ny);
    let i0 = nx, i1 = -1, j0 = ny, j1 = -1;
    for (const u of this.urban) {
      const R = u.a * URBAN_SMOOTH.edge, a0 = Math.max(1, Math.floor((u.e - R - G.e0) / G.cell)), a1 = Math.min(nx - 2, Math.ceil((u.e + R - G.e0) / G.cell));
      const b0 = Math.max(1, Math.floor((u.n - R - G.n0) / G.cell)), b1 = Math.min(ny - 2, Math.ceil((u.n + R - G.n0) / G.cell));
      for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) {
        const de = G.e0 + i * G.cell - u.e, dn = G.n0 + j * G.cell - u.n, pa = (de * u.ua[0] + dn * u.ua[1]) / u.a, pb = (-de * u.ua[1] + dn * u.ua[0]) / u.b;
        const v = 1 - smoothstep(URBAN_SMOOTH.full, URBAN_SMOOTH.edge, Math.sqrt(pa * pa + pb * pb)), k = j * nx + i;
        if (v > w[k]) { w[k] = v; i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
      }
    }
    if (i1 < 0) return;
    // tres passades de 3x3 (minim, maxim, mitjana) sobre la capsa de les zones, amb 3 cel.les de marge
    i0 = Math.max(1, i0 - 3); i1 = Math.min(nx - 2, i1 + 3); j0 = Math.max(1, j0 - 3); j1 = Math.min(ny - 2, j1 + 3);
    const pass = (src, op) => { const out = Float32Array.from(src);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        let m = op === 'min' ? Infinity : op === 'max' ? -Infinity : 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const v = src[(j + dj) * nx + i + di]; m = op === 'min' ? Math.min(m, v) : op === 'max' ? Math.max(m, v) : m + v / 9; }
        out[j * nx + i] = m;
      }
      return out; };
    const S = pass(pass(pass(H, 'min'), 'max'), 'mean');
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * nx + i; if (w[k] > 0 && G.data[k] > 0) H[k] -= w[k] * clamp(H[k] - S[k], 0, URBAN_SMOOTH.maxCutM); }
  },

  /** signed distance to the coast in metres (+ inland), bilinear */
  sd(e, n) {
    const G = this.G, fx = (e - G.e0) / G.cell, fy = (n - G.n0) / G.cell;
    if (fx < 0 || fy < 0 || fx >= G.nx - 1 || fy >= G.ny - 1) return -20000;
    const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, k = j * G.nx + i, d = G.data;
    return lerp(lerp(d[k], d[k + 1], tx), lerp(d[k + G.nx], d[k + G.nx + 1], tx), ty);
  },

  /** airport flattening weight: returns [weight 0..1, elevation] */
  _airportBlend(e, n) {
    for (const id of AIRPORT_ORDER) {
      const A = AIRPORTS[id]; if (Math.abs(e - A.e) > 6000 || Math.abs(n - A.n) > 6000) continue;
      const l = A.toLocal(e, n), b = A.bounds, da = Math.max(b[0] - l[0], l[0] - b[1]), dc = Math.max(b[2] - l[1], l[1] - b[3]);
      const d = Math.max(da, dc) > 0 ? Math.hypot(Math.max(da, 0), Math.max(dc, 0)) : Math.max(da, dc);
      if (d < 700) return [1 - smoothstep(0, 700, d), A.elev, d, A];
    }
    return null;
  },

  /** terrain height in metres above mean sea level (negative = sea bed); the photo zone blends in its own relief (TA-7) */
  heightAt(e, n) {
    if (Photo.on) { const w = Photo.weight(e, n); if (w >= 1) return Photo.height(e, n); if (w > 0) return lerp(this.heightDem(e, n), Photo.height(e, n), w); }
    return this.heightDem(e, n);
  },
  /** relleu real de la graella, bilineal (m), sense mar ni aeroports; fora de la graella, 0 */
  demAt(e, n) {
    const G = this.G, fx = (e - G.e0) / G.cell, fy = (n - G.n0) / G.cell;
    if (fx < 0 || fy < 0 || fx >= G.nx - 1 || fy >= G.ny - 1) return 0;
    const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, k = j * G.nx + i, d = G.h;
    return lerp(lerp(d[k], d[k + 1], tx), lerp(d[k + G.nx], d[k + G.nx + 1], tx), ty);
  },
  /** terreny real amb el mar i els aeroports (sense l escenari fotografic) */
  heightDem(e, n) {
    const sd = this.sd(e, n);
    if (sd <= 0) return Math.max(-400, sd * 0.3 - 0.5);
    let h = Math.max(this.demAt(e, n), 0.6 + Math.min(sd, 60) * 0.03);      // la terra sempre per sobre del pla del mar
    const ab = this._airportBlend(e, n);
    if (ab) h = ab[0] >= 1 ? ab[1] : lerp(h, ab[1], ab[0]);      // dins del rectangle, exactament A.elev
    return h;
  },
  /** pendent [dh/de, dh/dn] per a les normals (TA-6): diferencies centrades amb un estencil igual a la cel.la
   *  (continu sobre la bilineal, sense facetes); dins de l escenari fotografic, 30 m */
  slopeAt(e, n) {
    const s = Photo.on ? lerp(this.G.cell / 2, 30, Photo.weight(e, n)) : this.G.cell / 2;
    return [(this.heightAt(e + s, n) - this.heightAt(e - s, n)) / (2 * s), (this.heightAt(e, n + s) - this.heightAt(e, n - s)) / (2 * s)];
  },
  /** urban density 0..1 and the street-grid angle of the dominating town */
  urbanAt(e, n, h, out) {
    let best = 0, grid = 0, core = 0;
    for (const u of this.urban) {
      const de = e - u.e, dn = n - u.n; if (Math.abs(de) > u.a + 500 && Math.abs(dn) > u.a + 500) continue;
      const pa = (de * u.ua[0] + dn * u.ua[1]) / u.a, pb = (-de * u.ua[1] + dn * u.ua[0]) / u.b, r = Math.sqrt(pa * pa + pb * pb);
      if (r >= 1.15) continue;
      const v = u.d * (1 - smoothstep(0.72, 1.15, r + 0.18 * vnoise(e / 700, n / 700)));
      if (v > best) { best = v; grid = u.grid; core = u.core && r < 0.62 ? 1 : 0; }
    }
    if (best > 0) { best *= smoothstep(330, 170, h); const ab = this._airportBlend(e, n); if (ab && ab[2] < 150) best = 0; }
    if (out) { out.grid = grid; out.core = core; }
    return best;
  },

  /** nearest airport object within range */
  airportNear(e, n, range) {
    for (const id of AIRPORT_ORDER) { const A = AIRPORTS[id]; if (Math.abs(e - A.e) < range && Math.abs(n - A.n) < range) return A; }
    return null;
  },
  /** surface type under a point, used by the flight model's ground contact */
  surfaceAt(e, n) {
    const A = this.airportNear(e, n, 7000);
    if (A) { const l = A.toLocal(e, n); if (airportPavedAt(A, l[0], l[1])) return SURF.PAVED; const b = A.bounds; if (l[0] > b[0] && l[0] < b[1] && l[1] > b[2] && l[1] < b[3]) return SURF.GRASS; }
    if (Photo.on && Photo.weight(e, n) > 0.5) return Photo.isWater(e, n) ? SURF.WATER : SURF.TERRAIN;
    return this.sd(e, n) <= 0 ? SURF.WATER : SURF.TERRAIN;
  },
  /** ground (or sea surface) elevation for the physics */
  groundAt(e, n) { return Math.max(0, this.heightAt(e, n)); }
};
