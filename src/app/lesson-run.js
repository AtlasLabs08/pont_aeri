/* Executor d una llico de l escola de vol: manté els fets en viu d un
 * intent, decideix quan s acaba i quin missatge toca a l instructor. NOU:
 * tasca C3 d ENGINEERING.md. Headless, provable a Node: no toca el DOM ni
 * Game. index.html li passa una instantania plana per pas de fisica, mes
 * els esdeveniments de vista (canvi de camera) i de comandament (una tecla
 * d Input que Game.onKey ja gestiona).
 *
 * EXPORTA: LessonRun lessonGoalParams attemptMessage keyLabel messageText
 *          circuitGuidance
 *
 * IMPORTA: LESSONS, factsFromRecord i evaluate de career/; t de i18n/.
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
 *     Opcionals, respecte de la pista ASSIGNADA (Game.activeEnd, ILS.geom),
 *     no de la sintonitzada: asgAlongM (metres en el sentit d aterratge,
 *     negatiu abans del llindar), asgLatM (metres, positiu = a l esquerra
 *     de l eix), asgHdgDeg (rumb de la pista). Els fa servir la guia de la
 *     llico 'circuit': en vent en cua l ILS sintonitza el capcal contrari.
 *   run.onView(view)   la camera activa ha canviat (Cameras.mode)
 *   run.onCommand(name)   el jugador ha accionat un comandament. name es
 *     un dels noms de LESSONS['cockpit'].controls
 *   run.onKey(code)   el jugador ha premut una tecla (KeyboardEvent.code).
 *     index.html la crida a Game.onKey ABANS de qualsevol comprovacio que
 *     impedeixi l accio (tren a terra, inversors en vol): a la llico
 *     'cockpit' l objectiu es identificar el comandament, no fer-lo servir.
 *     Si code es a LESSONS['cockpit'].controlKeys, crida onCommand.
 *   run.crash()   Game.crashNow ha saltat: marca crashed i tanca l intent
 *
 *   run.thresholdMark() -> { fromM, toM, halfWidthM } | null   tram de la
 *     pista assignada que index.html ressalta en verd mentre l intent es en
 *     marxa: nomes les llicons amb dades taxi (lessons.js). fromM i toM son
 *     metres respecte del llindar en el sentit d aterratge (negatiu = abans),
 *     halfWidthM a cada banda de l eix. Surt dels llindars de reachedThreshold:
 *     maxDistToThrM a cada banda del llindar i maxLatOffsetM d amplada.
 *   run.facts   fets en viu acumulats fins ara (sempre inclou crashed)
 *   run.done   true un cop tancat (crash o finish)
 *   run.readyToEnd()   true si toca tancar l intent: crashed, criteris en
 *     viu complerts (llicons 1-4 i 6), temps de D5 complert (llico 5) o,
 *     a la llico 5, desviacio d altitud per sobre del llindar del criteri
 *     altDeviationMaxFt: suspen a l instant, sense esperar els 120 s
 *     (decisio d en Marc, docs/DECISIONS.md 28/09/2026).
 *   run.failReason() -> { key, params } | null   per que l intent ja no pot
 *     aprovar (ara nomes la desviacio d altitud de la llico 5, amb els peus
 *     de desviacio); null si no n hi ha cap.
 *     Sempre false per a les llicons 7 i 8 fora d un crash: aquestes
 *     nomes tanquen amb finish(record), quan Game calcula la nota.
 *   run.finish(record) -> facts   tanca l intent (si no ho estava ja) i
 *     retorna els fets combinats: factsFromRecord(record) mes els fets en
 *     viu, que guanyen en cas de xoc de clau (per exemple maxAltFt de la
 *     llico 4, en AGL, substitueix el del FlightRecord, que es en MSL)
 *   run.instructorMessage() -> { key, params, tParams? }   text mentre
 *     l intent es en marxa: l objectiu de la llico, o a la llico 'cockpit'
 *     quin comandament toca provar (params.control = nom, params.key =
 *     tecla, tParams.controlName = clau i18n del nom), o a la llico
 *     'circuit' el missatge de la fase del circuit (circuitGuidance). Es
 *     pinta amb messageText().
 *   run.circuit -> { phase, side, turnNow } | null   darrera guia de la
 *     llico 'circuit'; null fins a la primera instantania amb asg*.
 *
 * lessonGoalParams(lesson) -> params per a t(lesson.goalKey, params): el
 *   numero surt sempre de LESSONS, mai escrit al text d i18n.
 * keyLabel(code) -> etiqueta curta d una tecla: 'KeyG' -> 'G', 'ShiftLeft'
 *   -> 'Shift'. Noms de tecla, no text traduible.
 * messageText({ key, params, tParams }) -> text amb t(): cada tParams[nom]
 *   es una clau i18n que es tradueix i s interpola com a {nom}. Els params
 *   numerics (menys count, que tria el plural) es formaten amb fmtNumber.
 * circuitGuidance({ alongM, latM, hdgDeg, rwyHdgDeg }, guidance)
 *   -> { phase, side, turnNow }   fase del circuit segons la posicio respecte
 *   de la pista (els angles i distancies son a LESSONS['circuit'].guidance):
 *     'downwind'  el llindar encara no es baseTurnDeg enrere del travers
 *     'base'      ja ho es, i l eix queda mes lluny de finalTurnLatM
 *     'finalTurn' l eix queda a finalTurnLatM o menys
 *     'final'     abans del llindar i amb rumb de pista (+-alignedDeg)
 *   side: 'left' | 'right', cap a on girar per anar al rumb del tram
 *   seguent (base: perpendicular a la pista cap a l eix; final: rumb de
 *   pista), pel cami curt; null si no cal girar ('downwind', 'final', o
 *   ja establert en base). turnNow: el rumb encara es a mes d alignedDeg
 *   del d aquest tram (base o final).
 * attemptMessage({ passed, mercy, crashed, reason }) -> { key, params }
 *   missatge final un cop recordLessonAttempt (career/school.js) ja ha
 *   decidit el resultat (inclosa la gracia). No decideix passed/mercy:
 *   nomes tria el text. reason (opcional) es run.failReason(): si l intent
 *   ha suspes sense crash, es el missatge.
 */

