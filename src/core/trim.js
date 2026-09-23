/* Resolutor de trimat: troba alpha, palanca i trim de capcineig per a vol
 * estabilitzat.
 * ORIGEN: linies 865-905 de l'original (SECTION 5).
 *
 * EXPORTA: FDM_KEYS FLAT_ENV_AIR fdmSnapshot fdmRestore trimAircraft
 *          (FLAT_ENV_AIR s exporta perque el harness el fa servir)
 *
 * IMPORTA: ./constants.js, ./atmosphere.js, ./flight-model.js
 */

import { DEG, clamp } from './constants.js';
import { tasFromCas } from './atmosphere.js';
import { SURF } from './flight-model.js';
export const FDM_KEYS = ['n', 'e', 'h', 'vn', 've', 'vd', 'q0', 'q1', 'q2', 'q3', 'p', 'q', 'r', 'fuel', 'mass', 'time', 'elev', 'ail', 'rud',
  'steer', 'flapPos', 'gearPos', 'spoilerPos', 'brakeAct', 'trim', 'revPos', 'airTime', 'groundTime', 'wow', 'mainWow', 'noseWow', 'stalled', 'distGround', 'groundSpoilerArmed', 'alphaDot', '_alphaPrev'];
export function fdmSnapshot(f) { const s = {}; for (const k of FDM_KEYS) s[k] = f[k]; s.eng = f.eng.map(e => e.x); s.legs = f.legs.map(l => [l.so, l.comp]); s.td = f.touchdown; return s; }
export function fdmRestore(f, s) { for (const k of FDM_KEYS) f[k] = s[k]; f.eng.forEach((e, i) => e.x = s.eng[i]); f.legs.forEach((l, i) => { l.so = s.legs[i][0]; l.comp = s.legs[i][1]; }); f.touchdown = s.td; f.events.length = 0; }

/** Trim the aircraft in the air. opts: {cas (m/s), alt, gamma, flaps, gearDown, hdg, n, e, mass, fuel}
    Leaves the model initialised in the trimmed state and returns {alpha, throttle, trim, ok}. */
export function trimAircraft(fdm, opts) {
  const tas = tasFromCas(opts.cas, opts.alt), gam = opts.gamma || 0;
  let X = [0.06, 0.4, 0.2];
  const ctl = { pitch: 0, roll: 0, yaw: 0, throttle: 0, flaps: opts.flaps || 0, gearDown: !!opts.gearDown, brake: 0, parkBrake: false, spoiler: 0, reverse: false, trim: 0 };
  const evalF = (x) => {
    fdm.reset({ n: opts.n, e: opts.e, alt: opts.alt, hdg: opts.hdg || 0, theta: x[0] + gam, tas, gamma: gam, flaps: ctl.flaps, gearDown: ctl.gearDown, throttle: x[1], mass: opts.mass, fuel: opts.fuel });
    // nose at theta, velocity along gamma: alpha = theta-gamma exactly (no wind in the solver)
    ctl.throttle = x[1]; ctl.trim = x[2];
    const hdg = (opts.hdg || 0) * DEG, v0 = [fdm.vn, fdm.ve, fdm.vd], h = 1e-4;
    fdm.step(h, ctl, FLAT_ENV_AIR);
    const an = ((fdm.vn - v0[0]) * Math.cos(hdg) + (fdm.ve - v0[1]) * Math.sin(hdg)) / h, ad = (fdm.vd - v0[2]) / h;
    return [an, ad, fdm.q / h];
  };
  let ok = false;
  for (let it = 0; it < 40; it++) {
    const f = evalF(X);
    if (Math.abs(f[0]) < 1e-4 && Math.abs(f[1]) < 1e-4 && Math.abs(f[2]) < 1e-5) { ok = true; break; }
    const J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], d = 1e-3;
    for (let j = 0; j < 3; j++) { const Xp = X.slice(); Xp[j] += d; const fp = evalF(Xp); for (let i = 0; i < 3; i++) J[i][j] = (fp[i] - f[i]) / d; }
    const det = J[0][0] * (J[1][1] * J[2][2] - J[1][2] * J[2][1]) - J[0][1] * (J[1][0] * J[2][2] - J[1][2] * J[2][0]) + J[0][2] * (J[1][0] * J[2][1] - J[1][1] * J[2][0]);
    if (Math.abs(det) < 1e-12) break;
    const col = (k) => { const A = J.map(r => r.slice()); for (let i = 0; i < 3; i++) A[i][k] = f[i];
      return (A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])) / det; };
    X = [clamp(X[0] - 0.8 * col(0), -0.15, 0.4), clamp(X[1] - 0.8 * col(1), 0, 1), clamp(X[2] - 0.8 * col(2), -1, 1)];
  }
  evalF(X); // leave the model in the trimmed state (the 0.1 ms probe step is negligible)
  fdm.time = 0; fdm.airTime = 99; fdm.events.length = 0;
  return { alpha: X[0], throttle: X[1], trim: X[2], ok };
}
export const FLAT_ENV_AIR = { windN: 0, windE: 0, groundHeight: () => -1e5, surface: () => SURF.PAVED };
