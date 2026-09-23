/* Atmosfera ISA i conversions de dades d'aire.
 * ORIGEN: linies 432-459 de l'original (SECTION 3).
 *
 * EXPORTA: ISA isa casFromMach tasFromCas
 *          (_atm es intern a proposit: es un objecte compartit que isa()
 *           reescriu a cada crida per no assignar memoria al bucle de fisica.
 *           Exportar-lo convidaria a fer-ne mal us des de fora.)
 *
 * IMPORTA: clamp i G0 de ./constants.js
 */

import { clamp, G0 } from './constants.js';

export const ISA = { T0: 288.15, p0: 101325, rho0: 1.225, a0: 340.294, R: 287.053, L: 0.0065 };
const _atm = { T: 288.15, p: 101325, rho: 1.225, a: 340.294 };
/** International Standard Atmosphere up to ~20 km. Writes into (and returns) a shared object. */
export function isa(h, out) {
  out = out || _atm;
  h = clamp(h, -500, 20000);
  let T, p;
  if (h < 11000) { T = ISA.T0 - ISA.L * h; p = ISA.p0 * Math.pow(T / ISA.T0, 5.25588); }
  else { T = 216.65; p = 22632.06 * Math.exp(-G0 * (h - 11000) / (ISA.R * T)); }
  out.T = T; out.p = p; out.rho = p / (ISA.R * T); out.a = Math.sqrt(1.4 * ISA.R * T);
  return out;
}
/** calibrated airspeed (m/s) from Mach number and static pressure (compressible pitot equation) */
export function casFromMach(M, p) {
  const qc = p * (Math.pow(1 + 0.2 * M * M, 3.5) - 1);
  return ISA.a0 * Math.sqrt(5 * (Math.pow(qc / ISA.p0 + 1, 2 / 7) - 1));
}
/** true airspeed (m/s) from calibrated airspeed (m/s) at altitude h (m) */
export function tasFromCas(cas, h) {
  const at = isa(h, {});
  const qc = ISA.p0 * (Math.pow(1 + 0.2 * (cas / ISA.a0) * (cas / ISA.a0), 3.5) - 1);
  const M = Math.sqrt(5 * (Math.pow(qc / at.p + 1, 2 / 7) - 1));
  return M * at.a;
}
