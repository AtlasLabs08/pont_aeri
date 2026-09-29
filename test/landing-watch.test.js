/* LandingWatch (core/landing-watch.js) amb el FlightModel real i una replica minima
 * de Game.step / Game.onTouchdown (index.html): l informe es crea amb el primer
 * 'touchdown' (o el que torna el vigilant), els rebots no en creen cap de nou i es
 * mostra a terra per sota de 35 kt.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRCRAFT, FlightModel, LandingWatch, trimAircraft, newCtl, tasFromCas, FLAT_ENV, PHYS_DT, KT, FPM } from '../src/core/index.js';

/** avio trimat a Vref a 400 fpm, rodes a 30 cm de la pista (sense arrodonir), i una replica de Game que el porta fins a aturar-se */
function fly(id, { dropEvent = false, zeroAirTime = false, failFirstRegister = false, crash = false } = {}) {
  const cfg = AIRCRAFT[id], f = new FlightModel(cfg), ctl = newCtl(), mass = cfg.test.ldgMass, fuel = cfg.mass.typFuel;
  f.reset({ mass, fuel }); const v = f.vspeeds(), cas = v.vref * KT, gam = -Math.asin(400 * FPM / tasFromCas(cas, 0));
  const tr = trimAircraft(f, { cas, alt: 50, gamma: gam, flaps: cfg.flapLDG, gearDown: true, mass, fuel });
  ctl.flaps = cfg.flapLDG; ctl.trim = tr.trim; ctl.throttle = tr.throttle;
  f.h = cfg.gear.zStatic + cfg.gear.staticDefl + 0.3 + Math.sin(f.out.theta) * Math.abs(f.legs[1].x);
  const w = new LandingWatch(), G = { report: null, crash: crash ? 'test' : null, modelEvents: 0, watchCalls: [], shown: null };
  let registerFails = failFirstRegister;
  const onTouchdown = () => {
    if (G.report && !G.report.shown) { G.report.bounces++; return; }
    if (registerFails) { registerFails = false; throw new Error('onTouchdown simulat que falla'); }
    G.report = { fpm: f.touchdown.vs / FPM, bounces: 0, shown: false }; w.landed();
  };
  for (let i = 0; i < 120 * 90; i++) {
    if (f.mainWow) { ctl.throttle = 0; ctl.brake = 1; }
    if (zeroAirTime && i > 0 && !f.wow) f.airTime = 0;                   // el cas real: ha volat (pas 0), pero airTime ja es 0 quan toquen les principals
    f.step(PHYS_DT, ctl, FLAT_ENV);
    for (const ev of f.events) {
      if (ev !== 'touchdown') continue;
      G.modelEvents++;
      if (dropEvent) continue;                                          // simula que l esdeveniment no arriba a Game
      try { onTouchdown(); } catch { /* Game ho escriu a la consola */ }
    }
    f.events.length = 0;
    const td = w.step(f, { reportOpen: !!(G.report && !G.report.shown), crashed: !!G.crash });
    if (td) { G.watchCalls.push({ gs: f.out.gs, fpm: td.vs / FPM }); f.touchdown = td; try { onTouchdown(); } catch { /* idem */ } }
    if (G.report && !G.report.shown && f.wow && f.out.gs < 35) { G.report.shown = true; G.shown = f.out.gs; }
    if (f.wow && f.out.gs < 5) break;
  }
  return G;
}

describe('LandingWatch', () => {
  for (const id of ['commuter', 'tp', 'nb']) {
    test(`${id}: un aterratge normal no passa mai pel vigilant i l informe surt igual`, () => {
      const G = fly(id);
      assert.equal(G.modelEvents, 1);
      assert.deepEqual(G.watchCalls, []);
      assert.ok(G.report && G.report.shown, 'l informe no ha sortit');
    });
    test(`${id}: si l esdeveniment touchdown no arriba, l aterratge es registra al contacte de les principals`, () => {
      const G = fly(id, { dropEvent: true }), ref = fly(id);
      assert.equal(G.watchCalls.length, 1);
      assert.ok(G.watchCalls[0].gs > 60, 'no s ha registrat al contacte sino despres');
      assert.ok(Math.abs(G.report.fpm - ref.report.fpm) < 1e-9, `fpm ${G.report.fpm.toFixed(1)}, el model en dona ${ref.report.fpm.toFixed(1)}`);
      assert.ok(G.report.shown, 'l informe no ha sortit');
    });
  }
  test('commuter: amb airTime a 0 en tocar (morro primer), el model no emet res i el vigilant registra l aterratge', () => {
    const G = fly('commuter', { zeroAirTime: true });
    assert.equal(G.modelEvents, 0);
    assert.equal(G.watchCalls.length, 1);
    assert.ok(G.report && G.report.shown);
  });
  test('commuter: xarxa de seguretat, si el registre del contacte falla, l aterratge es tanca per sota de 35 kt', () => {
    const G = fly('commuter', { dropEvent: true, failFirstRegister: true }), ref = fly('commuter');
    assert.equal(G.watchCalls.length, 2);
    assert.ok(G.watchCalls[1].gs < 35);
    assert.ok(Math.abs(G.watchCalls[1].fpm - ref.report.fpm) < 1e-9, 'la xarxa no fa servir les dades del primer contacte');
    assert.ok(G.report && G.report.shown);
  });
  test('commuter: amb un accident declarat, el vigilant no fa res', () => {
    const G = fly('commuter', { dropEvent: true, crash: true });
    assert.deepEqual(G.watchCalls, []);
    assert.equal(G.report, null);
  });
  test('a terra sense haver volat (rodatge a menys de 35 kt), el vigilant no fa res', () => {
    const cfg = AIRCRAFT.commuter, f = new FlightModel(cfg), ctl = newCtl(), w = new LandingWatch();
    f.reset({ onGround: true, hdg: 0 }); ctl.throttle = 0.2;
    for (let i = 0; i < 120 * 30; i++) { f.step(PHYS_DT, ctl, FLAT_ENV); assert.equal(w.step(f, { reportOpen: false, crashed: false }), null); }
  });
});
