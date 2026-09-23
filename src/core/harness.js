/* Banc de proves headless: vola maniobres guionades amb el model real i
 * compara els resultats amb rangs publicats per categoria.
 * ORIGEN: linies 1058-1271 de l'original (SECTION 7).
 *
 * EXPORTA: newCtl Harness
 *
 * INTERFICIE (no la canviis, els tests en depenen):
 *   Harness.run(id)  -> { id, name, rows, pass, detail }
 *                       rows[] = { name, val, range, unit, pass }
 *   Harness.runAll() -> array del mateix, un per avio
 *
 * Viu a core/ i no a test/ perque el panell de depuracio del joc tambe
 * l importa.
 */

import { DEG, RAD, FT, KT, NM, FPM, clamp, smoothstep, wrapPi, approach } from './constants.js';
import { tasFromCas } from './atmosphere.js';
import { AIRCRAFT, AIRCRAFT_ORDER } from './aircraft-data.js';
import { PHYS_DT, SURF, FLAT_ENV, FlightModel } from './flight-model.js';
import { FLAT_ENV_AIR, trimAircraft } from './trim.js';
import { Autopilot } from './autopilot.js';
import { ILS } from '../world/ils.js';   // vegeu la nota d arquitectura a world/ils.js
export function newCtl() { return { pitch: 0, roll: 0, yaw: 0, throttle: 0, flaps: 0, gearDown: true, brake: 0, parkBrake: false, spoiler: 0, reverse: false, trim: 0 }; }

