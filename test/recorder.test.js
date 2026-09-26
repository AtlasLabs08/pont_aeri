/* Proves del FlightRecorder (tasca A3).
 *
 * Es volen maniobres reals amb el FlightModel, pilotades igual que les del
 * Harness, i es comprova que el FlightRecord que en surt es complet i
 * coherent. No es comprova la fisica (d aixo ja s encarreguen harness i
 * snapshot): es comprova que l enregistrador la resumeix be.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  AIRCRAFT, FlightModel, Autopilot, newCtl, trimAircraft, FLAT_ENV, PHYS_DT,
  KT, FT, FPM, DEG, clamp, approach, smoothstep, wrapPi,
  FlightRecorder, CRASH_CAUSES, RECORD_KEYS
} from '../src/core/index.js';

const CFG = AIRCRAFT.tp;   // el mes lleuger: les proves corren rapid
const META = { aircraftTypeId: 'tp', from: 'LEBL', to: 'LEPA', fuelPlannedKg: 900, paxOnBoard: 56, plannedArrivalMin: 100 };

/** Enlairament fins a 1500 ft AGL, com Harness.takeoff, mostrejant cada pas. */
function flyTakeoff(rec) {
  const f = new FlightModel(CFG), ap = new Autopilot(f), ctl = newCtl();
  const mass = CFG.test.toMass, fuel = Math.min(CFG.mass.maxFuel, mass - CFG.mass.empty - 1000);
  f.reset({ mass, fuel }); const v0 = f.vspeeds();
  const tr = trimAircraft(f, { cas: (v0.v2 + 10) * KT, alt: 300, gamma: 4 * DEG, flaps: CFG.flapTO, gearDown: true, mass, fuel });
  f.reset({ onGround: true, hdg: 0, mass, fuel, flaps: CFG.flapTO });
  ctl.flaps = CFG.flapTO; ctl.trim = clamp(tr.trim, -1, 1); ctl.throttle = 1;
  const v = f.vspeeds(); let rotating = false, th = 0; ap.thetaCmd = 0;
  const fuel0 = f.fuel;
  for (let i = 0; i < 120 * 150; i++) {
    const o = f.out;
    if (!rotating && o.ias >= v.vr) rotating = true;
    if (rotating) {
      if (f.mainWow) th = approach(th, CFG.test.rotPitch * DEG, 3 * DEG * PHYS_DT);
      else th = clamp(th + clamp(0.004 * (o.ias - (v.v2 + 15)), -2.5 * DEG, 2.5 * DEG) * PHYS_DT * 6, 5 * DEG, CFG.test.climbPitchMax * DEG);
      ctl.pitch = ap.pitchLoop(th, PHYS_DT);
    } else ctl.pitch = 0;
    ctl.roll = f.wow ? 0 : ap.rollLoop(0, PHYS_DT);
    ctl.yaw = clamp(-2 * wrapPi(o.psi) - 1.5 * f.r, -1, 1) * (f.wow ? 1 : 0);
    if (!f.wow && o.agl > 15) ctl.gearDown = false;
    f.step(PHYS_DT, ctl, FLAT_ENV); rec.sample(f, ctl, PHYS_DT);
    if (o.agl > 1500 * FT) break;
  }
  return { f, burnt: fuel0 - f.fuel };
}

/** Aproximacio final, arrodoniment i frenada, com Harness.landing. Retorna el
 *  report que muntaria Game.onTouchdown i la distancia de rodatge. */
