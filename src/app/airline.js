/* Partida d Airline carregada en memoria i les operacions que la canvien:
 * crear-la, desar cada intent de llico, graduar-se, exportar i importar.
 * Cada canvi es desa amb save.js i emet 'career:changed'. Mai es desa per
 * frame: nomes quan passa alguna cosa o quan la UI tanca una pantalla.
 * NOU: tasca C5+D1 d ENGINEERING.md (docs/DECISIONS.md, 30/09/2026, E1-E10).
 * Substitueix la variable school d index.html (D2 del C3+C4).
 *
 * EXPORTA: NAME_MAX_LENGTH normalizeName openAirline currentCareer
 *          pendingCareer entryScreen createAirline acceptBalanceMismatch
 *          startOver recordLesson needsGraduation graduateCareer
 *          exportCareer importCareer saveAirline unlockAllLessons
 *          discardAirline topBarModel _resetAirline
 *
 * IMPORTA: career/ (createCareer, recordLessonAttempt, canGraduate, graduate,
 *   exportJson, importJson, nextRank, rankForXp, BALANCE, LESSONS), save.js,
 *   bus.js, randomSeed i nowIso de platform/.
 *
 * INTERFICIE (no la canviis, index.html, ui/ i els tests en depenen):
 *   NAME_MAX_LENGTH = 24
 *   normalizeName(text) -> el nom sense espais als extrems, o null si no te
 *     d 1 a NAME_MAX_LENGTH caracters (E1). state.js no te cap regla propia.
 *   openAirline() -> { status, backupKey? }   carrega amb loadCareer():
 *     'ok' i 'migrated' deixen la partida a currentCareer(). 'balanceMismatch'
 *     la deixa a pendingCareer() fins que la UI tria acceptBalanceMismatch()
 *     o startOver(). 'invalid' fa backupCareer() de seguida i en retorna la
 *     clau (null si no s ha pogut): loadCareer no esborra mai res. 'none':
 *     no hi ha partida.
 *   currentCareer() -> CareerState | null ; pendingCareer() -> idem
 *   entryScreen(state) -> 'name' | 'school' | 'graduation' | 'ops' (pura):
 *     sense partida el nom; si needsGraduation, la graduacio; graduat, el
 *     centre d operacions; si no, l escola (E8).
 *   createAirline(name, { seed, createdAt }?) -> { ok, reason?, saved? }
 *     reason 'name' si normalizeName torna null (no crea res). seed i
 *     createdAt per defecte de platform/ (randomSeed, nowIso).
 *   acceptBalanceMismatch() -> boolean   continua amb la partida pendent:
 *     balanceVersion passa a BALANCE.version (encara no hi ha cap migracio
 *     de valors, seccio 6) i es desa.
 *   startOver() -> boolean   discardCareer() (copia abans) i deixa la
 *     memoria buida. false si la copia ha fallat: no s esborra res.
 *   recordLesson(lessonId, facts) -> resultat de recordLessonAttempt
 *     ({ school, passed, mercy, attempt, results }) mes saved. Llanca si no
 *     hi ha partida o si la llico no es disponible.
 *   needsGraduation(state = currentCareer()) -> canGraduate i no graduat
 *   graduateCareer() -> { rating, xpGained, xp, rank, cash, loan, saved } o null
 *     si no toca (s aplica un sol cop encara que es demani dues vegades).
 *     cash ja inclou el credit inicial; loan = el seu principal.
 *   exportCareer() -> text JSON o null
 *   importCareer(text) -> { ok, saved? }   si importJson falla, ok false i
 *     la partida en memoria no canvia.
 *   saveAirline() -> boolean   desa la partida en memoria (tancar pantalla)
 *   unlockAllLessons() -> boolean   DEV (E10): totes les llicons aprovades a
 *     l escola de la partida carregada, i desa. false sense partida.
 *   discardAirline() -> boolean   DEV (E10): com startOver.
 *   topBarModel(state) -> camps de la barra superior (E6), pura:
 *     { name, rankKey, xp, xpFloor, xpNext, xpProgress, atMaxRank, cash,
 *       reputation, fleetReady, fleetTotal, base }
 *     xpNext null i xpProgress 1 al rang maxim; base = bases[0] o null.
 *   _resetAirline()   nomes per a proves: buida la memoria.
 */

