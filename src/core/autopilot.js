/* Autopilot, autothrottle i auto-trim.
 * ORIGEN: linies 906-1057 de l'original (SECTION 6).
 *
 * EXPORTA: THR_CLB Autopilot AutoTrim
 *
 * IMPORTA: ./constants.js
 */

import { DEG, FT, KT, FPM, clamp, wrapPi, approach } from './constants.js';
import { ILS } from '../world/ils.js';   // nomes per a ILS.GS a la guia de senda
export const THR_CLB = 0.88;          // thrust-lever climb detent (about 90 % N1); 1.0 = TOGA, 0 = idle
export class Autopilot {
  constructor(fdm) {
    this.fdm = fdm; this.on = false; this.athr = false;
    this.lat = 'HDG'; this.vert = 'ALT';
    this.selHdg = 0; this.selAlt = 5000; this.selVs = 0; this.selSpd = 200; this.thrMax = THR_CLB;     // autothrottle never exceeds the climb detent
    this.appArm = false; this.nav = null; this.fd = { active: false, phiOk: false, thetaOk: false, phi: 0, theta: 0 }; this.events = [];
    this.resetLoops();
  }
  resetLoops() { this.iTheta = 0; this.thetaCmd = this.fdm.out.theta || 0; this.thetaInt = this.thetaCmd; this.phiCmd = this.fdm.out.phi || 0; this.iThr = null; this.lastIas = null; this.accF = 0; this.altArm = false; }
  sched() { const q = Math.max(this.fdm.out.qbar || 1, 200); return clamp(this.fdm.qRef / q, 1, 2.5); }
  /** pitch attitude hold -> elevator command */
  pitchLoop(thetaCmd, dt) {
    const f = this.fdm, o = f.out, k = this.sched();
    const err = thetaCmd - o.theta;
    this.iTheta = clamp(this.iTheta + 1.6 * err * dt, -0.8, 0.8);
    return clamp(k * (7.0 * err - 5.0 * f.q) + this.iTheta, -1, 1);
  }
  /** bank angle hold -> aileron command */
  rollLoop(phiCmd, dt) {
    const f = this.fdm, o = f.out, k = Math.pow(this.sched(), 0.75);
    this.phiCmd = approach(this.phiCmd, phiCmd, 6 * DEG * dt);
    return clamp(k * (3.2 * (this.phiCmd - o.phi) - 2.6 * f.p), -1, 1);
  }
  /** vertical speed (m/s) -> pitch attitude command */
  vsLoop(vsCmd, dt) {
    const o = this.fdm.out, V = Math.max(o.tasMs, 40);
    const gErr = clamp((vsCmd + this.fdm.vd) / V, -0.06, 0.06);          // flight path angle error (rad)
    this.thetaInt = clamp(this.thetaInt + 0.35 * gErr * dt, -0.25, 0.40);
    return clamp(this.thetaInt + 1.1 * gErr, -0.26, 0.42);
  }
  /** speed hold (knots) -> throttle */
  thrLoop(spd, dt, cur) {
    const o = this.fdm.out;
    if (this.iThr === null) { this.iThr = cur; this.lastIas = o.ias; }
    const acc = (o.ias - this.lastIas) / dt; this.lastIas = o.ias;
    this.accF += (acc - this.accF) * Math.min(1, 1.5 * dt);
    const err = clamp(spd - o.ias, -20, 20);
    this.iThr = clamp(this.iThr + 0.006 * err * dt, 0, this.thrMax);
    return clamp(this.iThr + 0.030 * err - 0.10 * this.accF, 0, this.thrMax);
  }
  engage() {
    const o = this.fdm.out; this.on = true; this.resetLoops();
    if (this.lat !== 'LOC') { this.lat = 'HDG'; this.selHdg = Math.round(o.hdg) % 360; }
    if (this.vert === 'GS') return;                                     // an approach already captured on the flight director carries on
    if (Math.abs(o.vsFpm) < 400) { this.vert = 'ALT'; this.selAlt = Math.round(o.altFt / 100) * 100; this.selVs = 0; }
    else { this.vert = 'VS'; this.selVs = Math.round(o.vsFpm / 100) * 100; }
  }
  disengage() { this.on = false; }
  setAthr(on) { this.athr = on; this.iThr = null; if (on) this.selSpd = Math.round(this.fdm.out.ias); }
  /** APP push-button: arm localizer + glideslope capture, or cancel the approach modes */
  toggleApp() {
    const o = this.fdm.out;
    if (this.appArm || this.lat === 'LOC' || this.vert === 'GS') {
      this.appArm = false; if (this.lat === 'LOC') { this.lat = 'HDG'; this.selHdg = Math.round(o.hdg) % 360; }
      if (this.vert === 'GS') { this.vert = 'VS'; this.selVs = Math.round(o.vsFpm / 100) * 100; }
      this.fd.active = false; return false;
    }
    this.appArm = true; return true;
  }
  /** approach modes and flight-director guidance. Runs with the autopilot on OR off:
      with the autopilot off the same commands drive the flight director / HUD guidance cue. */
  navModes(dt) {
    const f = this.fdm, o = f.out, nav = this.nav, fd = this.fd;
    fd.phiOk = fd.thetaOk = false;
    if (!this.appArm && this.lat !== 'LOC' && this.vert !== 'GS') { fd.active = false; return; }
    if (!nav || !nav.locValid) {                                                       // signal lost: revert to basic modes
      if (this.lat === 'LOC') { this.lat = 'HDG'; this.selHdg = Math.round(o.hdg) % 360; this.events.push('LOC LOST'); }
      if (this.vert === 'GS') { this.vert = 'VS'; this.selVs = Math.round(o.vsFpm / 100) * 100; this.events.push('G/S LOST'); }
      fd.active = false; return;
    }
    if (this.lat !== 'LOC' && !f.wow && Math.abs(nav.locAng) < 2.3 * DEG) { this.lat = 'LOC'; this.locT = 0; this.events.push('LOC'); }
    if (this.vert !== 'GS' && this.lat === 'LOC' && nav.gsValid && Math.abs(nav.gsDev) < 0.15 * DEG) { this.vert = 'GS'; this.gsT = 0; this.thetaInt = o.theta; this.events.push('G/S'); }
    if (this.lat === 'LOC' && this.vert === 'GS') this.appArm = false;
    fd.active = true;
    if (this.lat === 'LOC') {                                                           // lateral: look-ahead guidance onto the centreline
      this.locT = (this.locT || 0) + dt;
      const V = Math.max(o.gs * KT, 40), L = clamp(V * 22, 1200, 4500);
      const trkCmd = nav.crs + clamp(Math.atan2(nav.t, L), -30 * DEG, 30 * DEG);
      const drift = o.gs > 30 ? wrapPi((o.track - o.hdg) * DEG) : 0;
      const hErr = wrapPi(trkCmd - drift - o.psi), bankLim = nav.s > -5000 ? 12 * DEG : 25 * DEG;
      fd.phi = clamp(1.3 * hErr, -bankLim, bankLim); fd.phiOk = true;
    }
    if (this.vert === 'GS') {                                                           // vertical: ride the 3 degree path
      this.gsT = (this.gsT || 0) + dt;
      const along = Math.max(f.vn * Math.cos(nav.crs) + f.ve * Math.sin(nav.crs), 30);
      const vsCmd = -along * Math.tan(ILS.GS) - clamp(0.12 * (nav.hW - nav.hPath), -4, 4);
      fd.theta = this.vsLoop(vsCmd, dt); fd.thetaOk = true;
    }
  }
  /** called every physics step; overrides the pilot's ctl while engaged */
  update(dt, ctl) {
    const f = this.fdm, o = f.out;
    if (this.athr) {
      if (f.wow && o.gs < 30) this.athr = false;
      else if (!f.wow && o.aglFt < 27 && o.vsFpm < 0 && f.gearPos > 0.99 && f.flapPos >= f.cfg.flapLDG - 1.05) { this.athr = false; ctl.throttle = 0; this.events.push('RETARD'); }   // auto-retard in the flare
      else ctl.throttle = this.thrLoop(this.selSpd, dt, ctl.throttle);
    }
    this.navModes(dt);
    if (!this.on) return;
    if (f.wow || o.stalled || Math.abs(o.roll) > 50 || Math.abs(o.pitch) > 30) { this.on = false; this.tripped = true; return; }
    if (this.vert === 'GS' && o.aglFt < 100) { this.on = false; this.tripped = false; this.events.push('MINIMUMS'); return; }   // coupled approach ends at 100 ft: land by hand
    // lateral
    if (this.lat === 'LOC' && this.fd.phiOk) ctl.roll = this.rollLoop(this.fd.phi, dt);
    else { const hErr = wrapPi((this.selHdg - o.hdg) * DEG); ctl.roll = this.rollLoop(clamp(1.3 * hErr, -25 * DEG, 25 * DEG), dt); }
    ctl.yaw = 0;
    // vertical
    let thetaCmd;
    if (this.vert === 'GS' && this.fd.thetaOk) thetaCmd = this.fd.theta;
    else {
      const altErr = this.selAlt * FT - f.h;
      if (this.vert === 'VS') {
        const toward = this.selVs * altErr > 0;
        if (toward && Math.abs(altErr) < Math.max(60, Math.abs(o.vsFpm) * FPM * 9)) this.vert = 'ALT';     // altitude capture
      }
      let vsCmd;
      if (this.vert === 'ALT') { const lim = Math.max(800, Math.abs(this.selVs)) * FPM; vsCmd = clamp(0.10 * altErr, -lim, lim); }
      else vsCmd = this.selVs * FPM;
      // extra pitch to hold the flight path in a banked turn is picked up by the integrator
      thetaCmd = this.vsLoop(vsCmd, dt);
    }
    this.thetaCmd = approach(this.thetaCmd, thetaCmd, 2.5 * DEG * dt);
    const el = this.pitchLoop(this.thetaCmd, dt);
    ctl.pitch = el;
    // automatic pitch trim off-loads the elevator
    ctl.trim = clamp(ctl.trim + clamp(0.5 * el, -0.06, 0.06) * dt, -1, 1);
    this.iTheta -= clamp(0.5 * el, -0.06, 0.06) * dt * 0.9;
  }
}