function flyLanding(rec) {
  const f = new FlightModel(CFG), ap = new Autopilot(f), ctl = newCtl();
  const mass = CFG.test.ldgMass, fuel = CFG.mass.typFuel;
  f.reset({ mass, fuel }); const v = f.vspeeds();
  const tr = trimAircraft(f, { cas: v.vapp * KT, alt: 120 + CFG.gear.zStatic, gamma: -3 * DEG, flaps: CFG.flapLDG, gearDown: true, mass, fuel });
  ctl.flaps = CFG.flapLDG; ctl.trim = tr.trim; ctl.throttle = tr.throttle;
  ap.resetLoops(); ap.thetaInt = f.out.theta; ap.thetaCmd = f.out.theta; ap.iThr = tr.throttle; ap.lastIas = f.out.ias;
  const flareH = 8; let phase = 0, tTd = 0, thFlare = 0, dist0 = 0, report = null;
  for (let i = 0; i < 120 * 240; i++) {
    const o = f.out, agl = o.agl;
    if (phase === 0) {
      const vsApp = -Math.tan(3 * DEG) * o.gs * KT;
      if (agl > flareH) { ap.thetaCmd = approach(ap.thetaCmd, ap.vsLoop(vsApp, PHYS_DT), 3 * DEG * PHYS_DT); thFlare = ap.thetaCmd; }
      else {
        const k = smoothstep(0, 1, 1 - agl / flareH), tgt = Math.max(0.8, -vsApp * (agl / flareH));
        const corr = clamp(0.6 * DEG * (f.vd - tgt), -0.4 * DEG, 1.6 * DEG);
        ap.thetaCmd = approach(ap.thetaCmd, thFlare + 5.0 * DEG * k + corr, 2.5 * DEG * PHYS_DT);
      }
      ctl.pitch = ap.pitchLoop(ap.thetaCmd, PHYS_DT);
      ctl.throttle = agl < flareH * 0.8 ? approach(ctl.throttle, 0, 0.5 * PHYS_DT) : ap.thrLoop(v.vapp, PHYS_DT, ctl.throttle);
      ctl.roll = ap.rollLoop(0, PHYS_DT);
      if (f.mainWow) { phase = 1; tTd = f.time; dist0 = f.distGround; }
    } else {
      ctl.throttle = 0; ctl.roll = 0; ctl.pitch = ap.pitchLoop(-1 * DEG, PHYS_DT) * 0.5;
      ctl.yaw = clamp(-2 * wrapPi(o.psi) - 1.5 * f.r, -1, 1);
      if (f.time - tTd > 2.0) ctl.brake = 1;
    }
    f.step(PHYS_DT, ctl, FLAT_ENV); rec.sample(f, ctl, PHYS_DT);
    if (phase === 1 && !report && f.out.gs < 35) {
      // el que Game.onTouchdown + la branca report.shown deixen a Game.report
      const td = f.touchdown;
      report = { fpm: td.vs / FPM, g: td.nzPeak, gNow: f.touchdown.nzPeak, bounces: td.bounces, ias: td.ias, pitch: td.pitch, roll: td.roll,
        onRunway: true, rwy: 'TEST 36', tdzDist: 120, center: 0.4, crab: 0.2, rollout: f.distGround - dist0 };
      break;
    }
  }
  return { f, report };
}

const SCORE = { score: 88, comment: 'x', pts: { sink: 30, g: 14, zone: 18, center: 19, attitude: 7 } };

