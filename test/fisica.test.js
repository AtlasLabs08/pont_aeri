/* Proves directes de dues decisions de fisica (docs/DECISIONS.md, 29/09/2026)
 * que el harness, amb rangs per avio, no garanteix per si sol:
 *
 *   1. El Mi-9 (commuter), avio de l escola, es el turbohelix mes docil en un
 *      canvi gran de potencia: menys excés de capcineig i menys desviacio
 *      d altitud respecte de l equilibri final que el G-72 i el G-42, en els
 *      dos sentits (Harness.powerResponse).
 *   2. L amortidor d extensio del tren es dimensiona amb la massa real: el
 *      coeficient canvia amb la massa i la fraccio del critic (zeta) es la
 *      mateixa buit, carregat o a la massa tipica. I el pas de fisica el fa
 *      servir de debo: l alcada de l extensio despres d una sacsejada vertical
 *      a terra, a la massa minima i a la maxima d aterratge, es la mesurada amb
 *      aquest model (si el tren canvia legitimament, cal tornar-la a mesurar).
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRCRAFT, AIRCRAFT_ORDER, FlightModel, Harness, newCtl, FLAT_ENV, PHYS_DT } from '../src/core/index.js';

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

/* sacsejada vertical a terra: avio aturat amb el fre posat 5 s, i de cop 0,5 m/s cap amunt (el tren s esten). Torna
   l alcada maxima que puja el CG en 3 s (m). Es mesura el pas de fisica sencer, no reboundCoef */
function kickRise(cfg, mass, fuel) {
  const f = new FlightModel(cfg), ctl = newCtl(); ctl.parkBrake = true;
  f.reset({ onGround: true, hdg: 0, mass, fuel });
  for (let i = 0; i < 120 * 5; i++) f.step(PHYS_DT, ctl, FLAT_ENV);
  const h0 = f.h; f.vd = -0.5; let rise = 0;
  for (let i = 0; i < 120 * 3; i++) { f.step(PHYS_DT, ctl, FLAT_ENV); rise = Math.max(rise, f.h - h0); }
  return rise;
}

describe('amortidor d extensio: efecte al pas de fisica a massa minima i maxima', () => {
  // mm, mesurats amb aquest model. Amb l amortidor a la massa tipica (sense l escalat per la massa real), la massa
  // minima puja 0,13 mm menys al G-72 i al Mi-9 i 0,38 mm menys al T-4: la tolerancia (0,02 mm) ho detecta
  const REF = { tp: [10.9072, 11.0776], commuter: [10.8868, 11.0490], jumbo: [11.9003, 12.5116] };
  for (const [id, [lo, hi]] of Object.entries(REF)) {
    test(`${id}: alcada de l extensio despres d una sacsejada, buit i a la massa maxima d aterratge`, () => {
      const M = AIRCRAFT[id].mass;
      const rLo = kickRise(AIRCRAFT[id], M.empty + 0.1 * M.maxFuel, 0.1 * M.maxFuel) * 1000, rHi = kickRise(AIRCRAFT[id], M.mlw, M.typFuel) * 1000;
      assert.ok(Math.abs(rLo - lo) < 0.02, `massa minima: ${rLo.toFixed(4)} mm, esperat ${lo}`);
      assert.ok(Math.abs(rHi - hi) < 0.02, `massa maxima d aterratge: ${rHi.toFixed(4)} mm, esperat ${hi}`);
    });
  }
});
