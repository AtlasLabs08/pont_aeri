/* Executor d una llico de l escola de vol: manté els fets en viu d un
 * intent, decideix quan s acaba i quin missatge toca a l instructor. NOU:
 * tasca C3 d ENGINEERING.md. Headless, provable a Node: no toca el DOM ni
 * Game. index.html li passa una instantania plana per pas de fisica, mes
 * els esdeveniments de vista (canvi de camera) i de comandament (una tecla
 * d Input que Game.onKey ja gestiona).
 *
 * EXPORTA: LessonRun lessonGoalParams attemptMessage keyLabel messageText
 *          circuitGuidance ilsGuidance
 *
 * IMPORTA: LESSONS, CONTROL_KEYS, factsFromRecord i evaluate de career/; t de i18n/;
 *   taxiRoute i nearestOnPolyline de world/.
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
 *     Opcional: hatFt, altura de les rodes sobre l elevacio de l aeroport
 *     de la pista sintonitzada (ILS.nav, hW), en ft; la llico 'ils' la fa
 *     servir com a altura AGL del tram de ilsFlown (lluny de la pista,
 *     l AGL del radioaltimetre inclou els turons de sota). Sense, aglFt.
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
 *   run.thresholdMark() -> { fromM, toM, halfWidthM } | null   zona objectiu
 *     de la pista assignada mentre l intent es en marxa: nomes les llicons
 *     amb dades taxi (lessons.js). index.html hi pinta una rodona verda
 *     fluorescent a terra, centrada al mig del tram sobre l eix i de radi
 *     halfWidthM, i una linia discontinua des de l avio fins a la rodona
 *     pel cami de taxiPath (docs/DECISIONS.md, 29/09/2026). fromM i toM son
 *     metres respecte del llindar en el sentit d aterratge (negatiu = abans),
 *     halfWidthM a cada banda de l eix. Surt dels llindars de reachedThreshold:
 *     maxDistToThrM a cada banda del llindar i maxLatOffsetM d amplada.
 *   run.taxiPath(A, en, pos) -> [[a, c], ...] | null   cami per les calles
 *     de rodatge (world/taxi.js, taxiRoute) des de pos fins al centre de
 *     thresholdMark, en coordenades locals d A (l aeroport, makeAirport); en
 *     es el cap de pista assignat i pos la posicio de l avio [a, c]. Comenca a
 *     pos, continua pel punt del cami mes proper (mai enrere del que ja ha
 *     fet) i acaba al centre de la rodona. El cami es desa i nomes es
 *     recalcula si canvia A o en, o si l avio se n allunya mes de
 *     LESSONS[..].taxi.rerouteM. null si la llico no te dades taxi, si
 *     l intent ha acabat o si no hi ha cami.
 *   run.facts   fets en viu acumulats fins ara (sempre inclou crashed)
 *   run.done   true un cop tancat (crash o finish)
 *   run.readyToEnd()   true si toca tancar l intent: crashed, criteris en
 *     viu complerts (llicons 1-4 i 6), temps de D5 complert (llico 5) o,
 *     a la llico 5, desviacio d altitud per sobre del llindar del criteri
 *     altDeviationMaxFt: suspen a l instant, sense esperar els 120 s
 *     (decisio d en Marc, docs/DECISIONS.md 28/09/2026).
 *   run.failReason() -> { key, params } | null   per que l intent ja no pot
 *     aprovar: la desviacio d altitud de la llico 5 (amb els peus de
 *     desviacio) o, a la llico 8, haver sortit de l ILS entre topAglFt i
 *     bottomAglFt (amb els punts de desviacio, o sense senyal); null si no
 *     n hi ha cap.
 *     Sempre false per a les llicons 7 i 8 fora d un crash: aquestes
 *     nomes tanquen amb finish(record), quan Game calcula la nota.
 *   run.finish(record) -> facts   tanca l intent (si no ho estava ja) i
 *     retorna els fets combinats: factsFromRecord(record) mes els fets en
 *     viu, que guanyen en cas de xoc de clau (per exemple maxAltFt de la
 *     llico 4: MSL, com el del FlightRecord, pero arrodonit a 10 ft com
 *     l altimetre del HUD, perque el jugador vegi el mateix numero a la
 *     llista i a l altimetre; docs/DECISIONS.md, 29/09/2026, D4 canviada)
 *   run.instructorMessage() -> { key, params, tParams? }   text mentre
 *     l intent es en marxa: l objectiu de la llico, o a la llico 'cockpit'
 *     quin comandament toca provar (params.control = nom, params.key =
 *     tecla, tParams.controlName = clau i18n del nom), o a la llico
 *     'circuit' el missatge de la fase del circuit (circuitGuidance), o a la
 *     llico 'ils' el de la fase de la intercepcio (ilsGuidance). Es pinta
 *     amb messageText().
 *   run.tips() -> [{ key, params }]   explicacions de l instructor que
 *     index.html mostra sota el missatge durant tot l intent, en l ordre de
 *     LESSONS[..].tips. params: els params de la dada (valors de lessons.js)
 *     mes cada tecla, keyLabel del primer codi del comandament a
 *     CONTROL_KEYS (lessons.js), mai escrita al text. [] si la llico no en
 *     te. Es pinten amb messageText().
 *   run.objectives() -> [{ id, labelKey, params, ok }]   llista d objectius
 *     per al HUD, generada dels criteris de la llico (lessons.js), mai
 *     escrita a ma per llico: una fila per criteri, amb el valor actual
 *     (params.value) i el llindar (params.target), i ok = el criteri es
 *     compleix. Per metric, no per llico: altDeviationMaxFt mostra la
 *     desviacio actual; stabilizedOnFinal s expandeix en totes les
 *     condicions de finalStabilized (distancia al llindar, altura AGL, tren,
 *     flaps, velocitat, sink, alineacio), una fila per condicio de D6, mes el
 *     temps sostingut: si el comptador no avanca, alguna fila no te tic.
 *     ilsFlown s expandeix en la desviacio actual del localitzador i de la
 *     senda (en punts, contra ilsTolerance) mes una fila per al tram de
 *     topAglFt a bottomAglFt.
 *     Si la llico te durationS, primer una fila timeLeft.
 *     labelKey = 'school.objective.' + id, amb messageText.
 *   run.circuit -> { phase, side, turnNow } | null   darrera guia de la
 *     llico 'circuit'; null fins a la primera instantania amb asg*.
 *   run.ils -> { phase, side } | null   darrera guia de la llico 'ils'
 *     (ilsGuidance); null fins a la primera instantania.
 *   ilsFlown (llico 'ils', docs/DECISIONS.md 29/09/2026): true quan l avio
 *     baixa de bottomAglFt despres d haver passat tot el tram de topAglFt a
 *     bottomAglFt (en vol) sense sortir mai de locDots ni de gsDots, amb el
 *     senyal del localitzador i de la senda valid. L altura es hatFt (sobre
 *     la pista) o, si no n hi ha, aglFt.
 *
 * lessonGoalParams(lesson) -> params per a t(lesson.goalKey, params): el
 *   numero surt sempre de LESSONS, mai escrit al text d i18n.
 * keyLabel(code) -> etiqueta curta d una tecla: 'KeyG' -> 'G', 'ShiftLeft'
 *   -> 'Shift', 'Minus' i 'NumpadSubtract' -> '-'. Noms de tecla, no text
 *   traduible.
 * messageText({ key, params, tParams }) -> text amb t(): cada tParams[nom]
 *   es una clau i18n que es tradueix i s interpola com a {nom}. Els params
 *   numerics (menys count, que tria el plural) es formaten amb fmtNumber:
 *   els enters sense decimals, la resta amb una.
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
 * ilsGuidance({ hdgDeg, rwyHdgDeg, locDots, gsDots, locValid, gsValid,
 *   hatFt, aglFt }, guidance, tolerance) -> { phase, side }   fase de la
 *   intercepcio de l ILS (guidance = LESSONS['ils'].guidance, tolerance =
 *   ilsTolerance):
 *     'land'        per sota de bottomAglFt (hatFt, o aglFt): mirar fora i
 *                   aterrar
 *     'noSignal'    encara sense localitzador valid
 *     'intercept'   agulla del localitzador a mes de locAliveDots: mantenir
 *                   el rumb d intercepcio. side: cap a on es l eix (l agulla)
 *     'joinLoc'     localitzador viu: girar al rumb de pista (side: cap a on
 *                   girar) o, ja al rumb, centrar l agulla (side: l agulla)
 *     'belowGs'     al localitzador, per sota de la senda (o sense senda):
 *                   mantenir l altitud fins que l agulla de senda baixi
 *     'aboveGs'     per sobre de la senda: baixar mes
 *     'established' les dues agulles dins de tolerancia
 * attemptMessage({ passed, mercy, crashed, reason }) -> { key, params }
 *   missatge final un cop recordLessonAttempt (career/school.js) ja ha
 *   decidit el resultat (inclosa la gracia). No decideix passed/mercy:
 *   nomes tria el text. reason (opcional) es run.failReason(): si l intent
 *   ha suspes sense crash, es el missatge.
 *   score (opcional) es la nota de l intent: l aprovat per gracia la diu
 *   (E3, docs/DECISIONS.md 30/09/2026), { key, params: { score } }.
 */

