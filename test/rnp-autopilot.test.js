/* H12 (docs/DECISIONS.md, 2026-10-01): una aproximacio RNP te la mateixa
 * interficie que l ILS (world/ils.js, ILS.nav), i el pilot automatic
 * (core/autopilot.js, sense canvis) l acobla igual. Mateix escenari que
 * Harness.approach (intercepcio a 30 graus des de la dreta, captura del
 * localitzador i de la senda des de sota), pero sobre caps reals: dues RNP
 * (LESU 21, LELL 13) i un ILS (LERS 25). Terreny pla a l elevacio de
 * l aeroport: es prova l acoblament, no el relleu.
 *
 * Senda per cap (TA-9, docs/DECISIONS.md, 2026-10-02): LESU 03 te una senda
 * de 3,6 graus. El pilot automatic llegeix ILS.GS de world/ils.js, que nav()
 * deixa a l angle del cap: el segueix des de la captura fins a 200 ft.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRCRAFT, FlightModel, Autopilot, trimAircraft, newCtl, KT, FT, NM, DEG, PHYS_DT, SURF } from '../src/core/index.js';
import { AIRPORTS, ILS, glideAngle, setRunwayDifficulty } from '../src/world/index.js';

setRunwayDifficulty('normal');

function coupled(id, endId) {
  const A = AIRPORTS[id], en = A.allEnds.find(e => e.id === endId), cfg = AIRCRAFT.nb;
  const f = new FlightModel(cfg), ap = new Autopilot(f), ctl = newCtl(); f.reset({ mass: cfg.test.ldgMass, fuel: cfg.mass.typFuel }); const v = f.vspeeds();
  const d = 12 * NM, right = [en.dir[1], -en.dir[0]], p = A.toWorld(en.thr[0] - en.dir[0] * d + right[0] * 2500, en.thr[1] - en.dir[1] * d + right[1] * 2500);
  const hdg = (en.hdg - 30 + 360) % 360, altFt = Math.round((A.elev / FT + 2500) / 100) * 100;
  const tr = trimAircraft(f, { cas: v.vapp * KT, alt: altFt * FT, gamma: 0, flaps: cfg.flapLDG, gearDown: true, hdg, n: p[1], e: p[0], mass: cfg.test.ldgMass, fuel: cfg.mass.typFuel });
  ctl.flaps = cfg.flapLDG; ctl.gearDown = true; ctl.trim = tr.trim; ctl.throttle = tr.throttle;
  ap.engage(); ap.selAlt = altFt; ap.vert = 'ALT'; ap.selHdg = Math.round(hdg); ap.setAthr(true); ap.selSpd = Math.round(v.vapp); ap.toggleApp();
  const env = { windN: 0, windE: 0, groundHeight: () => A.elev, surface: () => SURF.PAVED }, res = { kind: en.kind, ident: null, loc: false, gs: false, lat: NaN, vert: NaN, maxVert: 0, apGs: NaN };
  for (let i = 0; i < 120 * 900; i++) {
    const nav = ILS.nav(A, en, f); res.ident = nav.ident; ap.nav = nav; ap.update(PHYS_DT, ctl); f.step(PHYS_DT, ctl, env);
    for (const ev of ap.events) { if (ev === 'LOC') res.loc = true; if (ev === 'G/S') res.gs = true; } ap.events.length = 0;
    res.apGs = ILS.GS;
    if (ap.vert === 'GS' && ap.gsT > 20) res.maxVert = Math.max(res.maxVert, Math.abs(nav.hW - nav.hPath) / FT);
    if (isNaN(res.lat) && f.out.aglFt < 200) { res.lat = Math.abs(nav.t); res.vert = Math.abs(nav.hW - nav.hPath) / FT; break; }
  }
  return res;
}

describe('H12: el pilot automatic acobla una RNP com un ILS (core/ sense canvis)', () => {
  for (const [id, endId, kind] of [['LESU', '21', 'RNP'], ['LELL', '13', 'RNP'], ['LERS', '25', 'ILS'], ['LESU', '03', 'RNP']]) {
    test(`${id} ${endId} (${kind}): captura LOC i G/S, i a 200 ft es dins dels rangs del harness`, () => {
      const r = coupled(id, endId);
      assert.equal(r.kind, kind); assert.equal(r.ident, kind + ' ' + endId);
      assert.ok(r.loc && r.gs, `capturat LOC ${r.loc}, G/S ${r.gs}`);
      assert.ok(r.lat <= 8, `eix a 200 ft: ${r.lat} m`);
      assert.ok(r.vert <= 20, `senda a 200 ft: ${r.vert} ft`);
    });
  }
  test('LESU 03: senda de 3,6 graus; el pilot automatic hi llegeix l angle del cap i no se n separa mes de 40 ft', () => {
    const en = AIRPORTS.LESU.allEnds.find(e => e.id === '03');
    assert.ok(Math.abs(glideAngle(en) - 3.6 * DEG) < 1e-12);
    const r = coupled('LESU', '03');
    assert.ok(Math.abs(r.apGs - glideAngle(en)) < 1e-12, 'ILS.GS = angle del cap');
    assert.ok(r.maxVert <= 40, `desviacio maxima de la senda: ${r.maxVert.toFixed(1)} ft`);
  });
  test('LEBL i LEPA: tots els caps a 3 graus', () => {
    for (const id of ['LEBL', 'LEPA']) for (const en of AIRPORTS[id].allEnds) assert.equal(glideAngle(en), 3 * DEG, `${id} ${en.id}`);
  });
});
