/* Intent de llico en marxa: lliga una LessonRun amb el vol que llanca
 * app/flight.js i la tanca amb el FlightRecord que torna.
 * ORIGEN: launchLesson, concludeLesson i la variable activeLesson
 * d index.html (C3).
 *
 * EXPORTA: startLesson currentLesson currentLessonId lastLessonId abandonLesson
 *
 * IMPORTA: LessonRun de ./lesson-run.js, launchFlight i cancelFlight de
 * ./flight.js.
 *
 * INTERFICIE (no la canviis, index.html i els tests en depenen):
 *   startLesson(lessonId, flightOpts) -> Promise<{ lessonId, facts, record, reason } | null>
 *     crea la LessonRun (que passa a ser currentLesson()) i llanca el vol
 *     amb launchFlight(flightOpts). Si ja hi ha una llico en marxa (la
 *     mateixa o una altra, panell DEV), primer la cancel la amb
 *     cancelFlight(): la seva promesa resol null i no compta com a intent
 *     (D3). Si launchFlight llanca (hi ha un vol en marxa que no es de cap
 *     llico), no canvia res. Quan torna el FlightRecord, tanca aquesta
 *     LessonRun, i nomes aquesta, amb finish(record) i resol amb els fets
 *     combinats i reason = run.failReason() (per a attemptMessage). Si el vol es cancel la (record null), resol null sense
 *     tocar cap LessonRun: reiniciar (cancelFlight i startLesson) no pot
 *     tancar la llico nova amb la promesa de la vella.
 *   currentLesson() -> LessonRun | null   intent en marxa
 *   currentLessonId() -> string | null
 *   lastLessonId() -> string | null   la darrera llico llancada, encara que
 *     ja hagi acabat (crash, nota o 120 s): la que torna a llancar Restart.
 *     null despres d abandonLesson().
 *   abandonLesson()   cancelFlight() i deixa l estat lliure (tornar al menu)
 */

import { LessonRun } from './lesson-run.js';
import { launchFlight, cancelFlight } from './flight.js';

let active = null, activeId = null, lastId = null;

export function currentLesson() { return active; }
export function currentLessonId() { return activeId; }
export function lastLessonId() { return lastId; }

export function startLesson(lessonId, flightOpts) {
  const run = new LessonRun(lessonId);
  // la promesa es d aquest vol: nomes pot tancar aquesta run, mai la que
  // hagi pres el relleu despres d un Restart
  const release = () => { if (active === run) { active = null; activeId = null; } };
  // una llico en marxa es cancel la: el seu then veu record null i no toca la nova
  if (active !== null) cancelFlight();
  const flight = launchFlight(flightOpts);
  active = run; activeId = lessonId; lastId = lessonId;
  return flight.then(record => {
    release();
    if (record === null) return null;
    return { lessonId, facts: run.finish(record), record, reason: run.failReason() };
  }, err => { release(); throw err; });
}

export function abandonLesson() {
  cancelFlight();
  active = null; activeId = null; lastId = null;
}
