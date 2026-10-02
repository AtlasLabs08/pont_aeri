/* Motor de criteris de l escola de vol i dels check-rides de les
 * habilitacions (DESIGN.md, "Escola de vol" i "Habilitacions de tipus").
 * NOU: tasca C1 d ENGINEERING.md. Les dades son a lessons.js. Funcions
 * pures: cap no modifica el que rep; recordLessonAttempt retorna un school
 * nou. Aplicar-lo a la partida es feina d app/.
 *
 * EXPORTA: METRICS factsFromRecord evaluate isLessonAvailable
 *          recordLessonAttempt canGraduate evaluateCheckRide
 *
 * INTERFICIE (no la canviis, app/, el C3, el C5 i els tests en depenen):
 *   METRICS: llista tancada dels noms de fet que un criteri pot fer servir.
 *   factsFromRecord(record) -> objecte pla amb els fets que surten del
 *     FlightRecord: landed (touchdown != null), crashed (crashCause != null),
 *     score, onRunway i bounces (del touchdown; null si no n hi ha),
 *     maxAltFt, tailStrike, fuelBurntKg, fuelPlannedKg i fuelWithinPlan
 *     (fuelBurntKg + skippedCruiseFuelKg * (1 + cruiseSkipFuelPenalty)
 *     <= fuelPlannedKg, el combustible efectiu d economy.js; sense
 *     skippedCruiseFuelKg compta 0). La resta de METRICS els omple el C3 en
 *     viu.
 *   evaluate(criteria, facts, schoolPass = BALANCE.school.passScore)
 *     -> { passed, results: [{ metric, op, target, value, ok }] }
 *     target = value del criteri, amb SCHOOL_PASS substituit per schoolPass.
 *     Un fet que falta o es null fa fallar el seu criteri, mai llanca; gte i
 *     lte demanen un numero finit. Si facts.crashed es true, passed es false
 *     sempre. Llanca un Error si un criteri te un metric fora de METRICS o
 *     un op desconegut.
 *   isLessonAvailable(school, lessonId) -> la primera llico sempre; la resta
 *     si l anterior es a school.lessonsPassed. Una llico aprovada es pot
 *     repetir.
 *   recordLessonAttempt(school, lessonId, facts)
 *     -> { school, passed, mercy, attempt, results }
 *     school = { lessonsPassed, attempts, graduated } (el subobjecte de
 *     CareerState). Llanca un Error amb l id si isLessonAvailable es fals
 *     (una llico aprovada es pot repetir). attempt = attempts[lessonId] + 1 (o 1), i es desa sempre
 *     al school nou. Llindar de nota: mercyScore si la llico te mercy i
 *     attempt >= mercyAttempt; si no, passScore. mercy es true nomes si ha
 *     aprovat amb score < passScore. Si aprova, l id s afegeix a
 *     lessonsPassed sense duplicats. No toca graduated.
 *   canGraduate(school) -> totes les LESSONS son a lessonsPassed.
 *   evaluateCheckRide(ratingId, facts) -> com evaluate. Nomes avalua: donar
 *     l habilitacio, el rang i el cost son de progression.js.
 *   Una llico o un check-ride desconegut llanca un Error amb l id.
 */

import { BALANCE } from './balance.js';
import { effectiveFuelKg } from './util.js';
import { SCHOOL_PASS, LESSONS, CHECK_RIDES } from './lessons.js';

export const METRICS = [
  'landed', 'crashed', 'score', 'onRunway', 'maxAltFt', 'tailStrike', 'bounces',
  'fuelBurntKg', 'fuelPlannedKg', 'fuelWithinPlan', 'viewsVisited',
  'controlsIdentified', 'reachedThreshold', 'gearUp', 'altDeviationMaxFt',
  'stabilizedOnFinal', 'ilsFlown', 'headingChangeDeg'
];

const isNum = v => typeof v === 'number' && Number.isFinite(v);