import { LESSONS, CONTROL_KEYS, BALANCE, factsFromRecord, evaluate } from '../career/index.js';
import { t, fmtNumber } from '../i18n/index.js';
import { taxiRoute, nearestOnPolyline } from '../world/index.js';

const SECONDS_PER_MINUTE = 60;
/** l altimetre del HUD (index.html) arrodoneix l altitud MSL a 10 ft */
const ALTIMETER_STEP_FT = 10;

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
    case 'ils': { const T = lesson.ilsTolerance;
      return { loc: T.locDots, gs: T.gsDots, top: T.topAglFt, bottom: T.bottomAglFt }; }
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

export function ilsGuidance({ hdgDeg, rwyHdgDeg, locDots, gsDots, locValid, gsValid, hatFt, aglFt }, G, T) {
  if ((hatFt ?? aglFt) < T.bottomAglFt) return { phase: 'land', side: null };
  if (!locValid || locDots == null || rwyHdgDeg == null) return { phase: 'noSignal', side: null };
  // locDots positiu: l avio es a l esquerra de l eix, l agulla (l eix) queda a la dreta
  const needle = locDots >= 0 ? 'right' : 'left';
  if (Math.abs(locDots) > G.locAliveDots) return { phase: 'intercept', side: needle };
  const toRwy = headingDiff(hdgDeg, rwyHdgDeg);
  if (Math.abs(toRwy) > G.alignedDeg) return { phase: 'joinLoc', side: toRwy >= 0 ? 'right' : 'left' };
  if (Math.abs(locDots) > T.locDots) return { phase: 'joinLoc', side: needle };
  // gsDots negatiu: per sota de la senda
  if (!gsValid || gsDots == null || gsDots < -T.gsDots) return { phase: 'belowGs', side: null };
  if (gsDots > T.gsDots) return { phase: 'aboveGs', side: null };
  return { phase: 'established', side: null };
}

