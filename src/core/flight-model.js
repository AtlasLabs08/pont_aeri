/* Model de vol 6-DOF: cos rigid, pas fix de 120 Hz.
 * ORIGEN: linies 460-864 de l'original (SECTION 4).
 *
 * EXPORTA: PHYS_DT STALL_W SURF FLAT_ENV FlightModel
 *
 * IMPORTA: ./constants.js i ./atmosphere.js
 *
 * REGLA: aqui no es canvia NI UNA formula. Nomes moure i exportar.
 *        Qualsevol millora va en un PR a part, amb el harness en verd
 *        abans i despres.
 */

import {
  DEG, RAD, FT, KT, G0, FPM,
  clamp, lerp, sat, smoothstep, wrapPi, wrap360, sign, approach,
  quatFromEuler
} from './constants.js';
import { ISA, isa, casFromMach } from './atmosphere.js';
import { hash2 } from './noise.js';
export const PHYS_DT = 1 / 120;
export const SURF = { PAVED: 0, GRASS: 1, TERRAIN: 2, WATER: 3 };
export const STALL_W = 0.022;          // width (rad) of the attached->separated flow blend

/** default environment: flat paved ground at sea level, calm. The game swaps in the real world. */
export const FLAT_ENV = {
  windN: 0, windE: 0,
  groundHeight: () => 0,
  surface: () => SURF.PAVED
};

export class FlightModel {
  constructor(cfg) {
    this.cfg = cfg;
    this.events = [];
    this.out = {};
    this._buildLiftCurves();
    this._buildGear();
    this.reset({});
  }