describe('FlightRecorder amb vol real', () => {
  const rec = new FlightRecorder(); rec.start(META);
  const to = flyTakeoff(rec);
  const afterTakeoff = rec.finish({ arrivalMin: 107 });
  const ld = flyLanding(rec);
  rec.touchdown(ld.report, SCORE); rec.rollout(ld.report.rollout);
  const r = rec.finish({ arrivalMin: 107 });

  test('te exactament les claus de l esquema', () => {
    assert.deepEqual(Object.keys(r), RECORD_KEYS);
  });

  test('tots els numeros son finits', () => {
    for (const k of RECORD_KEYS) if (typeof r[k] === 'number') assert.ok(isFinite(r[k]), `${k} = ${r[k]}`);
    for (const [k, v] of Object.entries(r.touchdown)) if (typeof v === 'number') assert.ok(isFinite(v), `touchdown.${k} = ${v}`);
  });

  test('el combustible integrat coincideix amb el que ha baixat el diposit', () => {
    const rel = Math.abs(afterTakeoff.fuelBurntKg - to.burnt) / to.burnt;
    assert.ok(to.burnt > 0, 'l enlairament hauria de cremar combustible');
    assert.ok(rel < 1e-9, `integrat ${afterTakeoff.fuelBurntKg} kg, diposit ${to.burnt} kg`);
  });

  test('temps de bloc, de vol i altitud son coherents', () => {
    assert.ok(r.blockSeconds > 0);
    assert.ok(r.airborneSeconds > 0 && r.airborneSeconds < r.blockSeconds, `vol ${r.airborneSeconds} s, bloc ${r.blockSeconds} s`);
    assert.ok(r.maxAltFt >= 1500, `altitud maxima ${r.maxAltFt} ft`);
  });

  test('g i alabeig dins de marges d un vol normal', () => {
    assert.ok(r.maxG >= 1 && r.maxG < 2, `maxG ${r.maxG}`);
    assert.ok(r.maxBankDeg >= 0 && r.maxBankDeg < 10, `alabeig ${r.maxBankDeg} graus`);
    assert.equal(r.abruptInputs, 0, 'un pilot automatic suau no fa sacsejades');
  });

  test('el contacte copia el report i la nota', () => {
    const t = r.touchdown;
    assert.ok(t.fpm > 0 && t.fpm < 600, `contacte a ${t.fpm} fpm`);
    assert.ok(t.g > 1 && t.g < 2.2, `contacte a ${t.g} g`);
    assert.equal(t.score, 88);
    assert.deepEqual(t.pts, SCORE.pts);
    assert.equal(t.rwy, 'TEST 36');
    assert.ok(r.rolloutMetres > 100, `rodatge ${r.rolloutMetres} m`);
  });

  test('dades del briefing i puntualitat', () => {
    assert.equal(r.aircraftTypeId, 'tp'); assert.equal(r.from, 'LEBL'); assert.equal(r.to, 'LEPA');
    assert.equal(r.paxOnBoard, 56); assert.equal(r.fuelPlannedKg, 900);
    assert.equal(r.arrivalDeltaMin, 7);
  });

  test('un vol net no te accident, cua tocada ni esdeveniments', () => {
    assert.equal(r.crashCause, null); assert.equal(r.tailStrike, false); assert.deepEqual(r.events, []);
    assert.equal(r.usedCruiseSkip, false); assert.equal(r.timeAccelMax, 1);
  });
});