import {
  createCareer, recordLessonAttempt, canGraduate, graduate, exportJson, importJson,
  nextRank, rankForXp, BALANCE, LESSONS, GRADUATION_RATING
} from '../career/index.js';
import { randomSeed, nowIso } from '../platform/index.js';
import { loadCareer, saveCareer, backupCareer, discardCareer } from './save.js';
import { emit } from './bus.js';

export const NAME_MAX_LENGTH = 24;

let career = null, pending = null;

export function currentCareer() { return career; }
export function pendingCareer() { return pending; }
export function _resetAirline() { career = null; pending = null; }

function set(state) {
  career = state;
  emit('career:changed', { state });
  return saveCareer(state);
}

export function normalizeName(text) {
  if (typeof text !== 'string') return null;
  const name = text.trim();
  const length = [...name].length;
  return length >= 1 && length <= NAME_MAX_LENGTH ? name : null;
}

export function openAirline() {
  const { status, state } = loadCareer();
  career = null; pending = null;
  if (status === 'ok' || status === 'migrated') career = state;
  else if (status === 'balanceMismatch') pending = state;
  else if (status === 'invalid') return { status, backupKey: backupCareer() };
  return { status };
}

export function entryScreen(state) {
  if (!state) return 'name';
  if (needsGraduation(state)) return 'graduation';
  return state.school.graduated ? 'ops' : 'school';
}

export function createAirline(name, opts = {}) {
  const clean = normalizeName(name);
  if (clean === null) return { ok: false, reason: 'name' };
  const state = createCareer({
    name: clean,
    seed: opts.seed ?? randomSeed(),
    createdAt: opts.createdAt ?? nowIso()
  });
  pending = null;
  return { ok: true, saved: set(state) };
}

export function acceptBalanceMismatch() {
  if (!pending) return false;
  const state = { ...pending, balanceVersion: BALANCE.version };
  pending = null;
  set(state);
  return true;
}

export function startOver() {
  if (!discardCareer()) return false;
  career = null; pending = null;
  emit('career:changed', { state: null });
  return true;
}

export function recordLesson(lessonId, facts) {
  if (!career) throw new Error('recordLesson: no hi ha cap partida carregada');
  const result = recordLessonAttempt(career.school, lessonId, facts);
  const saved = set({ ...career, school: result.school });
  return { ...result, saved };
}

export function needsGraduation(state = career) {
  return !!state && canGraduate(state.school) && !state.school.graduated;
}

export function graduateCareer() {
  if (!needsGraduation()) return null;
  const before = career.pilot.xp;
  const saved = set(graduate(career));
  return {
    rating: GRADUATION_RATING, xpGained: career.pilot.xp - before, xp: career.pilot.xp,
    rank: career.pilot.rank, cash: career.company.cash,
    loan: career.company.loans.reduce((sum, l) => sum + l.principal, 0), saved
  };
}

export function exportCareer() {
  return career ? exportJson(career) : null;
}

export function importCareer(text) {
  const state = importJson(text);
  if (state === null) return { ok: false };
  pending = null;
  return { ok: true, saved: set(state) };
}

export function saveAirline() {
  return career ? saveCareer(career) : false;
}

export function unlockAllLessons() {
  if (!career) return false;
  set({ ...career, school: { ...career.school, lessonsPassed: LESSONS.map(l => l.id) } });
  return true;
}

export function discardAirline() {
  return startOver();
}

export function topBarModel(state) {
  const { pilot, company, fleet } = state;
  const rankKey = rankForXp(pilot.xp);
  const floor = BALANCE.ranks.find(r => r.key === rankKey).xp;
  const next = nextRank(pilot.xp);
  return {
    name: pilot.name,
    rankKey,
    xp: pilot.xp,
    xpFloor: floor,
    xpNext: next ? next.xp : null,
    xpProgress: next ? (pilot.xp - floor) / (next.xp - floor) : 1,
    atMaxRank: next === null,
    cash: company.cash,
    reputation: Math.round(company.reputation),
    fleetReady: fleet.filter(a => a.status === 'ready').length,
    fleetTotal: fleet.length,
    base: company.bases.length > 0 ? company.bases[0] : null
  };
}
