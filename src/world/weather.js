/* Meteorologia procedimental i amb llavor. Pura: mateixa entrada, mateixa
 * sortida. Mai Math.random ni Date; tot l atzar surt de hash2.
 * Ningu no la crida encara: F3 nomes la deixa feta (el rellotge arriba a l E1).
 *
 * EXPORTA: weatherFor toGameWeather WEATHER_PATTERNS HARD_SEVERITY
 * IMPORTA: hash2 (core)
 * INTERFICIE (no la canviis, els tests en depenen):
 *   weatherFor({ icao, month 1-12, hour 0-23, day enter, seed enter }) -> {
 *     windDirDeg 0-359 (d on ve el vent), windKt, gustKt (>= windKt),
 *     visibilityM (50..10000), ceilingFt (100..10000 o null = cel net),
 *     turbulence 0-1, pattern (clau de WEATHER_PATTERNS o 'general'),
 *     severity 0-1, hard (severity >= HARD_SEVERITY) }
 *   toGameWeather(w) -> { windDir, windKt, turb, gustKt, visibilityM, ceilingFt }
 *     windDir/windKt/turb son els tres camps de Game.opts (windDir 0..350 de
 *     10 en 10, windKt enter 0..40, turb boolea). La resta Game encara no
 *     els accepta: gustKt, visibilityM i ceilingFt s hi passen com a dades.
 */

import { hash2 } from '../core/index.js';

export const HARD_SEVERITY = 0.7;

/* Patrons locals i estacionals. Dades pures.
 *  p        probabilitat d activar-se dins la finestra: un numero o 12 valors (gener..desembre)
 *  hours    [primera, ultima] hora inclosa
 *  dir      [centre, obertura] en graus, d on ve el vent
 *  kt       [min, max] vent mitja; gust [min, max] ratxa afegida
 *  vis, ceil, turb  [min, max]; null = el general
 * L ordre importa: el primer patro que s activa guanya. */
const WINTER_P = [0.30, 0.30, 0.20, 0.12, 0.06, 0.04, 0.03, 0.03, 0.06, 0.12, 0.22, 0.30];
const SUMMER = [6, 7, 8];
const COAST = ['LEBL', 'LEPA', 'LEIB', 'LEMH', 'LEVC', 'LEAL', 'LEMG', 'LERS'];

export const WEATHER_PATTERNS = [
  { key: 'fogMorning', icao: ['LELL', 'LEGE'], months: [11, 12, 1, 2], hours: [5, 10], p: 0.6,
    dir: [0, 180], kt: [0, 4], gust: [0, 0], vis: [150, 900], ceil: [100, 300], turb: [0, 0.1] },
  { key: 'tramuntana', icao: ['LEGE'], hours: [0, 23], p: WINTER_P,
    dir: [355, 20], kt: [20, 34], gust: [8, 16], vis: [8000, 10000], ceil: null, turb: [0.35, 0.7] },
  { key: 'seaBreeze', icao: ['LEBL'], months: SUMMER, hours: [12, 19], p: 0.55,
    dir: [160, 20], kt: [10, 15], gust: [2, 5], vis: [7000, 10000], ceil: null, turb: [0.1, 0.3] },
  { key: 'garbi', icao: COAST, months: SUMMER, hours: [13, 20], p: 0.4,
    dir: [225, 15], kt: [13, 20], gust: [4, 8], vis: [8000, 10000], ceil: null, turb: [0.2, 0.45] },
  { key: 'thermalTurb', icao: ['LESU'], months: SUMMER, hours: [12, 18], p: 0.6,
    dir: [190, 60], kt: [5, 12], gust: [3, 8], vis: [9000, 10000], ceil: null, turb: [0.5, 0.85] }
];

/* Vent mitja general: quantils de z (uniforme) -> nusos. */
const WIND_Q = [[0, 0], [0.30, 3], [0.60, 6], [0.78, 10], [0.88, 14], [0.96, 18], [1, 26]];

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;
const inRange = (v, [a, b]) => v >= a && v <= b;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
}
/** uniforme [0,1) per a (sal, a, b) */
function u(salt, a, b) { return hash2((a ^ Math.imul(salt, 0x9E3779B1)) | 0, b | 0); }
/** suma de dues uniformes tornada a uniforme (CDF triangular): correlacio sense biaix */
function tri(a, b) { const s = a + b; return s < 1 ? s * s / 2 : 1 - (2 - s) * (2 - s) / 2; }
function quant(table, z) {
  for (let i = 1; i < table.length; i++) if (z <= table[i][0]) {
    const [z0, v0] = table[i - 1], [z1, v1] = table[i];
    return lerp(v0, v1, (z - z0) / (z1 - z0));
  }
  return table[table.length - 1][1];
}

