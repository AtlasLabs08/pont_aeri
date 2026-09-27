/* Executor d una llico de l escola de vol: manté els fets en viu d un
 * intent, decideix quan s acaba i quin missatge toca a l instructor. NOU:
 * tasca C3 d ENGINEERING.md. Headless, provable a Node: no toca el DOM ni
 * Game. index.html li passa una instantania plana per pas de fisica, mes
 * els esdeveniments de vista (canvi de camera) i de comandament (una tecla
 * d Input que Game.onKey ja gestiona).
 *
 * EXPORTA: LessonRun lessonGoalParams attemptMessage
 *
 * IMPORTA: LESSONS, factsFromRecord i evaluate de career/.
 *
 * INTERFICIE (no la canviis, index.html i els tests en depenen):
 *   new LessonRun(lessonId)   llanca amb l id si es desconegut a LESSONS
 *
 *   run.sample(snap)   un cop per pas de fisica. No fa res si snap.replay
 *     es true (Game.state === 'replay') o si l intent ja ha acabat.
 *     Snapshot pla que index.html ha de construir:
 *       { replay, dt, altFt, aglFt, hdgDeg, iasKt, gsKt, vsFpm, onGround,
 *         gearDown, flapsLanding, vrefKt, distThrNm, distToThrM,
 *         latOffsetM, rwyHdgDeg, locDots, gsDots, locValid, gsValid }
 *     Els camps de l ILS (distThrNm, distToThrM, latOffsetM, rwyHdgDeg,
 *     locDots, gsDots, locValid, gsValid) poden ser null si no hi ha cap
 *     pista sintonitzada (Game.nav null): les llicons que els fan servir
 *     no avancen fins que n hi hagi.
 *   run.onView(view)   la camera activa ha canviat (Cameras.mode)
 *   run.onCommand(name)   el jugador ha accionat un comandament. name es
 *     un dels noms de LESSONS['cockpit'].controls
 *   run.crash()   Game.crashNow ha saltat: marca crashed i tanca l intent
 *
 *   run.facts   fets en viu acumulats fins ara (sempre inclou crashed)
 *   run.done   true un cop tancat (crash o finish)
 *   run.readyToEnd()   true si toca tancar l intent: crashed, criteris en
 *     viu complerts (llicons 1-4 i 6) o temps de D5 complert (llico 5).
 *     Sempre false per a les llicons 7 i 8 fora d un crash: aquestes
 *     nomes tanquen amb finish(record), quan Game calcula la nota.
 *   run.finish(record) -> facts   tanca l intent (si no ho estava ja) i
 *     retorna els fets combinats: factsFromRecord(record) mes els fets en
 *     viu, que guanyen en cas de xoc de clau (per exemple maxAltFt de la
 *     llico 4, en AGL, substitueix el del FlightRecord, que es en MSL)
 *   run.instructorMessage() -> { key, params }   text mentre l intent es
 *     en marxa: l objectiu de la llico, o a la llico 'cockpit' quin
 *     comandament toca provar. Es fa servir amb t() a index.html
 *
 * lessonGoalParams(lesson) -> params per a t(lesson.goalKey, params): el
 *   numero surt sempre de LESSONS, mai escrit al text d i18n.
 * attemptMessage({ passed, mercy, crashed }) -> { key, params }   missatge
 *   final un cop recordLessonAttempt (career/school.js) ja ha decidit el
 *   resultat (inclosa la gracia). No decideix passed/mercy: nomes tria el
 *   text.
 */

import { LESSONS, BALANCE, factsFromRecord, evaluate } from '../career/index.js';

function lessonById(lessonId) {
  const lesson = LESSONS.find(l => l.id === lessonId);
  if (!lesson) throw new Error('LessonRun: llico desconeguda: ' + lessonId);
  return lesson;
}