describe('FlightRecorder: casos puntuals', () => {
  test('finish sense start falla amb un missatge clar', () => {
    assert.throws(() => new FlightRecorder().finish(), /sense start/);
  });

  test('start exigeix avio, origen i desti', () => {
    assert.throws(() => new FlightRecorder().start({ from: 'LEBL', to: 'LEPA' }), /aircraftTypeId/);
  });

  test('sense aterratge, touchdown es null', () => {
    const rec = new FlightRecorder(); rec.start(META);
    assert.equal(rec.finish().touchdown, null);
  });

  test('causes d accident valides es guarden; les desconegudes queden com fuselage', () => {
    for (const c of CRASH_CAUSES) { const rec = new FlightRecorder(); rec.start(META); rec.crash(c); assert.equal(rec.finish().crashCause, c); }
    const rec = new FlightRecorder(); rec.start(META); rec.crash('meteorit'); assert.equal(rec.finish().crashCause, 'fuselage');
  });

  test('acceleracio maxima, salt de creuer i cua tocada', () => {
    const rec = new FlightRecorder(); rec.start(META);
    rec.setTimeAccel(16); rec.setTimeAccel(4); rec.cruiseSkip(); rec.tailStrike();
    const r = rec.finish();
    assert.equal(r.timeAccelMax, 16); assert.equal(r.usedCruiseSkip, true); assert.equal(r.tailStrike, true);
  });

  test('skippedCruiseFuelKg: 0 per defecte', () => {
    const rec = new FlightRecorder(); rec.start(META);
    assert.equal(rec.finish().skippedCruiseFuelKg, 0);
  });

  test('cruiseSkip(fuelKg) acumula el combustible saltat', () => {
    const rec = new FlightRecorder(); rec.start(META);
    rec.cruiseSkip(1200); rec.cruiseSkip(300.5);
    const r = rec.finish();
    assert.equal(r.skippedCruiseFuelKg, 1500.5); assert.equal(r.usedCruiseSkip, true);
  });

  test('cruiseSkip() sense argument no canvia res mes que usedCruiseSkip', () => {
    const a = new FlightRecorder(); a.start(META);
    const b = new FlightRecorder(); b.start(META); b.cruiseSkip();
    const ra = a.finish(), rb = b.finish();
    assert.equal(rb.usedCruiseSkip, true); assert.equal(rb.skippedCruiseFuelKg, 0);
    assert.deepEqual({ ...rb, usedCruiseSkip: false }, ra);
  });

  /** cruiseSkip(100) valid i despres cruiseSkip(bad): el segon no suma ni llanca */
  const skipBad = bad => {
    const rec = new FlightRecorder(); rec.start(META); rec.cruiseSkip(100);
    assert.doesNotThrow(() => rec.cruiseSkip(bad));
    const r = rec.finish();
    assert.equal(r.skippedCruiseFuelKg, 100); assert.equal(r.usedCruiseSkip, true);
  };
  test("cruiseSkip('500'): una cadena s ignora", () => skipBad('500'));
  test('cruiseSkip(NaN) s ignora', () => skipBad(NaN));
  test('cruiseSkip(-10) s ignora', () => skipBad(-10));
  test('cruiseSkip(Infinity) s ignora', () => skipBad(Infinity));

  test('start() torna skippedCruiseFuelKg a 0', () => {
    const rec = new FlightRecorder(); rec.start(META); rec.cruiseSkip(500);
    rec.start(META);
    assert.equal(rec.finish().skippedCruiseFuelKg, 0);
  });

  test('fora de pista, les distancies respecte de la pista son null', () => {
    const rec = new FlightRecorder(); rec.start(META);
    rec.touchdown({ fpm: 300, g: 1.4, bounces: 0, ias: 110, pitch: 3, roll: 1, onRunway: false }, SCORE);
    const t = rec.finish().touchdown;
    assert.equal(t.onRunway, false); assert.equal(t.rwy, null); assert.equal(t.tdzDist, null); assert.equal(t.center, null);
  });

  test('una sacsejada al comandament en vol compta un cop', () => {
    const f = new FlightModel(CFG), ctl = newCtl(), rec = new FlightRecorder(); rec.start(META);
    const mass = CFG.mass.typical, fuel = CFG.mass.typFuel; f.reset({ mass, fuel }); const v = f.vspeeds();
    const tr = trimAircraft(f, { cas: (v.vref + 30) * KT, alt: 1500, gamma: 0, flaps: 0, gearDown: false, mass, fuel });
    ctl.trim = tr.trim; ctl.throttle = tr.throttle;
    for (let i = 0; i < 60; i++) { f.step(PHYS_DT, ctl, FLAT_ENV); rec.sample(f, ctl, PHYS_DT); }
    assert.equal(rec.finish().abruptInputs, 0, 'vol estabilitzat sense tocar res');
    ctl.pitch = 0.6;                                  // de 0 a 0,6 en un sol pas
    for (let i = 0; i < 30; i++) { f.step(PHYS_DT, ctl, FLAT_ENV); rec.sample(f, ctl, PHYS_DT); }
    assert.equal(rec.finish().abruptInputs, 1);
  });

  test('el record es una copia: modificar-lo no altera l enregistrador', () => {
    const rec = new FlightRecorder(); rec.start(META); rec.event('goAround');
    const a = rec.finish(); a.events.push({ type: 'x', atSecond: 0 });
    assert.equal(rec.finish().events.length, 1);
  });
});
