/* Constants i ajudants matematics.
 * ORIGEN: linies 119-197 de l'original (SECTION 1), la part de constants i mates.
 *
 * EXPORTA: DEG RAD FT KT NM G0 FPM
 *          clamp lerp sat smoothstep wrapPi wrap360 sign approach interp1
 *          quatFromEuler
 *
 * IMPORTA: res. Es la base de tot.
 */

export const DEG = Math.PI / 180, RAD = 180 / Math.PI;
export const KT = 0.514444;        // m/s per knot
export const FT = 0.3048;          // m per foot
export const NM = 1852;            // m per nautical mile
export const G0 = 9.80665;         // m/s^2
export const FPM = FT / 60;        // m/s per ft/min

export const clamp = (x, a, b) => x < a ? a : (x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sat = x => x < -1 ? -1 : (x > 1 ? 1 : x);
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const wrapPi = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
export const wrap360 = d => { d %= 360; return d < 0 ? d + 360 : d; };
export const sign = x => x < 0 ? -1 : 1;
/** move `cur` toward `tgt` by at most `maxStep` */
export const approach = (cur, tgt, maxStep) => cur < tgt ? Math.min(tgt, cur + maxStep) : Math.max(tgt, cur - maxStep);
/** piecewise-linear table lookup: xs ascending */
export function interp1(xs, ys, x) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = 1; while (xs[i] < x) i++;
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + (ys[i] - ys[i - 1]) * t;
}

/* ---- quaternion helpers. q=[w,x,y,z], rotates BODY (x fwd,y right,z down) -> NED world ---- */
export function quatFromEuler(phi, theta, psi) {
  const cf = Math.cos(phi / 2), sf = Math.sin(phi / 2), ct = Math.cos(theta / 2), st = Math.sin(theta / 2),
        cp = Math.cos(psi / 2), sp = Math.sin(psi / 2);
  return [cf * ct * cp + sf * st * sp, sf * ct * cp - cf * st * sp, cf * st * cp + sf * ct * sp, cf * ct * sp - sf * st * cp];
}
