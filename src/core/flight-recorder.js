/* Enregistrador de vol: resumeix un vol sencer en un FlightRecord, l unic
 * objecte que el simulador passa al mode Airline.
 * NOU: no ve de l original. Tasca A3 d ENGINEERING.md.
 *
 * EXPORTA: FlightRecorder CRASH_CAUSES EVENT_TYPES RECORD_KEYS
 *
 * IMPORTA: res. Nomes llegeix f.out, f.wow i ctl: no toca la fisica.
 *
 * INTERFICIE (no la canviis, el mode Airline i els tests en depenen):
 *   const r = new FlightRecorder();
 *   r.start(meta)               meta = { aircraftTypeId, from, to, fuelPlannedKg,
 *                                        paxOnBoard, plannedArrivalMin }
 *   r.sample(f, ctl, dt)        un cop per pas de fisica, DESPRES de f.step()
 *   r.setTimeAccel(k)           cada cop que canvia l acceleracio de temps
 *   r.cruiseSkip()              el jugador ha saltat el creuer
 *   r.event(type)               esdeveniment puntual, un de EVENT_TYPES
 *   r.touchdown(report, score)  quan Game calcula la nota (report.shown), NO a
 *                               onTouchdown: el pic de g i els rebots encara
 *                               s actualitzen durant 1,5 s despres del contacte
 *   r.rollout(metres)
 *   r.tailStrike()
 *   r.crash(cause)              un de CRASH_CAUSES; si no ho es, queda 'fuselage'
 *   r.finish({ arrivalMin }) -> FlightRecord (objecte pla i nou a cada crida)
 *
 * Per que el combustible s integra i no es resta: si l estat del model es
 * restaura (fdmRestore) o es reinicia, la resta de f.fuel queda falsejada.
 * Sumar f.out.ff * dt despres de cada pas dona el que ha cremat el motor.
 */

export const CRASH_CAUSES = ['water', 'terrain', 'excursion', 'gearUp',
  'hardImpact', 'wingStrike', 'engineStrike', 'fuselage'];

export const EVENT_TYPES = ['engineFailure', 'gearFault', 'hydraulicFault',
  'avionicsFault', 'stallWarning', 'overspeed', 'gpws', 'goAround', 'divert'];

/** claus d un FlightRecord, en l ordre de l esquema d ENGINEERING.md seccio 4 */
export const RECORD_KEYS = ['aircraftTypeId', 'from', 'to', 'blockSeconds',
  'airborneSeconds', 'fuelBurntKg', 'fuelPlannedKg', 'paxOnBoard', 'maxAltFt',
  'maxG', 'maxBankDeg', 'abruptInputs', 'timeAccelMax', 'usedCruiseSkip',
  'arrivalDeltaMin', 'touchdown', 'rolloutMetres', 'tailStrike', 'crashCause',
  'events'];

const STARTED_GS_KT = 3;        // com Game.flight: el bloc compta des que l avio es mou
const ABRUPT_RATE = 4;          // canvi de comandament (fraccio de recorregut per segon)
const ABRUPT_REFRACTORY_S = 1;  // una sacsejada dins d aquest temps compta com una

export class FlightRecorder {
  constructor() { this.meta = null; this.reset(); }

  reset() {
    this.started = false; this.block = 0; this.airborne = 0; this.fuel = 0;
    this.maxAlt = -Infinity; this.maxG = 1; this.maxBank = 0;
    this.abrupt = 0; this.lastAbrupt = -Infinity; this.lastPitch = null; this.lastRoll = null;
    this.accelMax = 1; this.skipped = false; this.td = null; this.rollM = 0;
    this.tail = false; this.crashCause = null; this.events = [];
  }

  start(meta) {
    if (!meta || !meta.aircraftTypeId || !meta.from || !meta.to) throw new TypeError('FlightRecorder.start: calen aircraftTypeId, from i to');
    this.reset();
    this.meta = { aircraftTypeId: meta.aircraftTypeId, from: meta.from, to: meta.to,
      fuelPlannedKg: meta.fuelPlannedKg || 0, paxOnBoard: meta.paxOnBoard || 0,
      plannedArrivalMin: meta.plannedArrivalMin !== undefined ? meta.plannedArrivalMin : null };
  }

  sample(f, ctl, dt) {
    const o = f.out;
    if (!this.started && o.gs > STARTED_GS_KT) this.started = true;
    if (this.started) this.block += dt;
    this.fuel += (o.ff || 0) * dt;
    if (o.altFt > this.maxAlt) this.maxAlt = o.altFt;
    if (!f.wow) {
      this.airborne += dt;
      if (o.nz > this.maxG) this.maxG = o.nz;
      const bank = Math.abs(o.roll); if (bank > this.maxBank) this.maxBank = bank;
      if (this.lastPitch !== null && dt > 0) {
        const rate = Math.max(Math.abs(ctl.pitch - this.lastPitch), Math.abs(ctl.roll - this.lastRoll)) / dt;
        if (rate > ABRUPT_RATE && this.block - this.lastAbrupt > ABRUPT_REFRACTORY_S) { this.abrupt++; this.lastAbrupt = this.block; }
      }
    }
    this.lastPitch = ctl.pitch; this.lastRoll = ctl.roll;
  }

  setTimeAccel(k) { if (k > this.accelMax) this.accelMax = k; }
  cruiseSkip() { this.skipped = true; }
  event(type) { this.events.push({ type, atSecond: this.block }); }
  rollout(metres) { this.rollM = metres; }
  tailStrike() { this.tail = true; }
  crash(cause) { this.crashCause = CRASH_CAUSES.includes(cause) ? cause : 'fuselage'; }

  touchdown(report, score) {
    const R = report, on = !!R.onRunway, g = R.gNow !== undefined ? R.gNow : R.g;
    this.td = { fpm: R.fpm, g, bounces: R.bounces || 0, onRunway: on, rwy: on ? R.rwy : null,
      tdzDist: on ? R.tdzDist : null, center: on ? R.center : null, crab: on ? R.crab : null,
      ias: R.ias, pitch: R.pitch, roll: R.roll,
      score: score.score, pts: { sink: score.pts.sink, g: score.pts.g, zone: score.pts.zone, center: score.pts.center, attitude: score.pts.attitude } };
  }

  finish(extra = {}) {
    if (!this.meta) throw new Error('FlightRecorder.finish sense start()');
    const m = this.meta;
    const arrival = extra.arrivalMin !== undefined && m.plannedArrivalMin !== null ? extra.arrivalMin - m.plannedArrivalMin : 0;
    return {
      aircraftTypeId: m.aircraftTypeId, from: m.from, to: m.to,
      blockSeconds: this.block, airborneSeconds: this.airborne,
      fuelBurntKg: this.fuel, fuelPlannedKg: m.fuelPlannedKg, paxOnBoard: m.paxOnBoard,
      maxAltFt: this.maxAlt === -Infinity ? 0 : this.maxAlt,
      maxG: this.maxG, maxBankDeg: this.maxBank, abruptInputs: this.abrupt,
      timeAccelMax: this.accelMax, usedCruiseSkip: this.skipped, arrivalDeltaMin: arrival,
      touchdown: this.td ? { ...this.td, pts: { ...this.td.pts } } : null,
      rolloutMetres: this.rollM, tailStrike: this.tail, crashCause: this.crashCause,
      events: this.events.map(e => ({ ...e }))
    };
  }
}
