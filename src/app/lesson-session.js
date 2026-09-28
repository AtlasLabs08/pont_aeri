/* Intent de llico en marxa: lliga una LessonRun amb el vol que llanca
 * app/flight.js i la tanca amb el FlightRecord que torna.
 * ORIGEN: launchLesson, concludeLesson i la variable activeLesson
 * d index.html (C3).
 *
 * EXPORTA: startLesson currentLesson currentLessonId abandonLesson
 *
 * IMPORTA: LessonRun de ./lesson-run.js, launchFlight i cancelFlight de
 * ./flight.js.
 *
 * INTERFICIE (no la canviis, index.html i els tests en depenen):
 *   startLesson(lessonId, flightOpts) -> Promise<{ lessonId, facts, record }>
 *     crea la LessonRun (que passa a ser currentLesson()) i llanca el vol
 *     amb launchFlight(flightOpts). Quan torna el FlightRecord, tanca la
 *     llico amb finish(record) i resol amb els fets combinats.
 *   currentLesson() -> LessonRun | null   intent en marxa
 *   currentLessonId() -> string | null
 *   abandonLesson()   cancelFlight() i deixa l estat lliure
 */

import { LessonRun } from './lesson-run.js';
import { launchFlight, cancelFlight } from './flight.js';

let active = null, activeId = null;

export function currentLesson() { return active; }
export function currentLessonId() { return activeId; }

export function startLesson(lessonId, flightOpts) {
  activeId = lessonId; active = new LessonRun(lessonId);
  return launchFlight(flightOpts)
    .then(record => {
      const facts = active.finish(record);
      const outcome = { lessonId: activeId, facts, record };
      active = null; activeId = null;
      return outcome;
    })
    .catch(err => { active = null; activeId = null; throw err; });
}

export function abandonLesson() {
  cancelFlight();
  active = null; activeId = null;
}