/** Pitch auto-trim for keyboard flying (on by default, like the automatic trim of a fly-by-wire airliner):
    - while the stick is deflected the trim slowly follows it, so the attitude you set stays when you let go;
    - with the stick neutral it holds that pitch attitude through thrust, speed, flap and gear changes;
    - it never trims nose-up into a stall warning. Manual trim (Z / X) and the autopilot take priority. */
export class AutoTrim {
  constructor() { this.hold = null; this.wait = 0; }
  update(dt, fdm, ctl, stick, manual) {
    const o = fdm.out; if (fdm.wow || manual) { this.hold = null; this.wait = 0; return; }
    if (Math.abs(stick) > 0.04) { ctl.trim = clamp(ctl.trim + stick * 0.10 * dt, -1, 1); this.hold = null; this.wait = 0; return; }
    if (this.hold === null) { this.wait += dt; if (this.wait < 0.6 && Math.abs(fdm.q) > 0.004) return; this.hold = clamp(o.theta, -0.26, 0.35); }
    let rate = clamp(1.2 * (this.hold - o.theta) - 2.6 * fdm.q, -0.10, 0.10);
    if (o.stallWarn && rate > 0) { rate = -0.05; this.hold = Math.min(this.hold, o.theta - 0.01); }      // let the nose fall instead of chasing the attitude into a stall
    ctl.trim = clamp(ctl.trim + rate * dt, -1, 1);
  }
}
