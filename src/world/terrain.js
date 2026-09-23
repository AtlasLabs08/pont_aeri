/* Graella de distancia signada a la costa i funcio d alcada del terreny.
 * ORIGEN: linies 1466-1638 de l'original.
 *
 * EXPORTA: World
 *
 * IMPORTA: ../core/constants.js, ../core/noise.js, ../core/flight-model.js
 *          (nomes SURF), ./geo.js, ./airports.js
 */

import { DEG, clamp, lerp, smoothstep } from '../core/constants.js';
import { vnoise, fbm, ridged } from '../core/noise.js';
import { SURF } from '../core/flight-model.js';
import { ll, COAST, RIDGES, VALLEYS, URBAN, ROADS } from './geo.js';
import { AIRPORTS, AIRPORT_ORDER, airportPavedAt } from './airports.js';
export const World = {
  G: { e0: -160000, n0: -300000, cell: 250, nx: 1640, ny: 1840, data: null },
  ready: false,

  build(progress) {
    const G = this.G;
    // polygons in metres with bounding boxes
    const polys = Object.keys(COAST).map(k => { const p = COAST[k].map(q => ll(q[0], q[1])); let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const v of p) { a = Math.min(a, v[0]); b = Math.max(b, v[0]); c = Math.min(c, v[1]); d = Math.max(d, v[1]); } return { p, bb: [a, b, c, d] }; });
    const sdPolys = (e, n, margin) => {
      let best = -1e9;
      for (const P of polys) {
        if (e < P.bb[0] - margin || e > P.bb[1] + margin || n < P.bb[2] - margin || n > P.bb[3] + margin) continue;
        const p = P.p; let d2 = 1e18, inside = false;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
          const ax = p[j][0], ay = p[j][1], bx = p[i][0], by = p[i][1];
          const dx = bx - ax, dy = by - ay, t = clamp(((e - ax) * dx + (n - ay) * dy) / (dx * dx + dy * dy), 0, 1);
          const qx = ax + dx * t - e, qy = ay + dy * t - n, dd = qx * qx + qy * qy; if (dd < d2) d2 = dd;
          if ((ay > n) !== (by > n) && e < (bx - ax) * (n - ay) / (by - ay) + ax) inside = !inside;
        }
        const s = inside ? Math.sqrt(d2) : -Math.sqrt(d2); if (s > best) best = s;
      }
      return best < -1e8 ? -margin : best;
    };
    this.coastPolys = polys.map(P => P.p);
    // coarse pass (2.5 km)
    const cs = 2500, cnx = Math.ceil(G.nx * G.cell / cs) + 2, cny = Math.ceil(G.ny * G.cell / cs) + 2, coarse = new Float32Array(cnx * cny);
    for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) coarse[j * cnx + i] = sdPolys(G.e0 + i * cs, G.n0 + j * cs, 60000);
    // fine pass: exact (with a little domain warp for natural looking coasts) only near the coast
    const data = G.data = new Float32Array(G.nx * G.ny);
    for (let j = 0; j < G.ny; j++) {
      const n = G.n0 + j * G.cell, cj = Math.floor(j * G.cell / cs);
      for (let i = 0; i < G.nx; i++) {
        const e = G.e0 + i * G.cell, ci = Math.floor(i * G.cell / cs), k = cj * cnx + ci;
        const c00 = coarse[k], c10 = coarse[k + 1], c01 = coarse[k + cnx], c11 = coarse[k + cnx + 1];
        const mn = Math.min(Math.abs(c00), Math.abs(c10), Math.abs(c01), Math.abs(c11));
        if (mn > 6000) { const fx = (i * G.cell / cs) - ci, fy = (j * G.cell / cs) - cj; data[j * G.nx + i] = lerp(lerp(c00, c10, fx), lerp(c01, c11, fx), fy); }
        else {
          const wx = 420 * fbm(e / 5200, n / 5200, 3) + 110 * vnoise(e / 900, n / 900), wy = 420 * fbm(e / 5200 + 40, n / 5200 - 17, 3) + 110 * vnoise(e / 900 + 9, n / 900 + 5);
          data[j * G.nx + i] = sdPolys(e + wx, n + wy, 8000);
        }
      }
    }
    // forced land: airports and the port of Barcelona (oriented rectangles)
    const rects = [];
    for (const id of AIRPORT_ORDER) { const A = AIRPORTS[id], b = A.bounds, c = A.toWorld((b[0] + b[1]) / 2, (b[2] + b[3]) / 2); rects.push({ e: c[0], n: c[1], ua: A.ua, uc: A.uc, ha: (b[1] - b[0]) / 2 + 250, hc: (b[3] - b[2]) / 2 + 250 }); }
    const port = ll(2.166, 41.338), pr = 24 * DEG; this.port = { e: port[0], n: port[1], ua: [Math.sin(pr), Math.cos(pr)], uc: [-Math.cos(pr), Math.sin(pr)], ha: 3600, hc: 750 };
    rects.push(this.port);
    for (const R of rects) {
      const rad = Math.hypot(R.ha, R.hc) + 600, i0 = Math.max(0, Math.floor((R.e - rad - G.e0) / G.cell)), i1 = Math.min(G.nx - 1, Math.ceil((R.e + rad - G.e0) / G.cell));
      const j0 = Math.max(0, Math.floor((R.n - rad - G.n0) / G.cell)), j1 = Math.min(G.ny - 1, Math.ceil((R.n + rad - G.n0) / G.cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const de = G.e0 + i * G.cell - R.e, dn = G.n0 + j * G.cell - R.n, a = Math.abs(de * R.ua[0] + dn * R.ua[1]) - R.ha, c = Math.abs(de * R.uc[0] + dn * R.uc[1]) - R.hc;
        const s = -(Math.max(a, c) > 0 ? Math.hypot(Math.max(a, 0), Math.max(c, 0)) : Math.max(a, c));
        if (s > data[j * G.nx + i]) data[j * G.nx + i] = s;
      }
    }
    // pre-convert feature tables to metres
    this.ridges = RIDGES.map(r => { const pts = r.pts.map(q => { const p = ll(q[0], q[1]); return [p[0], p[1], q[2], q[3] * 1000]; }); let a = 1e9, b = -1e9, c = 1e9, d = -1e9, wm = 0; for (const v of pts) { a = Math.min(a, v[0]); b = Math.max(b, v[0]); c = Math.min(c, v[1]); d = Math.max(d, v[1]); wm = Math.max(wm, v[3]); } return { pts, rough: r.rough || 0, smooth: r.smooth || 0, bb: [a - 2.6 * wm, b + 2.6 * wm, c - 2.6 * wm, d + 2.6 * wm] }; });
    this.valleys = VALLEYS.map(v => ({ w: v.w * 1000, pts: v.pts.map(q => ll(q[0], q[1])) }));
    this.urban = URBAN.map(u => { const p = ll(u.c[0], u.c[1]), r = u.rot * DEG; return { e: p[0], n: p[1], a: u.a * 1000, b: u.b * 1000, ua: [Math.sin(r), Math.cos(r)], d: u.d, grid: u.grid, core: u.core || 0, name: u.n }; });
    this.roads = ROADS.map(r => r.map(q => ll(q[0], q[1])));
    this.delta = ll(2.075, 41.312);
    this.ready = true;
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

  /** terrain height in metres above mean sea level (negative = sea bed); the photo zone blends in the real relief */
  heightAt(e, n) {
    if (Photo.on) { const w = Photo.weight(e, n); if (w >= 1) return Photo.height(e, n); if (w > 0) return lerp(this.heightProc(e, n), Photo.height(e, n), w); }
    return this.heightProc(e, n);
  },
  heightProc(e, n) {
    const sd = this.sd(e, n);
    if (sd <= 0) return Math.max(-400, sd * 0.3 - 0.5);
    const island = n < -120000 || e > 130000;
    const mallorca = island && e > 5000 && e < 135000 && n > -240000;
    let base, hillAmp;
    if (!island) { base = 1.5 + 50 * (1 - Math.exp(-sd / 4000)) + Math.min(sd, 70000) * 0.007; hillAmp = 25 + Math.min(sd, 40000) * 0.006; }
    else if (mallorca) { base = 1.5 + 45 * (1 - Math.exp(-sd / 2500)) + Math.min(sd, 20000) * 0.003; hillAmp = 35; }
    else { base = 1.5 + 60 * (1 - Math.exp(-sd / 1500)); hillAmp = 45; }
    const hn = fbm(e / 7000, n / 7000, 4) * 0.5 + 0.5;
    let relief = hn * hillAmp + (fbm(e / 900, n / 900, 3)) * hillAmp * 0.12;
    // mountain ridges
    let rg = 0;
    for (const R of this.ridges) {
      if (e < R.bb[0] || e > R.bb[1] || n < R.bb[2] || n > R.bb[3]) continue;
      const p = R.pts; let best = 0;
      for (let i = 0; i + 1 < p.length; i++) {
        const ax = p[i][0], ay = p[i][1], dx = p[i + 1][0] - ax, dy = p[i + 1][1] - ay;
        const t = clamp(((e - ax) * dx + (n - ay) * dy) / (dx * dx + dy * dy), 0, 1);
        const qx = ax + dx * t - e, qy = ay + dy * t - n, w = lerp(p[i][3], p[i + 1][3], t), H = lerp(p[i][2], p[i + 1][2], t);
        const v = H * Math.exp(-(qx * qx + qy * qy) / (w * w)); if (v > best) best = v;
      }
      if (best > 1) {
        let mod = R.smooth ? 1 : 0.58 + 0.42 * ridged(e / 3800, n / 3800, 4) * 1.35;
        if (R.rough) mod = lerp(mod, 0.45 + 0.75 * ridged(e / 650, n / 650, 3), 0.55 * R.rough);
        best *= mod;
      }
      if (best > rg) rg = best;
    }
    // river valleys flatten the relief
    let vf = 1;
    for (const V of this.valleys) {
      const p = V.pts;
      for (let i = 0; i + 1 < p.length; i++) {
        const ax = p[i][0], ay = p[i][1], dx = p[i + 1][0] - ax, dy = p[i + 1][1] - ay;
        if (Math.abs(e - ax) > 20000 || Math.abs(n - ay) > 20000) continue;
        const t = clamp(((e - ax) * dx + (n - ay) * dy) / (dx * dx + dy * dy), 0, 1), qx = ax + dx * t - e, qy = ay + dy * t - n;
        vf = Math.min(vf, 1 - 0.9 * Math.exp(-(qx * qx + qy * qy) / (V.w * V.w)));
      }
    }
    // the Llobregat delta is flat farmland
    const dd = Math.hypot(e - this.delta[0], n - this.delta[1]); const dflat = dd < 12000 ? Math.exp(-Math.pow(dd / 6500, 4)) : 0;
    const coast = smoothstep(0, 900, sd);
    let h = base * (1 - 0.85 * dflat) + (relief * (1 - dflat) + rg) * vf * (0.25 + 0.75 * coast) * (rg > 50 ? smoothstep(0, 350, sd) * 0.9 + 0.1 : 1);
    h = Math.max(h, 0.6 + Math.min(sd, 60) * 0.03);
    const ab = this._airportBlend(e, n);
    if (ab) h = lerp(h, ab[1], ab[0]);
    return h;
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