/** diferencia angular minima entre dos rumbs 0-360, sempre positiva */
function headingDelta(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function lessonGoalParams(lesson) {
  const value = metric => lesson.criteria.find(c => c.metric === metric)?.value;
  switch (lesson.id) {
    case 'exterior': return { count: value('viewsVisited') };
    case 'cockpit': return { count: value('controlsIdentified') };
    case 'takeoff': return { count: value('maxAltFt') };
    case 'maneuvers': return { count: value('altDeviationMaxFt') };
    case 'landing': return { score: BALANCE.school.passScore };
    default: return {};
  }
}

export function attemptMessage({ passed, mercy, crashed }) {
  if (crashed) return { key: 'school.instructor.crashed' };
  if (passed && mercy) return { key: 'school.instructor.mercyPassed' };
  if (passed) return { key: 'school.instructor.passed' };
  return { key: 'school.instructor.failed' };
}

export class LessonRun {
  constructor(lessonId) {
    this.lesson = lessonById(lessonId);
    this.done = false;
    this.facts = { crashed: false };
    this._seenViews = new Set();
    this._seenCommands = new Set();
    this._refAlt = null;
    this._lastHdg = null;
    this._elapsed = 0;
    this._streak = 0;
    if (this.lesson.id === 'exterior') this.facts.viewsVisited = 0;
    if (this.lesson.id === 'cockpit') this.facts.controlsIdentified = 0;
    if (this.lesson.id === 'taxi') this.facts.reachedThreshold = false;
    if (this.lesson.id === 'takeoff') { this.facts.maxAltFt = 0; this.facts.gearUp = false; }
    if (this.lesson.id === 'maneuvers') { this.facts.altDeviationMaxFt = 0; this.facts.headingChangeDeg = 0; }
    if (this.lesson.id === 'circuit') this.facts.stabilizedOnFinal = false;
    if (this.lesson.id === 'ils') this.facts.ilsFlown = false;
  }

  onView(view) {
    if (this.done) return;
    this._seenViews.add(view);
    if (this.lesson.id === 'exterior') this.facts.viewsVisited = this._seenViews.size;
  }

  onCommand(name) {
    if (this.done) return;
    if (this.lesson.id === 'cockpit' && this.lesson.controls.includes(name)) {
      this._seenCommands.add(name);
      this.facts.controlsIdentified = this._seenCommands.size;
    }
  }

  crash() {
    if (this.done) return;
    this.facts.crashed = true;
  }

  /** proper comandament que l instructor demana (llico 'cockpit'), o null */
  nextControl() {
    if (this.lesson.id !== 'cockpit') return null;
    return this.lesson.controls.find(c => !this._seenCommands.has(c)) ?? null;
  }

  sample(snap) {
    if (snap.replay || this.done) return;
    this._elapsed += snap.dt || 0;
    switch (this.lesson.id) {
      case 'taxi': {
        const T = this.lesson.taxi;
        if (snap.onGround && snap.distToThrM != null && snap.distToThrM <= T.maxDistToThrM
          && snap.latOffsetM != null && Math.abs(snap.latOffsetM) <= T.maxLatOffsetM
          && snap.gsKt != null && snap.gsKt <= T.maxGroundKt) this.facts.reachedThreshold = true;
        break;
      }
      case 'takeoff': {
        if (!snap.onGround) {
          if (snap.aglFt > this.facts.maxAltFt) this.facts.maxAltFt = snap.aglFt;
          if (!snap.gearDown) this.facts.gearUp = true;
        }
        break;
      }
      case 'maneuvers': {
        if (this._refAlt === null) this._refAlt = snap.altFt;
        const dev = Math.abs(snap.altFt - this._refAlt);
        if (dev > this.facts.altDeviationMaxFt) this.facts.altDeviationMaxFt = dev;
        if (this._lastHdg !== null) this.facts.headingChangeDeg += headingDelta(snap.hdgDeg, this._lastHdg);
        this._lastHdg = snap.hdgDeg;
        break;
      }
      case 'circuit': {
        const T = this.lesson.finalStabilized;
        const gateOk = snap.aglFt <= T.aglFt && snap.distThrNm != null && snap.distThrNm <= T.maxDistNm;
        const hdgOk = snap.rwyHdgDeg != null && headingDelta(snap.hdgDeg, snap.rwyHdgDeg) <= T.hdgToleranceDeg;
        const speedOk = snap.vrefKt != null && snap.iasKt >= snap.vrefKt + T.vrefLowKt && snap.iasKt <= snap.vrefKt + T.vrefHighKt;
        const sinkOk = snap.vsFpm >= -T.sinkMaxFpm;
        const ok = gateOk && hdgOk && snap.gearDown && snap.flapsLanding && speedOk && sinkOk;
        this._streak = ok ? this._streak + (snap.dt || 0) : 0;
        if (this._streak >= T.sustainedS) this.facts.stabilizedOnFinal = true;
        break;
      }
      case 'ils': {
        const T = this.lesson.ilsTolerance;
        const ok = snap.locValid && snap.gsValid && snap.locDots != null && snap.gsDots != null
          && Math.abs(snap.locDots) <= T.locDots && Math.abs(snap.gsDots) <= T.gsDots;
        this._streak = ok ? this._streak + (snap.dt || 0) : 0;
        if (this._streak >= T.sustainedS) this.facts.ilsFlown = true;
        break;
      }
      default: break;
    }
  }

  readyToEnd() {
    if (this.facts.crashed) return true;
    if (this.lesson.id === 'landing' || this.lesson.id === 'ils') return false;
    if (this.lesson.id === 'maneuvers') return this._elapsed >= this.lesson.durationS;
    return evaluate(this.lesson.criteria, this.facts).passed === true;
  }

  instructorMessage() {
    if (this.lesson.id === 'cockpit') {
      const next = this.nextControl();
      if (next) return { key: 'school.instructor.askControl', params: { control: next } };
    }
    return { key: this.lesson.goalKey, params: lessonGoalParams(this.lesson) };
  }

  finish(record) {
    if (this.done) return this.facts;
    this.done = true;
    this.facts = { ...factsFromRecord(record), ...this.facts };
    return this.facts;
  }
}