export const Harness = {
  /** take-off: full thrust from standstill, rotate at VR, climb at V2+15 */
  takeoff(cfg, mass) {
    const f = new FlightModel(cfg), ap = new Autopilot(f), ctl = newCtl();
    const fuel = Math.min(cfg.mass.maxFuel, mass - cfg.mass.empty - 1000);
    // take-off trim: trimmed for V2+10 in the take-off configuration
    f.reset({ mass, fuel }); const vsp0 = f.vspeeds();
    const tr = trimAircraft(f, { cas: (vsp0.v2 + 10) * KT, alt: 300, gamma: 4 * DEG, flaps: cfg.flapTO, gearDown: true, mass, fuel });
    f.reset({ onGround: true, hdg: 0, mass, fuel, flaps: cfg.flapTO });
    ctl.flaps = cfg.flapTO; ctl.trim = clamp(tr.trim, -1, 1); ctl.throttle = 1;
    const v = f.vspeeds(), res = { mass, vr: v.vr, v2: v.v2 };
    let rotating = false, thetaCmd = 0, t35 = false, hLo = null, tLo = 0, hHi = null, tHi = 0;
    ap.thetaCmd = 0;
    for (let i = 0; i < 120 * 150; i++) {
      const o = f.out;
      if (!rotating && o.ias >= v.vr) { rotating = true; res.rotDist = f.distGround; }
      if (rotating) {
        if (f.mainWow) thetaCmd = approach(thetaCmd, cfg.test.rotPitch * DEG, 3 * DEG * PHYS_DT);
        else thetaCmd = clamp(thetaCmd + clamp(0.004 * (o.ias - (v.v2 + 15)), -2.5 * DEG, 2.5 * DEG) * PHYS_DT * 6, 5 * DEG, cfg.test.climbPitchMax * DEG);
        ctl.pitch = ap.pitchLoop(thetaCmd, PHYS_DT);
      } else ctl.pitch = 0;
      ctl.roll = f.wow ? 0 : ap.rollLoop(0, PHYS_DT);
      ctl.yaw = clamp(-2 * wrapPi(o.psi) - 1.5 * f.r, -1, 1) * (f.wow ? 1 : 0);
      if (!f.mainWow && res.liftoffDist === undefined && rotating) { res.liftoffDist = f.distGround; res.vlof = o.ias; res.liftoffPitch = o.pitch; }
      if (!f.wow && o.agl > 15) ctl.gearDown = false;
      if (!t35 && o.agl > 35 * FT) { t35 = true; res.dist35 = f.n; res.v35 = o.ias; }
      if (hLo === null && o.agl > 400 * FT) { hLo = f.h; tLo = f.time; }
      if (hHi === null && o.agl > 1500 * FT) { hHi = f.h; tHi = f.time; break; }
      res.maxPitch = Math.max(res.maxPitch || 0, o.pitch);
      f.step(PHYS_DT, ctl, FLAT_ENV);
      if (f.events.some(e => e.startsWith('strike'))) { res.strike = f.events.find(e => e.startsWith('strike')); f.events.length = 0; }
    }
    res.climbFpm = hHi !== null ? (hHi - hLo) / (tHi - tLo) / FPM : 0;
    res.climbIas = f.out.ias;
    return res;
  },

  /** 1-g stall: level deceleration at about 1 kt/s until alpha passes CLmax */
  stall(cfg, mass, flapIdx, gearDown) {
    const f = new FlightModel(cfg), ap = new Autopilot(f), ctl = newCtl();
    const fuel = cfg.mass.typFuel;
    f.reset({ mass, fuel }); const vs = f.stallSpeed(flapIdx);
    const tr = trimAircraft(f, { cas: vs * 1.30, alt: 1500, gamma: 0, flaps: flapIdx, gearDown, mass, fuel });
    ctl.flaps = flapIdx; ctl.gearDown = gearDown; ctl.trim = tr.trim; ctl.throttle = tr.throttle;
    ap.resetLoops(); ap.thetaInt = f.out.theta; ap.thetaCmd = f.out.theta;
    let spdTgt = f.out.ias; const res = { mass, nominal: vs / KT, minIas: 999 };
    for (let i = 0; i < 120 * 200; i++) {
      const o = f.out;
      spdTgt -= 1.0 * PHYS_DT;
      ctl.throttle = Math.min(ap.thrLoop(spdTgt, PHYS_DT, ctl.throttle), 0.5);
      const thetaCmd = ap.vsLoop(clamp(0.1 * (1500 - f.h), -3, 3), PHYS_DT);
      ap.thetaCmd = approach(ap.thetaCmd, thetaCmd, 2 * DEG * PHYS_DT);
      ctl.pitch = ap.pitchLoop(ap.thetaCmd, PHYS_DT);
      ctl.roll = ap.rollLoop(0, PHYS_DT);
      f.step(PHYS_DT, ctl, FLAT_ENV_AIR);
      if (o.stallWarn && res.warnIas === undefined) res.warnIas = o.ias;
      if (o.alpha > o.alphaStall) { res.vs = o.ias; res.alpha = o.alpha; res.nz = o.nz; res.clmax = o.CL; break; }
    }
    // keep pulling for 6 more seconds to record the break (nose drop / wing drop)
    let minPitch = 99, maxRoll = 0, minNz = 9;
    for (let i = 0; i < 120 * 6; i++) { ctl.pitch = 0.8; ctl.roll = 0; f.step(PHYS_DT, ctl, FLAT_ENV_AIR); minPitch = Math.min(minPitch, f.out.pitch); maxRoll = Math.max(maxRoll, Math.abs(f.out.roll)); minNz = Math.min(minNz, f.out.nz); }
    res.breakPitch = minPitch; res.wingDrop = maxRoll; res.minNz = minNz;
    return res;
  },

  /** stabilised 3 degree approach, flare, touchdown, maximum braking + reverse */
  landing(cfg, mass) {
    const f = new FlightModel(cfg), ap = new Autopilot(f), ctl = newCtl();
    const fuel = cfg.mass.typFuel;
    f.reset({ mass, fuel }); const v = f.vspeeds();
    const h0 = 120 + cfg.gear.zStatic;
    const tr = trimAircraft(f, { cas: v.vapp * KT, alt: h0, gamma: -3 * DEG, flaps: cfg.flapLDG, gearDown: true, mass, fuel });
    const res = { mass, vapp: v.vapp, vref: v.vref, appThrottle: tr.throttle, appPitch: f.out.pitch, appAlpha: tr.alpha * RAD, trimOk: tr.ok };
    res.appPower = cfg.type === 'jet' ? (cfg.engines.idleN1 + (1 - cfg.engines.idleN1) * tr.throttle) * 100 : (3 + 97 * tr.throttle);
    ctl.flaps = cfg.flapLDG; ctl.trim = tr.trim; ctl.throttle = tr.throttle;
    ap.resetLoops(); ap.thetaInt = f.out.theta; ap.thetaCmd = f.out.theta; ap.iThr = tr.throttle; ap.lastIas = f.out.ias;
    const FLARE_DTHETA = cfg.type === 'jet' ? 4.6 : 5.0;
    let n50 = null, tdN = null, phase = 0, tTd = 0, thFlare = 0; const flareH = cfg.type === 'jet' ? (mass > 150000 ? 17 : 12) : 8;
    for (let i = 0; i < 120 * 240; i++) {
      const o = f.out, agl = o.agl;
      if (n50 === null && agl <= 50 * FT) n50 = f.n;
      if (phase === 0) {                                   // approach + flare
        const vsApp = -Math.tan(3 * DEG) * o.gs * KT;
        if (agl > flareH) { const thetaCmd = ap.vsLoop(vsApp, PHYS_DT); ap.thetaCmd = approach(ap.thetaCmd, thetaCmd, 3 * DEG * PHYS_DT); thFlare = ap.thetaCmd; }
        else {             // flare like a line pilot: a progressive pitch-up of a few degrees, thrust to idle, small sink-rate correction
          const k = smoothstep(0, 1, 1 - agl / flareH), tgt = Math.max(0.8, -vsApp * (agl / flareH));
          const corr = clamp(0.6 * DEG * (f.vd - tgt), -0.4 * DEG, 1.6 * DEG);
          ap.thetaCmd = approach(ap.thetaCmd, thFlare + FLARE_DTHETA * DEG * k + corr, 2.5 * DEG * PHYS_DT);
        }
        ctl.pitch = ap.pitchLoop(ap.thetaCmd, PHYS_DT);
        ctl.throttle = agl < flareH * 0.8 ? approach(ctl.throttle, 0, 0.5 * PHYS_DT) : ap.thrLoop(v.vapp, PHYS_DT, ctl.throttle);
        ctl.roll = ap.rollLoop(0, PHYS_DT);
        if (f.mainWow) { phase = 1; tdN = f.n; tTd = f.time; res.tdVs = f.vd / FPM; res.tdIas = o.ias; res.tdPitch = o.pitch; }
      } else {                                             // roll-out
        ctl.throttle = 0; ctl.roll = 0;
        ctl.pitch = ap.pitchLoop(-1 * DEG, PHYS_DT) * 0.5;
        ctl.yaw = clamp(-2 * wrapPi(o.psi) - 1.5 * f.r, -1, 1);
        if (f.time - tTd > 1.0) { ctl.reverse = o.gs > 60; ctl.throttle = o.gs > 60 ? 1 : 0; }
        if (f.time - tTd > 2.0) ctl.brake = 1;
        if (o.gs < 2) break;
      }
      f.step(PHYS_DT, ctl, FLAT_ENV);
      if (f.touchdown) res.tdG = f.touchdown.nzPeak;
    }
    res.roll = tdN !== null ? f.n - tdN : NaN; res.dist50 = n50 !== null ? f.n - n50 : NaN; res.bounces = f.touchdown ? f.touchdown.bounces : 0;
    return res;
  },


  /** drop test: trimmed landing attitude at Vref, wheels 5 cm above the runway with the given sink rate, no flare,
      ground spoilers inhibited. Returns the peak load factor measured at the centre of gravity. */
  drop(cfg, fpm) {
    const f = new FlightModel(cfg), ctl = newCtl(), mass = cfg.test.ldgMass, fuel = cfg.mass.typFuel;
    f.reset({ mass, fuel }); const v = f.vspeeds(), cas = v.vref * KT, gam = -Math.asin(fpm * FPM / tasFromCas(cas, 0));
    const tr = trimAircraft(f, { cas, alt: 50, gamma: gam, flaps: cfg.flapLDG, gearDown: true, mass, fuel });
    ctl.flaps = cfg.flapLDG; ctl.trim = tr.trim; ctl.throttle = tr.throttle;
    f.h = cfg.gear.zStatic + cfg.gear.staticDefl + 0.05 + Math.sin(f.out.theta) * Math.abs(f.legs[1].x); f.airTime = 10;
    let peak = 0, t0 = -1, tdVs = 0, pre = 1;
    for (let i = 0; i < 120 * 6; i++) { f.groundSpoilerArmed = false; if (t0 < 0) pre = f.nz; f.step(PHYS_DT, ctl, FLAT_ENV); if (f.mainWow && t0 < 0) { t0 = f.time; tdVs = f.vdTouch / FPM; } if (t0 >= 0) { peak = Math.max(peak, f.nz); if (f.time - t0 > 2) break; } }
    return { fpm: tdVs, g: 1 + peak - pre };      // increment over the 1-g (ground-effect) lift just before contact
  },

  /** autopilot check: 90 degree heading change, +2000 ft at 1200 fpm, speed hold */
  autopilot(cfg) {
    const f = new FlightModel(cfg), ap = new Autopilot(f), ctl = newCtl();
    const mass = cfg.mass.typical, spd = cfg.type === 'jet' ? 250 : 180;
    const tr = trimAircraft(f, { cas: spd * KT, alt: 8000 * FT, gamma: 0, flaps: 0, gearDown: false, mass, fuel: cfg.mass.typFuel });
    ctl.gearDown = false; ctl.trim = tr.trim; ctl.throttle = tr.throttle;
    ap.engage(); ap.setAthr(true); ap.selSpd = spd; ap.selHdg = 90; ap.selAlt = 10000; ap.selVs = 1200; ap.vert = 'VS';
    let maxBank = 0, maxNz = 0;
    for (let i = 0; i < 120 * 240; i++) { ap.update(PHYS_DT, ctl); f.step(PHYS_DT, ctl, FLAT_ENV_AIR); maxBank = Math.max(maxBank, Math.abs(f.out.roll)); maxNz = Math.max(maxNz, f.out.nz); }
    const o = f.out;
    return { altErr: o.altFt - 10000, hdgErr: wrapPi((o.hdg - 90) * DEG) * RAD, spdErr: o.ias - spd, maxBank, maxNz, vs: o.vsFpm, engaged: ap.on, mode: ap.vert };
  },

  /** coupled ILS approach on a synthetic north-facing runway: intercept from the right at 30 deg, 15 kt crosswind,
      localizer then glideslope capture from below, hand-over at 100 ft */
  approach(cfg) {
    const TA = { icao: 'TEST', elev: 0, toLocal: (e, n) => [n, -e] }, TEN = { id: '36', hdg: 0, thr: [0, 0], dir: [1, 0], rw: { len: 3000 } };
    const f = new FlightModel(cfg), ap = new Autopilot(f), ctl = newCtl(); f.reset({ mass: cfg.test.ldgMass, fuel: cfg.mass.typFuel }); const v = f.vspeeds();
    const tr = trimAircraft(f, { cas: v.vapp * KT, alt: 2500 * FT, gamma: 0, flaps: cfg.flapLDG, gearDown: true, hdg: 330, n: -12 * NM, e: 2500, mass: cfg.test.ldgMass, fuel: cfg.mass.typFuel });
    ctl.flaps = cfg.flapLDG; ctl.gearDown = true; ctl.trim = tr.trim; ctl.throttle = tr.throttle;
    ap.engage(); ap.selAlt = 2500; ap.vert = 'ALT'; ap.selHdg = 330; ap.setAthr(true); ap.selSpd = Math.round(v.vapp); ap.toggleApp();
    const env = { windN: 0, windE: -15 * KT, groundHeight: () => 0, surface: () => SURF.PAVED }, res = { loc: false, gs: false, lat: NaN, vert: NaN, disc: false };
    for (let i = 0; i < 120 * 900; i++) {
      const nav = ILS.nav(TA, TEN, f); ap.nav = nav; ap.update(PHYS_DT, ctl); f.step(PHYS_DT, ctl, env);
      for (const ev of ap.events) { if (ev === 'LOC') res.loc = true; if (ev === 'G/S') res.gs = true; if (ev === 'MINIMUMS') res.disc = true; } ap.events.length = 0;
      if (isNaN(res.lat) && f.out.aglFt < 200) { res.lat = Math.abs(nav.t); res.vert = Math.abs(nav.hW - nav.hPath) / FT; }
      if (res.disc || f.wow) break;
    }
    return res;
  },

  /** taxi check: the aircraft must hold on the parking brake, roll at taxi thrust and turn with the nosewheel */
  ground(cfg) {
    const f = new FlightModel(cfg), ctl = newCtl();
    f.reset({ onGround: true, hdg: 0 }); ctl.parkBrake = true; ctl.throttle = 0.0;
    for (let i = 0; i < 120 * 10; i++) f.step(PHYS_DT, ctl, FLAT_ENV);
    const held = Math.hypot(f.n, f.e), restPitch = f.out.pitch, restH = f.h - cfg.gear.zStatic;
    ctl.parkBrake = false; ctl.throttle = cfg.type === 'jet' ? 0.25 : 0.22;
    let t = 0; for (; t < 60 && f.out.gs < 15; t += PHYS_DT) f.step(PHYS_DT, ctl, FLAT_ENV);
    ctl.throttle = cfg.type === 'jet' ? 0.08 : 0.12; ctl.yaw = 1; const h0 = f.out.psi; let turned = 0, last = h0, maxRoll = 0;
    const p0 = [f.n, f.e];
    for (let i = 0; i < 120 * 40 && turned < Math.PI; i++) { f.step(PHYS_DT, ctl, FLAT_ENV); turned += wrapPi(f.out.psi - last); last = f.out.psi; maxRoll = Math.max(maxRoll, Math.abs(f.out.roll)); }
    const diam = Math.hypot(f.n - p0[0], f.e - p0[1]);
    return { held, restPitch, restH, tTo15: t, turnDiam: diam, turned: turned * RAD, maxRoll, gsEnd: f.out.gs };
  },

  /** run everything for one aircraft and grade it */
  run(id) {
    const cfg = AIRCRAFT[id], ex = cfg.expect, rows = [];
    const add = (name, val, range, unit) => rows.push({ name, val, range, unit, pass: isFinite(val) && val >= range[0] && val <= range[1] });
    const to = Harness.takeoff(cfg, cfg.test.toMass);
    add('Rotation speed VR', to.vr, ex.vr, 'kt');
    add('Take-off ground roll', to.liftoffDist, ex.toRoll, 'm');
    add('Take-off distance to 35 ft', to.dist35, ex.to35, 'm');
    add('Initial climb rate', to.climbFpm, ex.climb, 'fpm');
    const sc = Harness.stall(cfg, cfg.test.ldgMass, 0, false), sf = Harness.stall(cfg, cfg.test.ldgMass, cfg.flaps.length - 1, true);
    add('Stall speed clean', sc.vs, ex.vsClean, 'kt');
    add('Stall speed full flaps', sf.vs, ex.vsFull, 'kt');
    add('Stall break: nose drop', -sc.breakPitch + sc.alpha, [3, 90], 'deg');
    add('Stall wing drop, 6 s of back pressure', Math.max(sc.wingDrop, sf.wingDrop), [1, 22], 'deg');
    const ld = Harness.landing(cfg, cfg.test.ldgMass);
    add('Approach speed (Vref+5)', ld.vapp, ex.vapp, 'kt');
    add('Approach pitch attitude', ld.appPitch, ex.appPitch, 'deg');
    add('Approach ' + (cfg.type === 'jet' ? 'N1' : 'torque'), ld.appPower, cfg.type === 'jet' ? [38, 72] : [15, 60], '%');
    add('Touchdown sink rate', ld.tdVs, [30, 360], 'fpm');
    add('Landing ground roll', ld.roll, ex.ldgRoll, 'm');
    add('Landing distance from 50 ft', ld.dist50, ex.ldgDist, 'm');
    [[150, [1.05, 1.30]], [300, [1.25, 1.45]], [500, [1.55, 1.95]], [600, [1.85, 2.25]]].forEach(([v, rg]) => add('Touchdown load at ' + v + ' fpm', Harness.drop(cfg, v).g, rg, 'g'));
    const apr = Harness.autopilot(cfg);
    add('AP altitude capture error', Math.abs(apr.altErr), [0, 60], 'ft');
    add('AP heading capture error', Math.abs(apr.hdgErr), [0, 2], 'deg');
    add('A/THR speed error', Math.abs(apr.spdErr), [0, 4], 'kt');
    const apc = Harness.approach(cfg);
    add('ILS: LOC and G/S captured', (apc.loc ? 1 : 0) + (apc.gs ? 1 : 0), [2, 2], 'modes');
    add('Coupled ILS: centreline error at 200 ft', apc.lat, [0, 8], 'm');
    add('Coupled ILS: glide path error at 200 ft', apc.vert, [0, 20], 'ft');
    add('Autopilot hands over at 100 ft', apc.disc ? 1 : 0, [1, 1], '');
    const gr = Harness.ground(cfg);
    add('Parking brake creep (10 s)', gr.held, [0, 0.05], 'm');
    add('180 deg taxi turn diameter', gr.turnDiam, [cfg.gear.nose.x * 1.0, cfg.gear.nose.x * 4.5], 'm');
    return { id, name: cfg.name, rows, pass: rows.every(r => r.pass), detail: { to, sc, sf, ld, apr, gr } };
  },
  runAll() { return AIRCRAFT_ORDER.map(Harness.run); }
};