/** desviacio absoluta en punts d una agulla, o null si no hi ha senyal */
const needleDots = (valid, dots) => (valid && dots != null ? Math.abs(dots) : null);

/** condicions de D6 (finalStabilized de lessons.js) en una instantania. El comptador
 * de sustainedS nomes avanca si es compleixen totes; la llista d objectius en mostra
 * una fila per clau, en aquest ordre, perque el jugador vegi sempre quina li falta */
function stabilizedChecks(snap, T) {
  return {
    distance: snap.distThrNm != null && snap.distThrNm <= T.maxDistNm,
    height: snap.aglFt <= T.aglFt,
    alignment: snap.rwyHdgDeg != null && headingDelta(snap.hdgDeg, snap.rwyHdgDeg) <= T.hdgToleranceDeg,
    gear: snap.gearDown === true,
    flaps: snap.flapsLanding === true,
    speed: snap.vrefKt != null && snap.iasKt >= snap.vrefKt + T.vrefLowKt && snap.iasKt <= snap.vrefKt + T.vrefHighKt,
    sink: snap.vsFpm >= -T.sinkMaxFpm
  };
}

const NO_VALUE = '—';
const shown = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NO_VALUE);
/** com shown, amb una decimal (distancies en nm) */
const shown1 = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : NO_VALUE);
const row = (id, params, ok) => ({ id, labelKey: 'school.objective.' + id, params, ok: ok === true });

/** files d objectiu dels metrics que no son un sol valor contra un llindar.
 * La resta de metrics fan servir la fila generica d objectiveRows. */