const OPS = {
  gte: (v, t) => isNum(v) && v >= t,
  lte: (v, t) => isNum(v) && v <= t,
  eq:  (v, t) => v !== undefined && v !== null && v === t
};

/** Fets del FlightRecord. Vegeu la capcalera. */
export function factsFromRecord(record) {
  const td = record.touchdown ?? null;
  const burnt = record.fuelBurntKg, planned = record.fuelPlannedKg;
  const effective = effectiveFuelKg(record);
  return {
    landed: td !== null,
    crashed: record.crashCause != null,
    score: td ? td.score : null,
    onRunway: td ? td.onRunway : null,
    bounces: td ? td.bounces : null,
    maxAltFt: record.maxAltFt,
    tailStrike: record.tailStrike,
    fuelBurntKg: burnt,
    fuelPlannedKg: planned,
    fuelWithinPlan: isNum(effective) && isNum(planned) ? effective <= planned : null
  };
}

/** Avalua una llista de criteris sobre uns fets. Vegeu la capcalera. */
export function evaluate(criteria, facts, schoolPass = BALANCE.school.passScore) {
  const results = criteria.map(({ metric, op, value }) => {
    if (!METRICS.includes(metric)) throw new Error('evaluate: metric desconegut: ' + metric);
    if (!Object.hasOwn(OPS, op)) throw new Error('evaluate: op desconegut: ' + op);
    const target = value === SCHOOL_PASS ? schoolPass : value;
    const v = Object.hasOwn(facts, metric) ? facts[metric] : null;
    return { metric, op, target, value: v ?? null, ok: OPS[op](v, target) };
  });
  return { passed: facts.crashed !== true && results.every(r => r.ok), results };
}

/** Index de la llico a LESSONS. Llanca si no hi es. */
function lessonIndex(lessonId, fn) {
  const i = LESSONS.findIndex(l => l.id === lessonId);
  if (i < 0) throw new Error(fn + ': llico desconeguda: ' + lessonId);
  return i;
}

/** La llico es pot fer: la primera sempre, la resta si l anterior esta aprovada. */
export function isLessonAvailable(school, lessonId) {
  const i = lessonIndex(lessonId, 'isLessonAvailable');
  return i === 0 || school.lessonsPassed.includes(LESSONS[i - 1].id);
}

/** Desa un intent d una llico i en diu el resultat. Vegeu la capcalera. */
export function recordLessonAttempt(school, lessonId, facts) {
  const lesson = LESSONS[lessonIndex(lessonId, 'recordLessonAttempt')];
  if (!isLessonAvailable(school, lessonId)) {
    throw new Error('recordLessonAttempt: llico no disponible: ' + lessonId);
  }
  const s = BALANCE.school;
  const attempt = (Object.hasOwn(school.attempts, lessonId) ? school.attempts[lessonId] : 0) + 1;
  const threshold = lesson.mercy && attempt >= s.mercyAttempt ? s.mercyScore : s.passScore;
  const { passed, results } = evaluate(lesson.criteria, facts, threshold);
  const mercy = passed && isNum(facts.score) && facts.score < s.passScore
    && lesson.criteria.some(c => c.value === SCHOOL_PASS);
  const lessonsPassed = passed && !school.lessonsPassed.includes(lessonId)
    ? [...school.lessonsPassed, lessonId]
    : [...school.lessonsPassed];
  return {
    school: { ...school, lessonsPassed, attempts: { ...school.attempts, [lessonId]: attempt } },
    passed, mercy, attempt, results
  };
}

/** Totes les llicons aprovades. */
export function canGraduate(school) {
  return LESSONS.every(l => school.lessonsPassed.includes(l.id));
}

/** Avalua el check-ride d una habilitacio. No toca cap estat. */
export function evaluateCheckRide(ratingId, facts) {
  if (!Object.hasOwn(CHECK_RIDES, ratingId)) {
    throw new Error('evaluateCheckRide: check-ride desconegut: ' + ratingId);
  }
  return evaluate(CHECK_RIDES[ratingId].criteria, facts);
}