  /* ---- lift curve: linear region blended into a flat-plate post-stall curve ---------- */
  static liftCurve(alpha, CL0f, CLa, aS, dCLf, res) {
    const sp = 1 / (1 + Math.exp(-(alpha - aS) / STALL_W));
    const sn = 1 / (1 + Math.exp((alpha + 0.20) / STALL_W));
    const s2 = Math.sin(2 * alpha);
    const lin = CL0f + CLa * alpha;
    res.sp = sp; res.sn = sn;
    res.CL = lin * (1 - sp - sn) + (0.95 * s2 + 0.40 * dCLf + 0.08) * sp + (0.95 * s2) * sn;
    return res.CL;
  }
  /** High-lift model. For every detent CLmax is DERIVED from the published 1-g stall speed. The stall ANGLE is set
      physically: leading-edge slats delay separation (+slatDAlpha), trailing-edge flaps bring it slightly forward
      (flapDAlpha). The flap's lift increment dCL (the upward shift of the curve) is then solved so that the blended
      curve peaks exactly at CLmax. Slats therefore raise the stall angle instead of shifting the curve, which gives
      realistic nose-up approach attitudes while every stall speed stays where the data says. */
  _buildLiftCurves() {
    const c = this.cfg, a = c.aero, tmp = {}, degMax = c.flaps[c.flaps.length - 1].deg;
    const peak = (aS, dCL) => { let m = -9, am = 0; for (let al = 0; al < 0.7; al += 0.002) { const v = FlightModel.liftCurve(al, a.CL0 + dCL, a.CLa, aS, dCL, tmp); if (v > m) { m = v; am = al; } } return [m, am]; };
    const clmaxOf = f => { const vs = f.vs * KT; return a.clmaxCal * 2 * c.vsRefMass * G0 / (ISA.rho0 * c.geom.S * vs * vs); };
    // clean wing: stall angle from CLmax
    let lo = 0.05, hi = 0.6; const CLmax0 = clmaxOf(c.flaps[0]);
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (peak(mid, 0)[0] < CLmax0) lo = mid; else hi = mid; }
    const aS0 = (lo + hi) / 2;
    this.flapTab = c.flaps.map((f, i) => {
      const CLmax = clmaxOf(f); if (i === 0) return { dCL: 0, dCD: 0, dCm: 0, aS: aS0, aPk: peak(aS0, 0)[1], CLmax };
      const aS = aS0 + (f.dAlpha !== undefined ? f.dAlpha : (f.slat || 0) * (a.slatDAlpha || 0) + f.deg / degMax * (a.flapDAlpha || 0));
      let l = -0.3, h = 3.0; for (let k = 0; k < 40; k++) { const mid = (l + h) / 2; if (peak(aS, mid)[0] < CLmax) l = mid; else h = mid; }
      const dCL = (l + h) / 2; return { dCL, dCD: f.dCD, dCm: f.dCm, aS, aPk: peak(aS, dCL)[1], CLmax };
    });
    this.qRef = 0.5 * ISA.rho0 * Math.pow(1.35 * c.flaps[c.flaps.length - 1].vs * KT, 2);
  }
  /** spring / damper rates from the static load share of every strut */
  _buildGear() {
    const g = this.cfg.gear, m = this.cfg.mass.typical, W = m * G0;
    const xm = g.mains.reduce((s, l) => s + l.x, 0) / g.mains.length;
    const noseShare = -xm / (g.nose.x - xm);
    const zFull = g.zStatic + g.staticDefl;
    this.legs = [];
    // Each strut = tyre spring in series with an oleo: polytropic air spring (n = 1.3, pre-load 8 % of the static load, static position
    // at 80 % of the stroke) + orifice damping proportional to stroke-velocity squared (much stronger in rebound).
    const mk = (x, y, load, isNose) => {
      const S = g.stroke, soS = 0.80 * S, dg = soS / 0.8567, kt = load / g.tireDefl, mEq = load / G0, kAir = 1.3 * load / (dg - soS);
      const Cc = (isNose ? 1.6 : 1.0) * g.orifice * load;
      return { x, y, z: zFull, nose: isNose, stroke: S, soS, soMax: 0.90 * S, dg, F0: 0.08 * load, kt, ct: 2 * 0.10 * Math.sqrt(kt * mEq), Cc, Cr: 14 * Cc, c1: (kt + kAir) * PHYS_DT * 0.27, tireMax: g.tireDefl * 3.2, so: 0, soDot: 0, comp: 0, load: 0 };
    };
    this.legs.push(mk(g.nose.x, g.nose.y, W * noseShare, true));
    for (const l of g.mains) { const leg = mk(l.x, l.y, W * (1 - noseShare) / g.mains.length, false); leg.z += (l.x - xm) * Math.tan(3.5 * DEG); this.legs.push(leg); }   // multi-bogie aircraft: aft trucks sit slightly higher so all trucks share the touchdown
    // structural contact points
    const ct = this.cfg.contact, P = [];
    P.push({ n: 'wing', p: ct.wingtip }, { n: 'wing', p: [ct.wingtip[0], -ct.wingtip[1], ct.wingtip[2]] });
    P.push({ n: 'engine', p: ct.engine }, { n: 'engine', p: [ct.engine[0], -ct.engine[1], ct.engine[2]] });
    if (ct.engine2) P.push({ n: 'engine', p: ct.engine2 }, { n: 'engine', p: [ct.engine2[0], -ct.engine2[1], ct.engine2[2]] });
    // tail point placed so that it touches at the published tail-strike attitude (struts compressed)
    const xMain = xm, zt = g.zStatic - Math.tan(ct.tailStrikeDeg * DEG) * (xMain - ct.tailX);
    P.push({ n: 'tail', p: [ct.tailX, 0, zt] }, { n: 'nose', p: ct.nose }, { n: 'belly', p: ct.belly });
    this.contactPts = P;
  }

  /** (re)initialise the state. All fields optional. */
  reset(o) {
    const c = this.cfg;
    this.n = o.n || 0; this.e = o.e || 0;
    this.fuel = o.fuel !== undefined ? o.fuel : c.mass.typFuel;
    this.zfm = (o.mass !== undefined ? o.mass : c.mass.typical) - this.fuel;   // zero-fuel mass
    this.mass = this.zfm + this.fuel;
    const onGround = !!o.onGround;
    const gnd = o.groundH || 0;
    this.h = onGround ? gnd + c.gear.zStatic : (o.alt !== undefined ? o.alt : 1000);
    const psi = (o.hdg || 0) * DEG, theta = o.theta || 0, phi = o.phi || 0;
    const qq = quatFromEuler(phi, theta, psi);
    this.q0 = qq[0]; this.q1 = qq[1]; this.q2 = qq[2]; this.q3 = qq[3];
    const V = o.tas || 0, gam = o.gamma || 0;
    this.vn = V * Math.cos(gam) * Math.cos(psi); this.ve = V * Math.cos(gam) * Math.sin(psi); this.vd = -V * Math.sin(gam);
    this.p = 0; this.q = 0; this.r = 0;
    const thr = o.throttle || 0;
    this.eng = []; for (let i = 0; i < c.engines.n; i++) this.eng.push({ x: thr, egt: 400 + 400 * thr, ff: 0, thrust: 0, rate: 0.996 + 0.008 * ((i * 7919) % 5) / 4 });
    this.revPos = 0;
    this.elev = 0; this.ail = 0; this.rud = 0; this.steer = 0;
    this.flapPos = o.flaps || 0; this.gearPos = (o.gearDown === false) ? 0 : 1;
    this.spoilerPos = 0; this.brakeAct = 0;
    this.trim = o.trim || 0;
    this.time = 0; this.airTime = onGround ? 0 : 99; this.groundTime = 0;
    this.wow = onGround; this.mainWow = onGround; this.noseWow = onGround;
    this.dropSign = 1; this.stalled = false;
    this.nz = 1; this.nzPeak = 1; this.fuelOut = false;
    this.touchdown = null; this.events.length = 0; this.surfaceType = SURF.PAVED;
    this.distGround = 0;
    for (const l of this.legs) { l.comp = onGround ? c.gear.staticDefl : 0; l.so = onGround ? l.soS : 0; l.soDot = 0; l.load = 0; }
    this._airdata(FLAT_ENV, 0, 0);
    this.out.agl = onGround ? 0 : this.h - gnd - c.gear.zStatic; this.out.aglFt = this.out.agl / FT;
    this.out.stallWarn = false; this.out.stalled = false; this.out.qbar = 0.5 * this.out.rho * this.out.tasMs * this.out.tasMs;
  }

  /** current 1-g stall speed (m/s CAS) for a flap detent index (fractional allowed) */
  stallSpeed(flapIdx) {
    const f = this.cfg.flaps, i = clamp(Math.floor(flapIdx), 0, f.length - 1), j = Math.min(i + 1, f.length - 1);
    const vs = lerp(f[i].vs, f[j].vs, clamp(flapIdx - i, 0, 1));
    return vs * KT * Math.sqrt(this.mass / this.cfg.vsRefMass);
  }
  /** operational speeds in knots for the current mass */
  vspeeds() {
    const c = this.cfg, k = Math.sqrt(this.mass / c.vsRefMass);
    const vsTO = c.flaps[c.flapTO].vs * k, vsLD = c.flaps[c.flapLDG].vs * k;
    const vr = 1.10 * vsTO, v2 = 1.15 * vsTO;
    return { vsTO, vsLD, v1: vr - 5, vr, v2, vref: 1.23 * vsLD, vapp: 1.23 * vsLD + 5, vsClean: c.flaps[0].vs * k };
  }

  /* ---- air data helper (also used right after reset) ---- */
  _airdata(env, wn, we) {
    const o = this.out, at = isa(this.h);
    const w = this.q0, x = this.q1, y = this.q2, z = this.q3;
    o.phi = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    o.theta = Math.asin(clamp(2 * (w * y - z * x), -1, 1));
    o.psi = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    const an = this.vn - wn, ae = this.ve - we;
    const tas = Math.sqrt(an * an + ae * ae + this.vd * this.vd);
    o.tasMs = tas; o.mach = tas / at.a; o.casMs = casFromMach(o.mach, at.p);
    o.ias = o.casMs / KT; o.tas = tas / KT; o.gs = Math.hypot(this.vn, this.ve) / KT;
    o.altFt = this.h / FT; o.vsFpm = -this.vd / FPM;
    o.hdg = wrap360(o.psi * RAD); o.track = wrap360(Math.atan2(this.ve, this.vn) * RAD);
    o.pitch = o.theta * RAD; o.roll = o.phi * RAD;
    o.rho = at.rho; o.oat = at.T - 273.15; o.pStatic = at.p;
  }

  /* ======================================================================
     One fixed physics step.
     ctl: { pitch, roll, yaw  (-1..1; +pitch = nose up, +roll = right, +yaw = nose right),
            throttle 0..1, flaps (detent index), gearDown, brake 0..1, parkBrake,
            spoiler 0..1, reverse, trim -1..1 (+ = nose up), steer (optional, else = yaw) }
     ====================================================================== */
  step(dt, ctl, env) {
    const c = this.cfg, a = c.aero, g = c.geom, o = this.out, E = c.engines;
    this.time += dt;

    /* ---------- 1. systems: actuators, flaps, gear, spoilers ---------- */
    this.elev = approach(this.elev, clamp(ctl.pitch, -1, 1), 3.5 * dt);
    this.ail = approach(this.ail, clamp(ctl.roll, -1, 1), 4.0 * dt);
    this.rud = approach(this.rud, clamp(ctl.yaw, -1, 1), 3.0 * dt);
    this.trim = clamp(ctl.trim, -1, 1);
    this.flapPos = approach(this.flapPos, clamp(ctl.flaps, 0, c.flaps.length - 1), c.flapRate * dt);
    if (!(this.wow && !ctl.gearDown))                      // gear lever is locked down on the ground
      this.gearPos = approach(this.gearPos, ctl.gearDown ? 1 : 0, dt / c.gear.transit);
    // speedbrake: half (flight detent) in the air, full on the ground; auto ground spoilers at touchdown
    let spCmd = ctl.spoiler ? (this.mainWow ? 1 : 0.5) : 0;
    if (this.mainWow && ctl.throttle < 0.12 && o.gs > 45 && this.groundSpoilerArmed) spCmd = 1;
    if (ctl.throttle > 0.5) spCmd = 0;
    this.spoilerPos = approach(this.spoilerPos, spCmd, 1.6 * dt);
    this.brakeAct = approach(this.brakeAct, ctl.parkBrake ? 1 : clamp(ctl.brake, 0, 1), 2.5 * dt);

    /* ---------- 2. attitude matrix (body -> world) ---------- */
    const w = this.q0, x = this.q1, y = this.q2, z = this.q3;
    const r11 = 1 - 2 * (y * y + z * z), r12 = 2 * (x * y - w * z), r13 = 2 * (x * z + w * y);
    const r21 = 2 * (x * y + w * z), r22 = 1 - 2 * (x * x + z * z), r23 = 2 * (y * z - w * x);
    const r31 = 2 * (x * z - w * y), r32 = 2 * (y * z + w * x), r33 = 1 - 2 * (x * x + y * y);

    /* ---------- 3. atmosphere, wind and air-relative velocity ---------- */
    const gndH = env.groundHeight(this.n, this.e);
    const agl = this.h - gndH - c.gear.zStatic;                    // wheel height above ground (approx)
    const wf = agl > 300 ? 1 : 0.55 + 0.45 * Math.pow(Math.max(agl, 0) / 300, 0.4);   // boundary layer
    const wn = env.windN * wf + (env.gustN || 0), we = env.windE * wf + (env.gustE || 0);      // steady wind + turbulence
    this._airdata(env, wn, we);
    const an = this.vn - wn, ae = this.ve - we, ad = this.vd - (env.gustD || 0);
    const ub = r11 * an + r21 * ae + r31 * ad, vb = r12 * an + r22 * ae + r32 * ad, wb = r13 * an + r23 * ae + r33 * ad;
    const V = o.tasMs, Vs = Math.max(V, 1);
    const alpha = Math.atan2(wb, ub), beta = V > 0.5 ? Math.asin(clamp(vb / V, -1, 1)) : 0;
    const rho = o.rho, M = o.mach, qbar = 0.5 * rho * V * V;
    // rate of change of alpha (downwash lag on the tail adds short-period damping)
    const adRaw = (V > 25 && this._alphaPrev !== undefined) ? clamp(wrapPi(alpha - this._alphaPrev) / dt, -1, 1) : 0; this._alphaPrev = alpha;
    this.alphaDot = (this.alphaDot || 0) + (adRaw - (this.alphaDot || 0)) * Math.min(1, 10 * dt);

    /* ---------- 4. engines ---------- */
    const sigma = rho / ISA.rho0;
    const revCmd = (ctl.reverse && this.wow) ? 1 : 0;
    this.revPos = approach(this.revPos, revCmd, 0.6 * dt);
    const revTransit = this.revPos > 0.02 && this.revPos < 0.98;
    let xCmd = revTransit ? 0 : (this.revPos >= 0.98 ? ctl.throttle * 0.80 : ctl.throttle);
    if (this.fuel <= 0) { this.fuelOut = true; xCmd = 0; }
    let thrustTot = 0, MyT = 0, MzT = 0, ffTot = 0;
    const dirF = lerp(1, -E.reverseFrac, this.revPos);
    for (let i = 0; i < E.n; i++) {
      const en = this.eng[i];
      const rate = (E.spool.a0 + E.spool.a1 * en.x) * en.rate;
      en.x = xCmd > en.x ? Math.min(xCmd, en.x + rate * dt) : Math.max(xCmd, en.x - rate * 1.25 * dt);
      let T, ff;
      if (c.type === 'jet') {
        const n1 = E.idleN1 + (1 - E.idleN1) * en.x;
        const avail = E.thrust * Math.pow(sigma, 0.75) * Math.max(0.35, 1 - 0.49 * Math.sqrt(Math.min(M, 0.95)));
        T = avail * n1 * n1 * dirF;
        ff = Math.max(E.idleFF * (0.4 + 0.6 * sigma), (E.tsfc0 + E.tsfcM * M) * Math.abs(avail * n1 * n1) / (G0 * 3600));
        en.n1 = n1 * 100;
        en.egt += ((330 + 560 * Math.pow(en.x, 1.15) + 40 * (1 - sigma)) - en.egt) * Math.min(1, 0.6 * dt);
      } else {
        const pf = 0.03 + 0.97 * en.x;
        const P = E.power * Math.min(1, E.flatRate * Math.pow(sigma, 0.8)) * pf;
        const Vc = E.propEff * E.power / E.staticThrust;
        if (this.revPos >= 0.98) T = -E.reverseFrac * E.staticThrust * pf * Math.max(0.4, 1 - V / 120) - qbar * E.propDragArea * 0.20;
        else {
          T = E.propEff * P / Math.cbrt(V * V * V + Vc * Vc * Vc);
          T -= qbar * E.propDragArea * (this.wow ? 0.22 : 0.10) * Math.max(0, 1 - pf / 0.22);          // windmilling / disc drag at flight idle
        }
        ff = Math.max(E.idleFF, E.psfc * P);
        en.tq = pf * 100 * Math.min(1, E.flatRate * Math.pow(sigma, 0.8));
        en.np = this.fuelOut ? 20 : (en.x < 0.05 && this.wow ? 71 : 82 + 18 * smoothstep(0.55, 0.95, en.x));
        en.egt += ((480 + 300 * Math.pow(en.x, 1.1)) - en.egt) * Math.min(1, 0.9 * dt);
      }
      if (this.fuelOut) { T = c.type === 'jet' ? 0 : -qbar * E.propDragArea * 0.05; ff = 0; }
      en.thrust = T; en.ff = ff; thrustTot += T; ffTot += ff;
      MyT += E.pos[i][2] * T; MzT -= E.pos[i][1] * T;
    }
    this.fuel = Math.max(0, this.fuel - ffTot * dt);
    this.mass = this.zfm + this.fuel;
    const m = this.mass, iS = m / c.inertia.refMass;
    const Ixx = c.inertia.Ixx * iS, Iyy = c.inertia.Iyy * iS, Izz = c.inertia.Izz * iS, Ixz = (c.inertia.Ixz || 0) * iS;

    /* ---------- 5. aerodynamic coefficients ---------- */
    const ft = this.flapTab, fi = Math.min(Math.floor(this.flapPos), ft.length - 2 < 0 ? 0 : ft.length - 2), ftT = this.flapPos - fi;
    const f0 = ft[fi], f1 = ft[Math.min(fi + 1, ft.length - 1)];
    const dCLf = lerp(f0.dCL, f1.dCL, ftT), dCDf = lerp(f0.dCD, f1.dCD, ftT), dCmf = lerp(f0.dCm, f1.dCm, ftT);
    const machK = 1 - 0.30 * smoothstep(0.45, 0.90, M);                      // CLmax / stall angle drop with Mach (buffet)
    const aS = lerp(f0.aS, f1.aS, ftT) * machK, aPk = lerp(f0.aPk, f1.aPk, ftT) * machK;
    const pg = 1 + 0.6 * (1 / Math.sqrt(1 - Math.min(M, 0.88) * Math.min(M, 0.88)) - 1);   // compressibility
    const lc = this._lc || (this._lc = {});
    let CL = FlightModel.liftCurve(alpha, a.CL0 + dCLf, a.CLa * pg, aS, dCLf, lc);
    const sp = lc.sp, sg = Math.min(1, lc.sp + lc.sn);
    // ground effect (wing height / span)
    const hb = Math.max(0.02, (agl + c.gear.zStatic * 0.8) / g.b), ge = (16 * hb) * (16 * hb) / (1 + (16 * hb) * (16 * hb));
    CL *= 1 + 0.10 * (1 - ge);
    // control deflections (authority limited at high dynamic pressure, like q-feel / travel limiters)
    const auth = Math.min(1, this.qRef / Math.max(qbar, 1));
    const dTrim = this.trim > 0 ? this.trim * a.trimRange[0] : -this.trim * a.trimRange[1];
    // The stick can always overpower the pitch trim: when it opposes the trim, the trim's own deflection is added to the
    // (q-limited) elevator travel. Without this a forgotten take-off trim beat full forward stick above ~280 kt.
    const oppose = this.elev * this.trim < 0 ? Math.abs(dTrim) * 1.0 : 0;
    const de = -this.elev * (a.deMax * (this.elev > 0 ? 1 : 0.8) * auth + oppose) + dTrim;   // + = trailing edge down
    const da = this.ail * a.daMax * Math.pow(auth, 0.75);
    // yaw damper + turn coordination (a standard airliner system): opposes yaw rate not explained by the turn
    const rCoord = V > 30 ? G0 * Math.sin(o.phi) * Math.cos(o.theta) / V : 0;
    const yd = this.wow ? 0 : clamp(-1.6 * (this.r - rCoord) + 3.5 * beta + 0.30 * this.ail, -0.5, 0.5);   // + aileron-rudder interconnect
    const dr = clamp(this.rud + yd, -1, 1) * a.drMax * auth;
    // spoilers / speedbrakes
    const spo = this.spoilerPos, flapFrac = this.flapPos / (c.flaps.length - 1);
    CL += a.CLde * de - spo * (0.40 + 0.40 * flapFrac) * (1 - sg);
    const k = 1 / (Math.PI * a.e * g.b * g.b / g.S);
    const dM = M - a.Mcrit, wave = dM > 0 ? 1.5 * dM * dM + 60 * dM * dM * dM * dM : 0;
    const sa = Math.sin(alpha);
    const CDatt = a.CD0 + dCDf + a.dCDgear * this.gearPos + 0.065 * spo + k * CL * CL * ge + wave + 0.6 * beta * beta;
    const CD = lerp(CDatt, a.CD0 + dCDf + a.dCDgear * this.gearPos + 1.9 * sa * sa + 0.05, sg);
    const CY = a.CYb * beta - a.CYdr * dr;   // right rudder -> side force to the left at the fin
    // moments. alphaM limits the linear terms so taxiing with a tailwind stays sane.
    const alphaM = clamp(alpha, -0.5, 0.6), bM = g.b / (2 * Vs), cM = g.c / (2 * Vs);
    if (sp > 0.35 && !this.stalled) { this.stalled = true; this.dropSign = (beta * 40 + this.r * 8 + this.p * 4 + (hash2(Math.floor(this.time * 1000), 7) - 0.5)) >= 0 ? 1 : -1; }
    if (sp < 0.10) this.stalled = false;
    const Cl = a.Clb * beta + a.Clp * (1 - 0.55 * sg) * this.p * bM + a.Clr * this.r * bM
             + a.Clda * da * (1 - 0.65 * sg) - a.Cldr * dr + sp * clamp(-0.22 * beta + 0.0065 * this.dropSign, -0.012, 0.012);     // stall asymmetry: the wing INTO the sideslip keeps flying, the trailing wing drops; small random bias
    const Cm = a.Cm0 + a.Cma * alphaM + (a.Cmq * this.q + (a.Cmadot || 0) * this.alphaDot) * cM + a.Cmde * de + dCmf
             - sp * (0.30 + 2.5 * Math.max(0, alpha - aS)) + 0.04 * spo;
    const Cn = a.Cnb * beta + a.Cnr * this.r * bM + a.Cnp * this.p * bM + a.Cndr * dr + a.Cnda * da + 0.004 * sp * this.dropSign;

    /* ---------- 6. forces and moments in body axes ---------- */
    const qS = qbar * g.S, L = qS * CL, D = qS * CD, Yf = qS * CY;
    const ca = Math.cos(alpha), cb = Math.cos(beta), sb = Math.sin(beta);
    // drag along -V, lift perpendicular to V in the symmetry plane, side force along body y
    let Fx = -D * ca * cb + L * sa + thrustTot;
    let Fy = -D * sb + Yf;
    let Fz = -D * sa * cb - L * ca;
    let Mx = qS * g.b * Cl, My = qS * g.c * Cm + MyT, Mz = qS * g.b * Cn + MzT;
    const FzAero = Fz;

    /* ---------- 7. landing gear: spring-damper struts + tyre friction ---------- */
    let nMain = 0, nNose = 0, brakeCap = 0, gearFz = 0;
    const surf = env.surface(this.n, this.e); this.surfaceType = surf;
    const gearOk = this.gearPos > 0.97;
    if (agl < 25) {
      const muRoll = surf === SURF.PAVED ? 0.016 : (surf === SURF.GRASS ? 0.075 : 0.12);
      const muBrake = surf === SURF.PAVED ? 0.42 : 0.30, muLat = surf === SURF.PAVED ? 0.70 : 0.50;
      const gsMs = Math.hypot(this.vn, this.ve);
      // nosewheel steering: large angles at taxi speed, washing out to +-6 deg at high speed
      const steerMax = lerp(c.gear.steerMax, 6 * DEG, smoothstep(4, 22, gsMs));
      this.steer = approach(this.steer, clamp(ctl.steer !== undefined ? ctl.steer : ctl.yaw, -1, 1) * steerMax, 1.2 * dt);
      let fl = Math.hypot(r11, r21); const fwdN = r11 / fl, fwdE = r21 / fl;          // wheel heading on the ground plane
      for (const leg of this.legs) {
        leg.load = 0;
        if (!gearOk) { leg.comp = 0; continue; }
        const rx = leg.x, ry = leg.y, rz = leg.z;
        const pd = r31 * rx + r32 * ry + r33 * rz;
        const hPt = this.h - pd - gndH;
        if (hPt >= 0) { leg.comp = 0; leg.so = Math.max(0, leg.so - 1.2 * dt); continue; }
        const cz = Math.max(r33, 0.5), comp = Math.min(-hPt / cz, leg.soMax + leg.tireMax * 1.5);
        // velocity of the contact point
        const bx = this.q * rz - this.r * ry, by = this.r * rx - this.p * rz, bz = this.p * ry - this.q * rx;
        const vpn = this.vn + r11 * bx + r12 * by + r13 * bz, vpe = this.ve + r21 * bx + r22 * by + r23 * bz, vpd = this.vd + r31 * bx + r32 * by + r33 * bz;
        const compRate = vpd / cz;
        // oleo stroke follows from the force balance  tyre force = air spring + C*v|v| + c1*v
        let so = leg.so; const hS = dt / 6;                                                    // 6 sub-steps keep the stiff tyre/oleo pair stable
        for (let k = 0; k < 6; k++) {
          const Fair = leg.F0 * Math.pow(1 - so / leg.dg, -1.3), dF = leg.kt * (comp - so) - Fair, Co = dF > 0 ? leg.Cc * (1 + 2.5 * so / leg.stroke) : leg.Cr;   // metering pin: orifice closes with stroke
          const vk = sign(dF) * (-leg.c1 + Math.sqrt(leg.c1 * leg.c1 + 4 * Co * Math.abs(dF))) / (2 * Co);
          so = clamp(so + vk * hS, 0, leg.soMax);
        }
        const vo = (so - leg.so) / dt; leg.so = so; leg.soDot = vo;
        const dTire = comp - leg.so;
        let N = leg.kt * dTire + leg.ct * (compRate - vo);
        if (dTire > leg.tireMax) N += 6 * leg.kt * (dTire - leg.tireMax);                   // rim / bottoming
        if (N <= 0) { leg.comp = comp; continue; }
        leg.comp = comp; leg.load = N;
        if (leg.nose) nNose++; else nMain++;
        // wheel axes
        let wn_ = fwdN, we_ = fwdE;
        if (leg.nose) { const cs = Math.cos(this.steer), sn = Math.sin(this.steer); wn_ = fwdN * cs - fwdE * sn; we_ = fwdE * cs + fwdN * sn; }
        const vLong = vpn * wn_ + vpe * we_, vLat = -vpn * we_ + vpe * wn_;
        let muL = muRoll + (leg.nose ? 0 : this.brakeAct * muBrake);
        if (!leg.nose) brakeCap += this.brakeAct * muBrake * N;
        let Flong = -muL * N * sat(vLong / 0.4);
        let Flat = -muLat * N * sat(vLat / Math.max(0.16 * Math.abs(vLong), 0.45));
        const fmag = Math.hypot(Flong, Flat), fmax = 0.85 * N;
        if (fmag > fmax) { Flong *= fmax / fmag; Flat *= fmax / fmag; }
        // world force (n,e,d) then into body axes, applied at the (compressed) contact point
        const Fn = Flong * wn_ - Flat * we_, Fe = Flong * we_ + Flat * wn_, Fd = -N;
        const fbx = r11 * Fn + r21 * Fe + r31 * Fd, fby = r12 * Fn + r22 * Fe + r32 * Fd, fbz = r13 * Fn + r23 * Fe + r33 * Fd;
        const rzc = rz - comp;
        Fx += fbx; Fy += fby; Fz += fbz; gearFz += fbz;
        Mx += ry * fbz - rzc * fby; My += rzc * fbx - rx * fbz; Mz += rx * fby - ry * fbx;
      }
      // structural contact (strike) detection
      for (const cp of this.contactPts) {
        const px = cp.p[0], py = cp.p[1], pz = cp.p[2];
        const pd = r31 * px + r32 * py + r33 * pz;
        if (this.h - pd - gndH < 0) {
          const pn = r11 * px + r12 * py + r13 * pz, pe = r21 * px + r22 * py + r23 * pz;
          if (this.h - pd - env.groundHeight(this.n + pn, this.e + pe) < -0.05) this.events.push('strike:' + cp.n);
        }
      }
    } else { for (const leg of this.legs) { leg.comp = 0; leg.load = 0; leg.so = Math.max(0, leg.so - 1.2 * dt); } }
    const wasMain = this.mainWow;
    this.mainWow = nMain > 0; this.noseWow = nNose > 0; this.wow = nMain + nNose > 0;
    if (this.wow) { this.groundTime += dt; if (this.groundTime > 0.5) this.airTime = 0; } else { this.airTime += dt; if (this.airTime > 1) this.groundTime = 0; }
    // ground spoilers arm themselves once airborne and disarm at the end of the landing roll
    if (this.airTime > 5) this.groundSpoilerArmed = true;
    if (this.wow && o.gs < 25) this.groundSpoilerArmed = false;

    /* ---------- 8. load factor, touchdown capture ---------- */
    this.nz = -(FzAero + gearFz) / (m * G0);     // body-z specific force in g (1 in level flight)
    if (!this.mainWow) this.vdF = (this.vdF || 0) + (this.vd - (this.vdF || 0)) * Math.min(1, 5 * dt);      // sink rate averaged over ~0.2 s (gust-proof)
    if (this.mainWow && !wasMain) this.vdTouch = this.vd;
    if (this.mainWow && !wasMain && this.airTime > 2) {
      this.touchdown = { t: this.time, vs: Math.max(this.vdF || this.vd, 0), nzPeak: this.nz, n: this.n, e: this.e, hdg: o.hdg, track: o.track, gs: o.gs, ias: o.ias, pitch: o.pitch, roll: o.roll, bounces: 0 };
      this.events.push('touchdown');
    } else if (this.mainWow && !wasMain && this.touchdown && this.time - this.touchdown.t < 12) this.touchdown.bounces++;
    if (this.touchdown && this.time - this.touchdown.t < 1.5) this.touchdown.nzPeak = Math.max(this.touchdown.nzPeak, this.nz);

    /* ---------- 9. integrate (semi-implicit Euler) ---------- */
    const axb = Fx / m, ayb = Fy / m, azb = Fz / m;
    this.vn += (r11 * axb + r12 * ayb + r13 * azb) * dt;
    this.ve += (r21 * axb + r22 * ayb + r23 * azb) * dt;
    this.vd += (r31 * axb + r32 * ayb + r33 * azb + G0) * dt;
    // Euler's equations including the xz product of inertia (roll-yaw coupling)
    const Lr = Mx - (Izz - Iyy) * this.q * this.r + Ixz * this.p * this.q, Nr = Mz - (Iyy - Ixx) * this.p * this.q - Ixz * this.q * this.r, det = Ixx * Izz - Ixz * Ixz;
    const qDot = (My - (Ixx - Izz) * this.p * this.r - Ixz * (this.p * this.p - this.r * this.r)) / Iyy;
    this.p += (Izz * Lr + Ixz * Nr) / det * dt; this.r += (Ixz * Lr + Ixx * Nr) / det * dt; this.q += qDot * dt;
    // static friction lock: brakes hold the aircraft completely still against idle thrust
    if (this.wow && brakeCap > Math.abs(thrustTot) * 1.3 + 0.004 * m * G0 && Math.hypot(this.vn, this.ve) < 0.25) { this.vn = 0; this.ve = 0; this.r = 0; }
    this.n += this.vn * dt; this.e += this.ve * dt; this.h -= this.vd * dt;
    if (this.wow) this.distGround += Math.hypot(this.vn, this.ve) * dt;
    const hp = 0.5 * dt * this.p, hq = 0.5 * dt * this.q, hr = 0.5 * dt * this.r;
    const nw = w - x * hp - y * hq - z * hr, nx = x + w * hp + y * hr - z * hq, ny = y + w * hq + z * hp - x * hr, nzq = z + w * hr + x * hq - y * hp;
    const inv = 1 / Math.sqrt(nw * nw + nx * nx + ny * ny + nzq * nzq);
    this.q0 = nw * inv; this.q1 = nx * inv; this.q2 = ny * inv; this.q3 = nzq * inv;

    /* ---------- 10. outputs for instruments, warnings and the debug panel ---------- */
    o.alpha = alpha * RAD; o.beta = beta * RAD; o.CL = CL; o.CD = CD; o.lift = L; o.drag = D; o.side = Yf;
    o.thrust = thrustTot; o.weight = m * G0; o.qbar = qbar; o.aglFt = Math.max(0, agl) / FT; o.agl = agl;
    o.nz = this.nz; o.sigmaStall = sp; o.alphaStall = aPk * RAD; o.gearLoad = -gearFz;
    o.stallWarn = !this.wow && alpha > aPk - 0.045 && V > 20;
    o.stalled = !this.wow && alpha > aPk;
    o.ff = ffTot; o.groundH = gndH; o.ld = D > 1 ? L / D : 0;
    o.de = de * RAD; o.da = da * RAD; o.dr = dr * RAD;
  }
}