const OBJECTIVE_ROWS = {
  altDeviationMaxFt: (run, c) => [row('altDeviationMaxFt',
    { value: shown(run._devFt), target: c.value }, run.facts.altDeviationMaxFt <= c.value)],
  stabilizedOnFinal: (run, c) => {
    const T = run.lesson.finalStabilized, sn = run._snap, ok = sn ? stabilizedChecks(sn, T) : {};
    const vref = sn && sn.vrefKt != null ? sn.vrefKt : null;
    return [
      row('distance', { value: shown1(sn?.distThrNm), target: T.maxDistNm }, ok.distance),
      row('height', { value: shown(sn?.aglFt), target: T.aglFt }, ok.height),
      row('gear', {}, ok.gear),
      row('flaps', {}, ok.flaps),
      row('speed', { value: shown(sn?.iasKt), low: shown(vref === null ? null : vref + T.vrefLowKt),
        high: shown(vref === null ? null : vref + T.vrefHighKt) }, ok.speed),
      row('sink', { value: shown(sn ? Math.max(0, -sn.vsFpm) : null), target: T.sinkMaxFpm }, ok.sink),
      row('alignment', { value: shown(sn && sn.rwyHdgDeg != null ? headingDelta(sn.hdgDeg, sn.rwyHdgDeg) : null),
        target: T.hdgToleranceDeg }, ok.alignment),
      row(c.metric, { value: shown(run._streak), target: T.sustainedS }, run.facts[c.metric] === c.value)
    ];
  },
  ilsFlown: (run, c) => {
    const T = run.lesson.ilsTolerance, sn = run._snap;
    const loc = sn ? needleDots(sn.locValid, sn.locDots) : null, gs = sn ? needleDots(sn.gsValid, sn.gsDots) : null;
    return [
      row('locDots', { value: shown1(loc), target: T.locDots }, loc !== null && loc <= T.locDots),
      row('gsDots', { value: shown1(gs), target: T.gsDots }, gs !== null && gs <= T.gsDots),
      row(c.metric, { top: T.topAglFt, bottom: T.bottomAglFt }, run.facts[c.metric] === c.value)
    ];
  }
};

function objectiveRows(run) {
  const rows = [];
  if (run.lesson.durationS) {
    rows.push(row('timeLeft', { value: shown(Math.max(0, run.lesson.durationS - run._elapsed)) },
      run._elapsed >= run.lesson.durationS));
  }
  for (const c of run.lesson.criteria) {
    if (Object.hasOwn(OBJECTIVE_ROWS, c.metric)) { rows.push(...OBJECTIVE_ROWS[c.metric](run, c)); continue; }
    const [r] = evaluate([c], run.facts).results;
    rows.push(row(c.metric, { value: shown(r.value), target: r.target }, r.ok));
  }
  return rows;
}

const KEY_SYMBOLS = { Minus: '-', NumpadSubtract: '-', NumpadAdd: '+' };

export function keyLabel(code) {
  if (Object.hasOwn(KEY_SYMBOLS, code)) return KEY_SYMBOLS[code];
  return code.replace(/^(Key|Digit)/, '').replace(/(Left|Right)$/, '');
}

export function messageText({ key, params, tParams }) {
  const all = {};
  for (const [name, v] of Object.entries(params || {})) {
    all[name] = typeof v === 'number' && name !== 'count' ? fmtNumber(v, Number.isInteger(v) ? 0 : 1) : v;
  }
  for (const [name, k] of Object.entries(tParams || {})) all[name] = t(k);
  return t(key, all);
}

