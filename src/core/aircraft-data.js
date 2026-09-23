/* Configuracio dels quatre avions.
 * ORIGEN: linies 198-431 de l'original (SECTION 2).
 *
 * EXPORTA: AIRCRAFT AIRCRAFT_ORDER
 *
 * IMPORTA: DEG de ./constants.js
 *
 * NOTA: a mitja termini aixo hauria de sortir del codi i anar a
 *       data/aircraft/*.json. Ara no toca: primer que funcioni.
 */

import { DEG } from './constants.js';

/* Shared notes on the fields
   mass      empty (OEW), typical (default game take-off mass), mtow, mlw, maxFuel
   geom      S wing area m2, b span m, c mean aerodynamic chord m
   inertia   Ixx/Iyy/Izz/Ixz at refMass (kg m2) - scaled linearly with actual mass
   aero      non-dimensional stability & control derivatives (per radian)
   flaps     per detent: slat extension (0..1), drag/pitching increments, 1-g stall speed (kt CAS at
             vsRefMass) and the flap limit speed VFE. CLmax for every detent is DERIVED
             from these stall speeds when the flight model is built.
   engines   static thrust (jets, N) or shaft power (turboprop, W) per engine + positions
   gear      strut positions (x,y) and geometry, spring rates are derived from load share
   expect    realistic ranges for the category, checked by the headless test harness   */