import { LESSONS, BALANCE, factsFromRecord, evaluate } from '../career/index.js';
import { t, fmtNumber } from '../i18n/index.js';

const SECONDS_PER_MINUTE = 60;

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
    case 'maneuvers': return { deg: value('headingChangeDeg'), ft: value('altDeviationMaxFt'),
      min: lesson.durationS / SECONDS_PER_MINUTE };
    case 'landing': return { score: BALANCE.school.passScore };
    default: return {};
  }
}

/** diferencia de rumb amb signe (b - a), -180..180: positiu = cap a la dreta */
function headingDiff(a, b) {
  const d = ((b - a) % 360 + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

export function circuitGuidance({ alongM, latM, hdgDeg, rwyHdgDeg }, G) {
  const RAD = 180 / Math.PI;
  const toFinal = headingDiff(hdgDeg, rwyHdgDeg);
  if (alongM < 0 && Math.abs(toFinal) <= G.alignedDeg) return { phase: 'final', side: null, turnNow: false };
  const behindDeg = Math.atan2(-alongM, Math.abs(latM)) * RAD;
  if (behindDeg < G.baseTurnDeg) return { phase: 'downwind', side: null, turnNow: false };
  const sideOf = d => (d >= 0 ? 'right' : 'left');
  if (Math.abs(latM) > G.finalTurnLatM) {
    // base: perpendicular a la pista, cap a l eix (latM positiu = a l esquerra)
    const toBase = headingDiff(hdgDeg, rwyHdgDeg + (latM > 0 ? 90 : -90));
    const turnNow = Math.abs(toBase) > G.alignedDeg;
    return { phase: 'base', side: turnNow ? sideOf(toBase) : null, turnNow };
  }
  return { phase: 'finalTurn', side: sideOf(toFinal), turnNow: true };
}

/** condicions de D6 (finalStabilized de lessons.js) en una instantania */
function stabilizedChecks(snap, T) {
  return {
    gate: snap.aglFt <= T.aglFt && snap.distThrNm != null && snap.distThrNm <= T.maxDistNm,
    alignment: snap.rwyHdgDeg != null && headingDelta(snap.hdgDeg, snap.rwyHdgDeg) <= T.hdgToleranceDeg,
    gear: snap.gearDown === true,
    flaps: snap.flapsLanding === true,
    speed: snap.vrefKt != null && snap.iasKt >= snap.vrefKt + T.vrefLowKt && snap.iasKt <= snap.vrefKt + T.vrefHighKt,
    sink: snap.vsFpm >= -T.sinkMaxFpm
  };
}

export function keyLabel(code) {
  return code.replace(/^(Key|Digit)/, '').replace(/(Left|Right)$/, '');
}

export function messageText({ key, params, tParams }) {
  const all = {};
  for (const [name, v] of Object.entries(params || {})) all[name] = typeof v === 'number' && name !== 'count' ? fmtNumber(v) : v;
  for (const [name, k] of Object.entries(tParams || {})) all[name] = t(k);
  return t(key, all);
}

export function attemptMessage({ passed, mercy, crashed, reason }) {
  if (crashed) return { key: 'school.instructor.crashed' };
  if (!passed && reason) return reason;
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
    this.circuit = null;
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

  onKey(code) {
    if (this.done || !this.lesson.controlKeys) return;
    const name = this.lesson.controls.find(c => this.lesson.controlKeys[c].includes(code));
    if (name) this.onCommand(name);
  }

  crash() {
    if (this.done) return;
    this.facts.crashed = true;
  }

  thresholdMark() {
    const T = this.lesson.taxi;
    if (!T || this.done) return null;
    return { fromM: -T.maxDistToThrM, toM: T.maxDistToThrM, halfWidthM: T.maxLatOffsetM };
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
        if (snap.asgAlongM != null && snap.asgLatM != null && snap.asgHdgDeg != null) {
          this.circuit = circuitGuidance({ alongM: snap.asgAlongM, latM: snap.asgLatM,
            hdgDeg: snap.hdgDeg, rwyHdgDeg: snap.asgHdgDeg }, this.lesson.guidance);
        }
        const T = this.lesson.finalStabilized;
        const ok = Object.values(stabilizedChecks(snap, T)).every(Boolean);
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

  /** llindar d un criteri de la llico (value), o undefined */
  _target(metric) { return this.lesson.criteria.find(c => c.metric === metric)?.value; }

  failReason() {
    if (this.lesson.id !== 'maneuvers') return null;
    const dev = this.facts.altDeviationMaxFt;
    if (!(dev > this._target('altDeviationMaxFt'))) return null;
    return { key: 'school.instructor.altDeviation', params: { ft: Math.round(dev) } };
  }

  readyToEnd() {
    if (this.facts.crashed) return true;
    if (this.lesson.id === 'landing' || this.lesson.id === 'ils') return false;
    if (this.lesson.id === 'maneuvers') return this._elapsed >= this.lesson.durationS || this.failReason() !== null;
    return evaluate(this.lesson.criteria, this.facts).passed === true;
  }

  instructorMessage() {
    if (this.lesson.id === 'cockpit') {
      const next = this.nextControl();
      if (next) return { key: 'school.instructor.askControl',
        params: { control: next, key: keyLabel(this.lesson.controlKeys[next][0]) },
        tParams: { controlName: 'school.control.' + next } };
    }
    if (this.lesson.id === 'circuit' && this.circuit) return this._circuitMessage();
    return { key: this.lesson.goalKey, params: lessonGoalParams(this.lesson) };
  }

  /** missatge de l instructor per a la fase del circuit en curs */
  _circuitMessage() {
    const { phase, side, turnNow } = this.circuit;
    const sideKey = { tParams: { side: 'school.side.' + side } };
    switch (phase) {
      case 'downwind': return { key: 'school.circuit.downwind', params: { ft: this.lesson.spawn.aglFt } };
      case 'base': return turnNow ? { key: 'school.circuit.turnBase', ...sideKey } : { key: 'school.circuit.descend' };
      case 'finalTurn': return { key: 'school.circuit.turnFinal', ...sideKey };
      default: return { key: 'school.circuit.final', params: { ft: this.lesson.finalStabilized.aglFt } };
    }
  }

  finish(record) {
    if (this.done) return this.facts;
    this.done = true;
    this.facts = { ...factsFromRecord(record), ...this.facts };
    return this.facts;
  }
}