export function attemptMessage({ passed, mercy, crashed, reason, score }) {
  if (crashed) return { key: 'school.instructor.crashed' };
  if (!passed && reason) return reason;
  if (passed && mercy) return { key: 'school.instructor.mercyPassed', params: { score } };
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
    this._snap = null;
    this._devFt = null;
    this._taxi = null;
    this.ils = null;
    this._ilsBand = false;
    this._ilsOut = null;       // { dots } la pitjor sortida de l ILS dins del tram (dots null = sense senyal)
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

  taxiPath(A, en, pos) {
    const mark = this.thresholdMark();
    if (!mark) return null;
    const s = (mark.fromM + mark.toM) / 2, goal = [en.thr[0] + en.dir[0] * s, en.thr[1] + en.dir[1] * s];
    let r = this._taxi;
    const near = r && r.A === A && r.en === en && r.pts ? nearestOnPolyline(r.pts, pos, r.seg) : null;
    if (!near || near.dist > this.lesson.taxi.rerouteM) {
      const pts = taxiRoute(A, pos, goal);
      r = this._taxi = { A, en, pts, seg: 0 };
      if (!pts) return null;
      return pts;
    }
    r.seg = near.seg;
    return [pos, near.point, ...r.pts.slice(near.seg + 1)];
  }

  /** proper comandament que l instructor demana (llico 'cockpit'), o null */
  nextControl() {
    if (this.lesson.id !== 'cockpit') return null;
    return this.lesson.controls.find(c => !this._seenCommands.has(c)) ?? null;
  }

  sample(snap) {
    if (snap.replay || this.done) return;
    this._elapsed += snap.dt || 0;
    this._snap = snap;
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
          // MSL arrodonit com l altimetre del HUD: el jugador veu el mateix numero a tot arreu (D4, 29/09/2026)
          const alt = Math.round(snap.altFt / ALTIMETER_STEP_FT) * ALTIMETER_STEP_FT;
          if (alt > this.facts.maxAltFt) this.facts.maxAltFt = alt;
          if (!snap.gearDown) this.facts.gearUp = true;
        }
        break;
      }
      case 'maneuvers': {
        if (this._refAlt === null) this._refAlt = snap.altFt;
        const dev = this._devFt = Math.abs(snap.altFt - this._refAlt);
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
        this.ils = ilsGuidance(snap, this.lesson.guidance, T);
        if (snap.onGround) break;
        const h = snap.hatFt ?? snap.aglFt;
        if (h <= T.topAglFt && h >= T.bottomAglFt) {
          this._ilsBand = true;
          const loc = needleDots(snap.locValid, snap.locDots), gs = needleDots(snap.gsValid, snap.gsDots);
          if (loc === null || gs === null) this._ilsOut = { dots: null };
          else if (loc > T.locDots || gs > T.gsDots) {
            const dots = Math.max(loc > T.locDots ? loc : 0, gs > T.gsDots ? gs : 0);
            if (!this._ilsOut || (this._ilsOut.dots !== null && dots > this._ilsOut.dots)) this._ilsOut = { dots };
          }
        } else if (h < T.bottomAglFt && this._ilsBand && !this._ilsOut) this.facts.ilsFlown = true;
        break;
      }
      default: break;
    }
  }

  objectives() { return objectiveRows(this); }

  tips() {
    return (this.lesson.tips || []).map(({ key, keys, params }) => ({ key,
      params: { ...params, ...Object.fromEntries(Object.entries(keys || {}).map(([name, control]) => [name, keyLabel(CONTROL_KEYS[control][0])])) } }));
  }

  /** llindar d un criteri de la llico (value), o undefined */
  _target(metric) { return this.lesson.criteria.find(c => c.metric === metric)?.value; }

  failReason() {
    if (this.lesson.id === 'ils') {
      if (!this._ilsOut) return null;
      const T = this.lesson.ilsTolerance, band = { top: T.topAglFt, bottom: T.bottomAglFt };
      return this._ilsOut.dots === null ? { key: 'school.instructor.ilsLost', params: band }
        : { key: 'school.instructor.ilsDeviation', params: { dots: Math.round(this._ilsOut.dots * 10) / 10, ...band } };
    }
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
    if (this.lesson.id === 'ils' && this.ils) return this._ilsMessage();
    return { key: this.lesson.goalKey, params: lessonGoalParams(this.lesson) };
  }

  /** missatge de l instructor per a la fase de la intercepcio de l ILS */
  _ilsMessage() {
    const { phase, side } = this.ils, T = this.lesson.ilsTolerance;
    const sideKey = side ? { tParams: { side: 'school.side.' + side } } : {};
    switch (phase) {
      case 'joinLoc': return { key: 'school.ils.joinLoc', params: { hdg: Math.round(this._snap.rwyHdgDeg) }, ...sideKey };
      case 'established': return { key: 'school.ils.established',
        params: { loc: T.locDots, gs: T.gsDots, top: T.topAglFt, bottom: T.bottomAglFt } };
      case 'land': return { key: 'school.ils.land', params: { ft: T.bottomAglFt } };
      default: return { key: 'school.ils.' + phase, ...sideKey };
    }
  }

  /** missatge de l instructor per a la fase del circuit en curs */
  _circuitMessage() {
    const { phase, side, turnNow } = this.circuit;
    const sideKey = { tParams: { side: 'school.side.' + side } };
    switch (phase) {
      case 'downwind': return { key: 'school.circuit.downwind', params: { ft: this.lesson.spawn.aglFt } };
      case 'base': return turnNow ? { key: 'school.circuit.turnBase', ...sideKey } : { key: 'school.circuit.descend' };
      case 'finalTurn': return { key: 'school.circuit.turnFinal', ...sideKey };
      default: { const T = this.lesson.finalStabilized;
        return { key: 'school.circuit.final', params: { ft: T.aglFt, nm: T.maxDistNm, s: T.sustainedS } }; }
    }
  }

  finish(record) {
    if (this.done) return this.facts;
    this.done = true;
    this.facts = { ...factsFromRecord(record), ...this.facts };
    return this.facts;
  }
}
