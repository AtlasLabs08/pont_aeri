/* LandingWatch (core/landing-watch.js) amb el FlightModel real i una replica minima
 * de Game.step / Game.onTouchdown (index.html): l informe es crea amb el primer
 * 'touchdown' (o el que torna el vigilant), els rebots no en creen cap de nou i es
 * mostra a terra per sota de 35 kt.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRCRAFT, FlightModel, FlightRecorder, LandingWatch, trimAircraft, newCtl, tasFromCas, FLAT_ENV, PHYS_DT, KT, FPM } from '../src/core/index.js';

/** avio trimat a Vref a fpm (400 per defecte), rodes a 30 cm de la pista (sense arrodonir), i una replica de Game que el
    porta fins a aturar-se. Com Game.step, el vol continua despres de mostrar l informe: en mostrar-lo compta Best.submit i
    flight.landings i en passa les dades a un FlightRecorder real (Recorder.touchdown). pullAfter: s d estirar a fons
    despres del primer contacte (provoca un rebot llarg) */
function fly(id, { fpm = 400, pullAfter = 0, dropEvent = false, zeroAirTime = false, failFirstRegister = false, crash = false } = {}) {
  const cfg = AIRCRAFT[id], f = new FlightModel(cfg), ctl = newCtl(), mass = cfg.test.ldgMass, fuel = cfg.mass.typFuel;
  f.reset({ mass, fuel }); const v = f.vspeeds(), cas = v.vref * KT, gam = -Math.asin(fpm * FPM / tasFromCas(cas, 0));
  const tr = trimAircraft(f, { cas, alt: 50, gamma: gam, flaps: cfg.flapLDG, gearDown: true, mass, fuel });
  ctl.flaps = cfg.flapLDG; ctl.trim = tr.trim; ctl.throttle = tr.throttle;
  f.h = cfg.gear.zStatic + cfg.gear.staticDefl + 0.3 + Math.sin(f.out.theta) * Math.abs(f.legs[1].x);
  const w = new LandingWatch(), G = { report: null, crash: crash ? 'test' : null, modelEvents: 0, watchCalls: [], shown: null,
    reports: 0, bestSubmits: 0, landings: 0, firstFpm: null, maxAirAfterTd: 0 };   // firstFpm: el del model en el primer contacte
  const rec = new FlightRecorder(); rec.start({ aircraftTypeId: id, from: 'TEST', to: 'TEST' });
  let tFirst = -1, tAir = -1;
  let registerFails = failFirstRegister;
  const onTouchdown = () => {
    if (G.report && !G.report.shown) { G.report.bounces++; return; }
    if (registerFails) { registerFails = false; throw new Error('onTouchdown simulat que falla'); }
    G.report = { fpm: f.touchdown.vs / FPM, g: f.touchdown.nzPeak, bounces: 0, shown: false, onRunway: false, ias: f.touchdown.ias, pitch: f.touchdown.pitch, roll: f.touchdown.roll }; G.reports++; w.landed();
  };
  for (let i = 0; i < 120 * 90; i++) {
    if (f.mainWow && tFirst < 0) tFirst = f.time;
    const pulling = tFirst >= 0 && f.time - tFirst < pullAfter;
    ctl.pitch = pulling ? 1 : 0;
    if (tFirst >= 0) { ctl.throttle = 0; ctl.brake = pulling ? 0 : 1; }
    if (tFirst >= 0 && !f.wow) { if (tAir < 0) tAir = f.time; G.maxAirAfterTd = Math.max(G.maxAirAfterTd, f.time - tAir); } else tAir = -1;
    if (zeroAirTime && i > 0 && !f.wow) f.airTime = 0;                   // el cas real: ha volat (pas 0), pero airTime ja es 0 quan toquen les principals
    f.step(PHYS_DT, ctl, FLAT_ENV);
    for (const ev of f.events) {
      if (ev !== 'touchdown') continue;
      G.modelEvents++;
      if (G.firstFpm === null) G.firstFpm = f.touchdown.vs / FPM;
      if (dropEvent) continue;                                          // simula que l esdeveniment no arriba a Game
      try { onTouchdown(); } catch { /* Game ho escriu a la consola */ }
    }
    f.events.length = 0;
    const td = w.step(f, { reportOpen: !!(G.report && !G.report.shown), crashed: !!G.crash });
    if (td) { G.watchCalls.push({ gs: f.out.gs, fpm: td.vs / FPM }); f.touchdown = td; try { onTouchdown(); } catch { /* idem */ } }
    if (G.report && !G.report.shown && f.wow && f.out.gs < 35) {
      G.report.shown = true; G.shown = f.out.gs; G.landings++; G.bestSubmits++;
      rec.touchdown(G.report, { score: 0, pts: { sink: 0, g: 0, zone: 0, center: 0, attitude: 0 } });
    }
    if (f.wow && f.out.gs < 5) break;
  }
  G.record = rec.finish({});
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
  test('tp: un rebot llarg (mes de 2 s a l aire) amb l informe obert no crea un segon informe', () => {
    const G = fly('tp', { fpm: 1200, pullAfter: 0.6 });
    assert.ok(G.maxAirAfterTd > 2, `el rebot ha durat ${G.maxAirAfterTd.toFixed(2)} s a l aire: no prova res`);
    assert.equal(G.reports, 1, 'informes creats');
    assert.equal(G.bestSubmits, 1, 'Best.submit');
    assert.equal(G.landings, 1, 'flight.landings++');
    assert.ok(G.report.bounces >= 1, 'el rebot no s ha comptat');
    assert.equal(G.record.touchdown.fpm, G.firstFpm, `Recorder: ${G.record.touchdown.fpm.toFixed(0)} fpm, el primer contacte ${G.firstFpm.toFixed(0)}`);
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
