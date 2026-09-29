/* Mesura de l estabilitat del tren i del capcineig, avio per avio.
 * Tres escenaris headless del model de vol real (Harness a src/core/harness.js,
 * els mateixos que fan servir les files de Harness.run):
 *   1. treure el fre d aparcament amb tota la potencia: amplitud maxima del
 *      transitori de capcineig i temps fins que s apaga
 *   2. contacte ferm a uns 400 fpm: rebots (tren principal + morro) i temps
 *      fins que s apaga, des del final del cop del morro
 *   3. en vol trimat a ralenti, pas a potencia maxima: desviacio maxima de
 *      capcineig en 10 s (cap amunt / cap avall)
 *   4. el mateix pas de potencia (ralenti -> maxima i maxima -> ralenti) seguit
 *      60 s, fugoide inclosa (Harness.powerResponse): excés de capcineig i
 *      desviacio d altitud respecte de l equilibri final (actitud i trajectoria
 *      amb la palanca nova i el mateix trim), sobreoscil.lacions i, nomes com a
 *      informacio, el temps fins que s apaga
 * I una segona taula de qualitats de vol (nomes aqui, no al harness), per
 * comparar l estabilitat i l amortiment dels avions entre ells: a 10.000 ft,
 * jets a 250 kt i turbohelix a 1,6 x la velocitat de perdua neta, massa
 * tipica, comandaments fixos:
 *   - periode curt: impuls de profundor (0,2 durant 0,5 s): pic d alfa i
 *     sobrepassament
 *   - balanceig holandes: impuls de direccio (0,3 durant 0,5 s): esmorteiment
 *     (decrement logaritmic de beta) i relacio phi/beta
 *   - balanceig: esglao d aleto del 50 %: velocitat de balanceig a 3 s i
 *     constant de temps (63 %)
 *   - espiral: 20 graus d inclinacio i comandaments deixats: inclinacio 20 s
 *     despres
 * No forma part de npm test: dona informacio, no un si o un no.
 *
 * Correr:  node tools/estabilitat.mjs [id ...]
 */

import {
  AIRCRAFT, AIRCRAFT_ORDER, Harness, FlightModel, Autopilot, trimAircraft, newCtl,
  FLAT_ENV_AIR, PHYS_DT, KT, FT, RAD, DEG
} from '../src/core/index.js';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : AIRCRAFT_ORDER;
const f = (v, d = 2) => (isFinite(v) ? v.toFixed(d) : String(v));
const table = (rows) => {
  console.log('| ' + rows[0].join(' | ') + ' |');
  console.log('|' + rows[0].map((_, i) => (i ? ' ---: ' : ' --- ')).join('|') + '|');
  for (const r of rows.slice(1)) console.log('| ' + r.join(' | ') + ' |');
};

const rows = [['avio', 'fre: amp (deg)', 'fre: h (cm)', 'fre: t (s)', 'toc: fpm', 'toc: rebots', 'toc: rebot CG (cm)', 'toc: g', 'toc: t (s)', 'pot: amunt (deg)', 'pot: avall (deg)']];
for (const id of ids) {
  const cfg = AIRCRAFT[id], br = Harness.brakeRelease(cfg), fc = Harness.firmContact(cfg, 400), ps = Harness.powerStep(cfg);
  rows.push([`${id} (${cfg.name})`, f(br.amp), f(br.hAmp * 100, 1), f(br.tSettle), f(fc.fpm, 0),
    `${fc.bounces} (${fc.mainBounces}+${fc.noseBounces})`, f(fc.rebound * 100, 1), f(fc.peakG), f(fc.tSettle), f(ps.up), f(ps.down)]);
}
table(rows);

/* ---- canvi gran de potencia, 60 s ---- */
console.log('');
const pr = [['avio', 'pas', 'capcineig (deg)', 'altitud (ft)', 'sobreoscil.lacions', 't (s, info)', 'equilibri: actitud (deg)', 'equilibri: vs (fpm)']];
for (const id of ids) for (const dir of ['up', 'down']) {
  const r = Harness.powerResponse(AIRCRAFT[id], dir);
  pr.push([`${id} (${AIRCRAFT[id].name})`, dir === 'up' ? 'ralenti -> max' : 'max -> ralenti', f(r.pitchDev, 1), f(r.altDev, 0), r.overshoots, f(r.tSettle, 1), f(r.thEq, 1), f(r.vsEq, 0)]);
}
table(pr);

