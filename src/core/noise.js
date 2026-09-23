/* Soroll procedimental i generador aleatori deterministe.
 * ORIGEN: linies 119-197 de l'original (SECTION 1), la part de soroll.
 *
 * EXPORTA: makeRng hash2 vnoise fbm ridged
 *
 * IMPORTA: clamp de ./constants.js (el fa servir ridged)
 */

import { clamp } from './constants.js';

/** deterministic RNG (mulberry32) */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** integer lattice hash -> [0,1) */
export function hash2(ix, iy) {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** 2D value noise in [-1,1], quintic interpolation */
export function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}
/** fractal noise, `oct` octaves, returns approx [-1,1] */
export function fbm(x, y, oct) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 17.3, y * f - i * 9.7); a *= 0.5; f *= 2.03; }
  return s;
}
/** ridged fractal noise in [0,1] (sharp crests) */
export function ridged(x, y, oct) {
  let s = 0, a = 0.5, f = 1, w = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(vnoise(x * f + i * 31.1, y * f + i * 12.9)); n *= n;
    s += n * a * w; w = clamp(n * 1.6, 0, 1); a *= 0.5; f *= 2.07;
  }
  return s;
}