export const AIRCRAFT = {

  /* ------------------------------------------------------------------ 1 -- */
  tp: {
    id: 'tp', name: 'Garbí G-72', category: 'Regional turboprop', basedOn: 'ATR 72 class',
    airline: 'Velanta Regional', type: 'turboprop', cockpit: 'turboprop',
    livery: { base: '#f4f5f2', main: '#0c7c7a', accent: '#f2b632', belly: '#d9dcdc', tail: '#0c7c7a' },
    mass: { empty: 13300, typical: 20800, mtow: 23000, mlw: 22350, maxFuel: 5000, typFuel: 1900 },
    geom: { S: 61.0, b: 27.05, c: 2.30 },
    inertia: { refMass: 21000, Ixx: 2.2e5, Iyy: 5.1e5, Izz: 7.6e5, Ixz: 1.2e4 },
    aero: {
      CL0: 0.40, CLa: 5.6, CLde: 0.40, CD0: 0.0270, e: 0.80, Mcrit: 0.60,
      Cm0: 0.050, Cma: -1.40, Cmq: -22, Cmadot: -5.0, Cmde: -1.60,
      CYb: -0.90, CYdr: 0.20,
      Clb: -0.11, Clp: -0.50, Clr: 0.13, Clda: 0.130, Cldr: 0.008,
      Cnb: 0.13, Cnp: -0.06, Cnr: -0.20, Cnda: -0.018, Cndr: 0.100,
      dCDgear: 0.022, deMax: 25 * DEG, daMax: 20 * DEG, drMax: 27 * DEG,
      trimRange: [-14 * DEG, 5 * DEG],      // elevator-equivalent trim authority (nose-up, nose-down)
      slatDAlpha: 0, flapDAlpha: 0.1 * DEG, // no slats; stall-angle change due to slats / full flap
      clmaxCal: 1.0                          // calibration factor found with the test harness
    },
    vsRefMass: 22000,
    flaps: [
      { name: '0',  deg: 0,  slat: 0, dCD: 0.000, dCm: 0.00,  vs: 110, vfe: 999 },
      { name: '15', deg: 15, slat: 0, dAlpha: -2.6 * DEG, dCD: 0.012, dCm: -0.04, vs: 100, vfe: 185 },
      { name: '30', deg: 30, slat: 0, dCD: 0.050, dCm: -0.09, vs: 90,  vfe: 150 }
    ],
    flapTO: 1, flapLDG: 2, flapRate: 0.30,       // detents per second
    limits: { vmo: 250, mmo: 0.55, vle: 185, ceiling: 25000 },
    engines: {
      n: 2, power: 1846e3, staticThrust: 30000, propEff: 0.85, flatRate: 1.15,
      psfc: 0.29 / 3.6e6,                   // kg per joule (0.29 kg/kWh)
      idleFF: 0.030,                        // kg/s per engine at idle
      spool: { a0: 0.30, a1: 0.85 },        // fast: constant-speed prop, torque follows the lever
      reverseFrac: 0.50, propDragArea: 12.1,
      pos: [[1.4, -4.05, -1.05], [1.4, 4.05, -1.05]]   // x,y,z body (above the CG: high wing)
    },
    gear: {
      zStatic: 1.75, stroke: 0.46, tireDefl: 0.05, orifice: 0.15,
      nose: { x: 9.90, y: 0 }, mains: [{ x: -0.87, y: -2.05 }, { x: -0.87, y: 2.05 }],
      steerMax: 60 * DEG, transit: 7
    },
    contact: {   // structural contact points (body axes) used for strike / crash detection
      wingtip: [-0.5, 13.5, -1.25], engine: [1.6, 4.05, 0.35], tailStrikeDeg: 8.5, tailX: -12.5,
      nose: [10.8, 0, 0.9], belly: [0, 0, 1.25]
    },
    eye: [9.55, -0.48, -0.55],
    model: { length: 27.2, noseX: 11.6, fuseR: 1.38, wing: 'high', sweep: 3, tail: 'T' },
    test: { toMass: 23000, ldgMass: 22350, rotPitch: 8, climbPitchMax: 14 },
    expect: {
      vr: [100, 118], toRoll: [750, 1350], to35: [1000, 1650], climb: [1000, 2100],
      vsClean: [108, 118], vsFull: [87, 96], vapp: [108, 122], appPitch: [0, 1], ldgRoll: [400, 850], ldgDist: [800, 1400]
    }
  },

  /* ------------------------------------------------------------------ 2 -- */
  nb: {
    id: 'nb', name: 'Mestral M-200', category: 'Narrow-body twinjet', basedOn: 'A320 / 737 class',
    airline: 'Solquer', type: 'jet', cockpit: 'sidestick',
    livery: { base: '#fbfbf8', main: '#e2571c', accent: '#ffb319', belly: '#c9ccd1', tail: '#e2571c' },
    mass: { empty: 42600, typical: 66000, mtow: 78000, mlw: 66000, maxFuel: 19000, typFuel: 6500 },
    geom: { S: 122.6, b: 35.8, c: 4.19 },
    inertia: { refMass: 64000, Ixx: 1.30e6, Iyy: 3.20e6, Izz: 4.40e6, Ixz: 7.0e4 },
    aero: {
      CL0: 0.25, CLa: 5.2, CLde: 0.36, CD0: 0.0200, e: 0.80, Mcrit: 0.775,
      Cm0: 0.055, Cma: -1.30, Cmq: -20, Cmadot: -4.0, Cmde: -1.35,
      CYb: -0.95, CYdr: 0.18,
      Clb: -0.13, Clp: -0.42, Clr: 0.12, Clda: 0.100, Cldr: 0.007,
      Cnb: 0.15, Cnp: -0.08, Cnr: -0.25, Cnda: -0.010, Cndr: 0.105,
      dCDgear: 0.020, deMax: 25 * DEG, daMax: 20 * DEG, drMax: 25 * DEG,
      trimRange: [-13.5 * DEG, 4 * DEG], slatDAlpha: 7.7 * DEG, flapDAlpha: -2.5 * DEG, clmaxCal: 1.0
    },
    vsRefMass: 64000,
    flaps: [
      { name: '0',    deg: 0,  slat: 0, dCD: 0.000, dCm: 0.00,  vs: 150, vfe: 999 },
      { name: '1',    deg: 10, slat: 0.7, dCD: 0.012, dCm: -0.02, vs: 126, vfe: 215 },
      { name: '2',    deg: 15, slat: 0.8, dCD: 0.028, dCm: -0.05, vs: 119, vfe: 200 },
      { name: '3',    deg: 20, slat: 0.8, dCD: 0.048, dCm: -0.07, vs: 114, vfe: 185 },
      { name: 'FULL', deg: 35, slat: 1, dCD: 0.085, dCm: -0.10, vs: 110, vfe: 177 }
    ],
    flapTO: 1, flapLDG: 4, flapRate: 0.28,
    limits: { vmo: 350, mmo: 0.82, vle: 280, ceiling: 39800 },
    engines: {
      n: 2, thrust: 120000, idleN1: 0.22, tsfc0: 0.34, tsfcM: 0.36,   // tsfc in 1/h (kg per kgf-hour)
      idleFF: 0.085, spool: { a0: 0.060, a1: 0.36 }, reverseFrac: 0.42,
      pos: [[2.2, -5.75, 1.45], [2.2, 5.75, 1.45]]
    },
    gear: {
      zStatic: 3.35, stroke: 0.50, tireDefl: 0.07, orifice: 0.13,
      nose: { x: 11.60, y: 0 }, mains: [{ x: -1.04, y: -3.80 }, { x: -1.04, y: 3.80 }],
      steerMax: 70 * DEG, transit: 9
    },
    contact: {
      wingtip: [-5.0, 17.9, -0.75], engine: [2.6, 5.75, 2.72], tailStrikeDeg: 11.7, tailX: -17.0,
      nose: [16.2, 0, 1.2], belly: [0, 0, 1.95]
    },
    eye: [14.95, -0.53, -1.15],
    model: { length: 37.6, noseX: 17.4, fuseR: 1.98, wing: 'low', sweep: 25, tail: 'conv' },
    test: { toMass: 73500, ldgMass: 64500, rotPitch: 10, climbPitchMax: 17 },
    expect: {
      vr: [135, 155], toRoll: [1200, 2000], to35: [1500, 2400], climb: [2000, 3800],
      vsClean: [148, 160], vsFull: [107, 116], vapp: [132, 146], appPitch: [2.5, 3.5], ldgRoll: [650, 1300], ldgDist: [1100, 1900]
    }
  },

  /* ------------------------------------------------------------------ 3 -- */
  wb: {
    id: 'wb', name: 'Llevant L-900', category: 'Wide-body twinjet', basedOn: '777 / A350 class',
    airline: 'Nimbara', type: 'jet', cockpit: 'yoke',
    livery: { base: '#f7f7f4', main: '#14306b', accent: '#c9a04a', belly: '#14306b', tail: '#14306b' },
    mass: { empty: 167800, typical: 236000, mtow: 351500, mlw: 251300, maxFuel: 145500, typFuel: 26000 },
    geom: { S: 436.8, b: 64.8, c: 7.08 },
    inertia: { refMass: 250000, Ixx: 1.50e7, Iyy: 3.90e7, Izz: 5.30e7, Ixz: 8.0e5 },
    aero: {
      CL0: 0.25, CLa: 5.0, CLde: 0.34, CD0: 0.0160, e: 0.82, Mcrit: 0.835,
      Cm0: 0.055, Cma: -1.30, Cmq: -21, Cmadot: -4.0, Cmde: -1.30,
      CYb: -0.95, CYdr: 0.17,
      Clb: -0.15, Clp: -0.43, Clr: 0.11, Clda: 0.125, Cldr: 0.007,
      Cnb: 0.15, Cnp: -0.10, Cnr: -0.28, Cnda: -0.008, Cndr: 0.105,
      dCDgear: 0.018, deMax: 25 * DEG, daMax: 20 * DEG, drMax: 25 * DEG,
      trimRange: [-13 * DEG, 4 * DEG], slatDAlpha: 7.3 * DEG, flapDAlpha: -2.4 * DEG, clmaxCal: 1.0
    },
    vsRefMass: 251300,
    flaps: [
      { name: 'UP', deg: 0,  slat: 0, dCD: 0.000, dCm: 0.00,  vs: 165, vfe: 999 },
      { name: '1',  deg: 1,  slat: 0.6, dCD: 0.008, dCm: -0.01, vs: 150, vfe: 265 },
      { name: '5',  deg: 5,  slat: 0.6, dCD: 0.015, dCm: -0.03, vs: 141, vfe: 245 },
      { name: '15', deg: 15, slat: 0.8, dCD: 0.028, dCm: -0.05, vs: 134, vfe: 230 },
      { name: '20', deg: 20, slat: 0.8, dCD: 0.038, dCm: -0.06, vs: 130, vfe: 225 },
      { name: '25', deg: 25, slat: 1, dCD: 0.060, dCm: -0.08, vs: 125, vfe: 200 },
      { name: '30', deg: 30, slat: 1, dCD: 0.085, dCm: -0.10, vs: 121, vfe: 180 }
    ],
    flapTO: 3, flapLDG: 6, flapRate: 0.30,
    limits: { vmo: 330, mmo: 0.89, vle: 270, ceiling: 43100 },
    engines: {
      n: 2, thrust: 513000, idleN1: 0.21, tsfc0: 0.30, tsfcM: 0.33,
      idleFF: 0.30, spool: { a0: 0.045, a1: 0.30 }, reverseFrac: 0.34,
      pos: [[4.5, -9.6, 2.6], [4.5, 9.6, 2.6]]
    },
    gear: {
      zStatic: 5.15, stroke: 0.60, tireDefl: 0.09, orifice: 0.085,
      nose: { x: 28.7, y: 0 }, mains: [{ x: -2.5, y: -5.49 }, { x: -2.5, y: 5.49 }],
      steerMax: 70 * DEG, transit: 11
    },
    contact: {
      wingtip: [-13.0, 32.4, -1.9], engine: [5.0, 9.6, 4.55], tailStrikeDeg: 9.2, tailX: -34.0,
      nose: [32.5, 0, 1.6], belly: [0, 0, 3.0]
    },
    eye: [30.9, -0.55, -0.85],
    model: { length: 73.9, noseX: 34.0, fuseR: 3.10, wing: 'low', sweep: 31.6, tail: 'conv' },
    test: { toMass: 300000, ldgMass: 251300, rotPitch: 7.5, climbPitchMax: 16 },
    expect: {
      vr: [150, 178], toRoll: [1600, 2800], to35: [2000, 3300], climb: [1800, 3800],
      vsClean: [160, 172], vsFull: [117, 126], vapp: [146, 160], appPitch: [2, 3], ldgRoll: [900, 1800], ldgDist: [1350, 2400]
    }
  },

  /* ------------------------------------------------------------------ 4 -- */
  jumbo: {
    id: 'jumbo', name: 'Tramuntana T-4', category: 'Four-engine jumbo', basedOn: '747 class',
    airline: 'Aurelion Intercontinental', type: 'jet', cockpit: 'yoke4',
    livery: { base: '#faf9f5', main: '#a3122c', accent: '#1d2b4f', belly: '#cfd2d6', tail: '#a3122c' },
    mass: { empty: 183500, typical: 262000, mtow: 396900, mlw: 285800, maxFuel: 173000, typFuel: 32000 },
    geom: { S: 525.0, b: 64.4, c: 8.33 },
    inertia: { refMass: 288800, Ixx: 2.47e7, Iyy: 4.49e7, Izz: 6.74e7, Ixz: 1.3e6 },
    aero: {   // baseline from published 747 stability derivatives (approach condition)
      CL0: 0.25, CLa: 4.7, CLde: 0.338, CD0: 0.0165, e: 0.80, Mcrit: 0.855,
      Cm0: 0.055, Cma: -1.26, Cmq: -20.8, Cmadot: -3.2, Cmde: -1.34,
      CYb: -0.96, CYdr: 0.175,
      Clb: -0.17, Clp: -0.45, Clr: 0.101, Clda: 0.130, Cldr: 0.007,
      Cnb: 0.150, Cnp: -0.121, Cnr: -0.30, Cnda: -0.006, Cndr: 0.109,
      dCDgear: 0.020, deMax: 23 * DEG, daMax: 20 * DEG, drMax: 25 * DEG,
      trimRange: [-13 * DEG, 4 * DEG], slatDAlpha: 7.1 * DEG, flapDAlpha: -2.2 * DEG, clmaxCal: 1.0
    },
    vsRefMass: 285800,
    flaps: [
      { name: 'UP', deg: 0,  slat: 0, dCD: 0.000, dCm: 0.00,  vs: 170, vfe: 999 },
      { name: '1',  deg: 1,  slat: 0.6, dCD: 0.008, dCm: -0.01, vs: 155, vfe: 280 },
      { name: '5',  deg: 5,  slat: 0.7, dCD: 0.015, dCm: -0.02, vs: 145, vfe: 260 },
      { name: '10', deg: 10, slat: 0.8, dCD: 0.022, dCm: -0.04, vs: 138, vfe: 240 },
      { name: '20', deg: 20, slat: 0.9, dCD: 0.035, dCm: -0.06, vs: 131, vfe: 230 },
      { name: '25', deg: 25, slat: 1, dCD: 0.055, dCm: -0.08, vs: 127, vfe: 205 },
      { name: '30', deg: 30, slat: 1, dCD: 0.080, dCm: -0.10, vs: 123, vfe: 180 }
    ],
    flapTO: 4, flapLDG: 6, flapRate: 0.30,
    limits: { vmo: 365, mmo: 0.92, vle: 320, ceiling: 45100 },
    engines: {
      n: 4, thrust: 258000, idleN1: 0.22, tsfc0: 0.33, tsfcM: 0.35,
      idleFF: 0.20, spool: { a0: 0.050, a1: 0.32 }, reverseFrac: 0.34,
      pos: [[-3.5, -21.2, 1.9], [4.0, -11.7, 2.7], [4.0, 11.7, 2.7], [-3.5, 21.2, 1.9]]
    },
    gear: {
      zStatic: 5.25, stroke: 0.60, tireDefl: 0.09, orifice: 0.075,
      nose: { x: 23.45, y: 0 },
      mains: [{ x: -0.6, y: -5.5 }, { x: -0.6, y: 5.5 }, { x: -3.7, y: -1.9 }, { x: -3.7, y: 1.9 }],
      steerMax: 70 * DEG, transit: 12
    },
    contact: {
      wingtip: [-16.5, 32.2, -2.2], engine: [-3.0, 21.2, 3.35], engine2: [4.5, 11.7, 4.15],
      tailStrikeDeg: 11.3, tailX: -31.0, nose: [30.0, 0, 2.0], belly: [0, 0, 3.2]
    },
    eye: [26.0, -0.55, -3.55],
    model: { length: 70.7, noseX: 31.5, fuseR: 3.25, wing: 'low', sweep: 37.5, tail: 'conv', hump: true },
    test: { toMass: 350000, ldgMass: 285800, rotPitch: 9, climbPitchMax: 15 },
    expect: {
      vr: [150, 175], toRoll: [1800, 3000], to35: [2200, 3500], climb: [1500, 3200],
      vsClean: [165, 178], vsFull: [119, 128], vapp: [148, 163], appPitch: [1, 2.5], ldgRoll: [1000, 2000], ldgDist: [1400, 2600]
    }
  }
};
export const AIRCRAFT_ORDER = ['tp', 'nb', 'wb', 'jumbo'];
// static strut deflection = oleo at 80 % of its stroke + tyre deflection (used by the flight model and the 3D gear)
for (const id of AIRCRAFT_ORDER) { const g = AIRCRAFT[id].gear; g.staticDefl = 0.80 * g.stroke + g.tireDefl; }