function activePattern(icao, month, hour, rnd) {
  for (let i = 0; i < WEATHER_PATTERNS.length; i++) {
    const P = WEATHER_PATTERNS[i];
    if (P.icao.indexOf(icao) < 0) continue;
    if (P.months && P.months.indexOf(month) < 0) continue;
    if (!inRange(hour, P.hours)) continue;
    const p = Array.isArray(P.p) ? P.p[month - 1] : P.p;
    if (rnd(10 + i) < p) return P;
  }
  return null;
}

export function weatherFor({ icao, month, hour, day, seed }) {
  const ih = hashStr(String(icao)) ^ (seed | 0), dk = day | 0, hk = (day | 0) * 24 + (hour | 0);
  const dayU = s => u(s, ih, dk), hrU = s => u(s, ih ^ 0x5bd1e995, hk), anyU = s => u(s, ih ^ 0x1b873593, hk * 7 + month);
  const P = activePattern(String(icao), month, hour, anyU);

  // vent general: el dia fixa el regim i l hora el mou una mica
  const z = tri(dayU(1), hrU(2));
  let windKt = quant(WIND_Q, z);
  const gustRatio = 0.2 + 0.45 * hrU(3);
  let gustKt = windKt < 6 ? windKt + 3 * hrU(4) : windKt * (1 + gustRatio) + 2 * hrU(4);
  let windDirDeg = (dayU(5) * 360 + (hrU(6) - 0.5) * 60 + 360) % 360;

  // visibilitat i sostre generals
  const qv = tri(dayU(7), hrU(8));
  let visibilityM = qv < 0.9 ? 10000 - 4000 * hrU(9) * hrU(9) : 10000 * Math.pow(1 - (qv - 0.9) / 0.1 * 0.97, 1.2);
  const qc = tri(dayU(11), hrU(12));
  let ceilingFt = qc < 0.5 ? null : 300 + 9700 * Math.pow(1 - (qc - 0.5) / 0.5, 1.2);
  let turbulence = clamp01(0.04 + windKt / 40 * 0.5 + (gustKt - windKt) / 25 * 0.3 + 0.08 * hrU(13));

  if (P) {
    const r = k => anyU(20 + k);
    windDirDeg = (P.dir[0] + P.dir[1] * (2 * r(0) - 1) + 720) % 360;
    windKt = lerp(P.kt[0], P.kt[1], r(1));
    gustKt = windKt + lerp(P.gust[0], P.gust[1], r(2));
    if (P.vis) visibilityM = lerp(P.vis[0], P.vis[1], r(3));
    if (P.ceil) ceilingFt = lerp(P.ceil[0], P.ceil[1], r(4));
    if (P.turb) turbulence = lerp(P.turb[0], P.turb[1], r(5));
  }
  // la boira baixa tambe abaixa el sostre
  if (visibilityM < 1500) ceilingFt = Math.min(ceilingFt == null ? 1e9 : ceilingFt, 100 + 300 * visibilityM / 1500);

  windKt = Math.round(windKt);
  gustKt = Math.max(windKt, Math.round(gustKt));
  windDirDeg = Math.round(windDirDeg) % 360;
  visibilityM = Math.max(50, visibilityM < 1000 ? Math.round(visibilityM / 50) * 50 : Math.round(visibilityM / 100) * 100);
  if (ceilingFt != null) ceilingFt = Math.max(100, Math.round(ceilingFt / 100) * 100);
  if (ceilingFt != null && ceilingFt > 10000) ceilingFt = null;
  turbulence = Math.round(clamp01(turbulence) * 100) / 100;

  const severity = Math.round(1000 * Math.max(
    clamp01(Math.max(gustKt / 45, windKt / 35)),
    visibilityM >= 5000 ? 0 : (5000 - visibilityM) / 5000,
    ceilingFt == null || ceilingFt >= 1500 ? 0 : (1500 - ceilingFt) / 1500,
    turbulence)) / 1000;

  return { windDirDeg, windKt, gustKt, visibilityM, ceilingFt, turbulence,
    pattern: P ? P.key : 'general', severity, hard: severity >= HARD_SEVERITY };
}

/** Passa una meteo a les unitats de Game.opts (windDir 0..350 de 10 en 10, windKt 0..40, turb boolea). */
export function toGameWeather(w) {
  return {
    windDir: (Math.round(w.windDirDeg / 10) * 10) % 360,
    windKt: Math.min(40, Math.max(0, Math.round(w.windKt))),
    turb: w.turbulence >= 0.35,
    gustKt: w.gustKt, visibilityM: w.visibilityM, ceilingFt: w.ceilingFt
  };
}