/* ---- qualitats de vol ---- */
function trimmed(cfg) {
  const fm = new FlightModel(cfg), ctl = newCtl(), mass = cfg.mass.typical, fuel = cfg.mass.typFuel;
  fm.reset({ mass, fuel });
  const cas = cfg.type === 'jet' ? 250 * KT : 1.6 * fm.stallSpeed(0);
  const tr = trimAircraft(fm, { cas, alt: 10000 * FT, gamma: 0, flaps: 0, gearDown: false, mass, fuel });
  ctl.gearDown = false; ctl.trim = tr.trim; ctl.throttle = tr.throttle;
  return { fm, ctl, cas };
}
/** pics d una oscil.lacio: freq amortida i esmorteiment pel decrement logaritmic entre el 1r i el 3r pic */
function oscillation(x, from) {
  const pk = [];
  for (let i = from + 1; i < x.length - 1; i++) if (Math.abs(x[i]) > Math.abs(x[i - 1]) && Math.abs(x[i]) >= Math.abs(x[i + 1]) && Math.abs(x[i]) > 1e-4) pk.push([i * PHYS_DT, x[i]]);
  if (pk.length < 3) return { wd: NaN, zeta: NaN };
  const dec = Math.log(Math.abs(pk[0][1] / pk[2][1]));
  return { wd: Math.PI / ((pk[2][0] - pk[0][0]) / 2), zeta: dec / Math.sqrt(4 * Math.PI * Math.PI + dec * dec) };
}
function handling(cfg) {
  let { fm, ctl, cas } = trimmed(cfg);
  const a0 = fm.out.alpha, al = [];
  for (let i = 0; i < 120 * 8; i++) { ctl.pitch = i < 60 ? 0.2 : 0; fm.step(PHYS_DT, ctl, FLAT_ENV_AIR); al.push(fm.out.alpha - a0); }
  const alPk = Math.max(...al), spOver = -Math.min(...al.slice(al.indexOf(alPk))) / alPk;
  ({ fm, ctl } = trimmed(cfg)); const b = [], ph = [];
  for (let i = 0; i < 120 * 30; i++) { ctl.yaw = i < 60 ? 0.3 : 0; fm.step(PHYS_DT, ctl, FLAT_ENV_AIR); b.push(fm.out.beta); ph.push(fm.out.roll); }
  const dr = oscillation(b, 60), phiBeta = Math.max(...ph.map(Math.abs)) / Math.max(...b.map(Math.abs));
  ({ fm, ctl } = trimmed(cfg)); const p = [];
  for (let i = 0; i < 120 * 3; i++) { ctl.roll = 0.5; fm.step(PHYS_DT, ctl, FLAT_ENV_AIR); p.push(fm.p * RAD); }
  const pss = p[p.length - 1], tau = p.findIndex(v => v >= 0.632 * pss) * PHYS_DT;
  ({ fm, ctl } = trimmed(cfg)); const ap = new Autopilot(fm); ap.resetLoops();
  for (let i = 0; i < 120 * 15 && Math.abs(fm.out.roll - 20) > 0.2; i++) { ctl.roll = ap.rollLoop(20 * DEG, PHYS_DT); fm.step(PHYS_DT, ctl, FLAT_ENV_AIR); }
  ctl.roll = 0; for (let i = 0; i < 120 * 20; i++) fm.step(PHYS_DT, ctl, FLAT_ENV_AIR);
  return { cas: cas / KT, alPk, spOver, drW: dr.wd, drZeta: dr.zeta, phiBeta, pss, tau, spiral: fm.out.roll };
}
console.log('');
const hq = [['avio', 'kt', 'curt: alfa (deg)', 'curt: sobrepassa', 'holandes: w (rad/s)', 'holandes: esmorteiment', 'phi/beta', 'balanceig (deg/s)', 'balanceig: tau (s)', 'espiral 20 -> (deg)']];
for (const id of ids) {
  const h = handling(AIRCRAFT[id]);
  hq.push([`${id} (${AIRCRAFT[id].name})`, f(h.cas, 0), f(h.alPk), f(h.spOver), f(h.drW), f(h.drZeta), f(h.phiBeta, 1), f(h.pss, 1), f(h.tau), f(h.spiral, 1)]);
}
table(hq);
