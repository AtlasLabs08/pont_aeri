/* Proves directes de dues decisions de fisica (docs/DECISIONS.md, 29/09/2026)
 * que el harness, amb rangs per avio, no garanteix per si sol:
 *
 *   1. El Mi-9 (commuter), avio de l escola, es el turbohelix mes docil en un
 *      canvi gran de potencia: menys excés de capcineig i menys desviacio
 *      d altitud respecte de l equilibri final que el G-72 i el G-42, en els
 *      dos sentits (Harness.powerResponse).
 *   2. L amortidor d extensio del tren es dimensiona amb la massa real: el
 *      coeficient canvia amb la massa i la fraccio del critic (zeta) es la
 *      mateixa buit, carregat o a la massa tipica.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRCRAFT, AIRCRAFT_ORDER, FlightModel, Harness } from '../src/core/index.js';

describe('Mi-9: el turbohelix mes docil en un canvi gran de potencia', () => {
  const R = {};
  for (const id of ['commuter', 'tp', 'tpShort']) R[id] = { up: Harness.powerResponse(AIRCRAFT[id], 'up'), down: Harness.powerResponse(AIRCRAFT[id], 'down') };
  for (const dir of ['up', 'down']) for (const [key, name] of [['pitchDev', 'excés de capcineig'], ['altDev', 'desviacio d altitud']]) {
    for (const other of ['tp', 'tpShort']) {
      test(`${dir === 'up' ? 'ralenti -> maxima' : 'maxima -> ralenti'}: ${name} del Mi-9 per sota del ${AIRCRAFT[other].name}`, () => {
        const mi9 = R.commuter[dir][key], ref = R[other][dir][key];
        assert.ok(mi9 < ref, `Mi-9 ${mi9.toFixed(2)} >= ${AIRCRAFT[other].name} ${ref.toFixed(2)}`);
      });
    }
  }
});

/* zeta efectiva d una pota a la massa actual del model: c / (2 sqrt(k mApp)), amb la mateixa rigidesa estatica i
   massa aparent que _buildGear (la massa aparent escala amb la massa: Iyy es proporcional a la massa) */
function zeta(f, leg) {
  const cfg = f.cfg, g = cfg.gear, m = f.mass;
  const load = leg.F0 / 0.08, kAir = 1.3 * load / (leg.dg - leg.soS), k = leg.kt * kAir / (leg.kt + kAir);
  const xm = g.mains.reduce((s, l) => s + l.x, 0) / g.mains.length, xn = g.nose.x, L2 = (xn - xm) * (xn - xm);
  const Iyy = cfg.inertia.Iyy * m / cfg.inertia.refMass;
  const mApp = leg.nose ? (Iyy + m * xm * xm) / L2 : (Iyy + m * xn * xn) / L2 / g.mains.length;
  return f.reboundCoef(leg) / (2 * Math.sqrt(k * mApp));
}

describe('amortidor d extensio del tren amb la massa real', () => {
  for (const id of AIRCRAFT_ORDER) {
    test(`${id}: el coeficient canvia amb la massa i la zeta es la mateixa buit, tipic i a la massa maxima d aterratge`, () => {
      const M = AIRCRAFT[id].mass, f = new FlightModel(AIRCRAFT[id]);
      const at = (mass, fuel) => { f.reset({ onGround: true, mass, fuel }); return f.legs.map(leg => ({ c: f.reboundCoef(leg), z: zeta(f, leg) })); };
      const lo = at(M.empty + 0.1 * M.maxFuel, 0.1 * M.maxFuel), typ = at(M.typical, M.typFuel), hi = at(M.mlw, M.typFuel);
      lo.forEach((l, i) => {
        assert.ok(hi[i].c > l.c * 1.05, `pota ${i}: el coeficient no creix amb la massa (${l.c.toFixed(0)} -> ${hi[i].c.toFixed(0)} N s/m)`);
        for (const [name, v] of [['buit', l.z], ['massa maxima d aterratge', hi[i].z]]) {
          assert.ok(Math.abs(v - typ[i].z) < 1e-9, `pota ${i}: zeta ${name} ${v.toFixed(4)}, a la massa tipica ${typ[i].z.toFixed(4)}`);
        }
      });
    });
  }
});
