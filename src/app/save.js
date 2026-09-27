/* Desar i carregar la partida: l unic punt de app/ que toca Storage.
 * NOU: tasca C2 d ENGINEERING.md, seccions 3 i 8.
 *
 * EXPORTA: CAREER_KEY loadCareer saveCareer backupCareer discardCareer
 *
 * IMPORTA: Storage de platform/, migrate validate SCHEMA_VERSION
 * needsBalanceUpdate de career/, emit de ./bus.js.
 *
 * INTERFICIE (no la canviis, ui/ i els tests en depenen):
 *   CAREER_KEY               'pontAeri.career.v1'
 *   loadCareer() -> { status, state }
 *     status: 'none' (no hi ha res, state null), 'ok', 'migrated' (schema
 *     antic pero migrat be), 'balanceMismatch' (state valid pero
 *     balanceVersion != BALANCE.version: la UI decideix que fer-ne),
 *     'invalid' (migrate ha retornat null, state null). Mai llanca, mai
 *     esborra res
 *   saveCareer(state) -> boolean
 *     Si validate falla: no desa, emet 'save:error' amb { reason: 'invalid' }
 *     i retorna false. Si Storage.save falla: emet 'save:error' amb
 *     { reason: 'storage' } i retorna false
 *   backupCareer() -> string|null
 *     Copia el valor cru actual de CAREER_KEY a
 *     CAREER_KEY + '.bak.' + Date.now() i en retorna la clau. null si no hi
 *     havia res desat o si la copia ha fallat
 *   discardCareer() -> boolean
 *     Primer backupCareer(). Si retorna null i hi havia partida desada, NO
 *     esborra res i retorna false. Si la copia s ha fet (o no hi havia res),
 *     esborra CAREER_KEY i retorna true
 */

import { Storage } from '../platform/index.js';
import { migrate, validate, SCHEMA_VERSION, needsBalanceUpdate } from '../career/index.js';
import { emit } from './bus.js';

export const CAREER_KEY = 'pontAeri.career.v1';

export function loadCareer() {
  const raw = Storage.load(CAREER_KEY);
  if (raw === null) return { status: 'none', state: null };

  const state = migrate(raw);
  if (state === null) return { status: 'invalid', state: null };

  if (needsBalanceUpdate(state)) return { status: 'balanceMismatch', state };

  const migrated = typeof raw.schemaVersion !== 'number' || raw.schemaVersion < SCHEMA_VERSION;
  return { status: migrated ? 'migrated' : 'ok', state };
}

export function saveCareer(state) {
  if (!validate(state).ok) {
    emit('save:error', { reason: 'invalid' });
    return false;
  }
  if (!Storage.save(CAREER_KEY, state)) {
    emit('save:error', { reason: 'storage' });
    return false;
  }
  return true;
}

export function backupCareer() {
  const raw = Storage.load(CAREER_KEY);
  if (raw === null) return null;
  const backupKey = CAREER_KEY + '.bak.' + Date.now();
  return Storage.save(backupKey, raw) ? backupKey : null;
}

export function discardCareer() {
  const hadCareer = Storage.load(CAREER_KEY) !== null;
  const backupKey = backupCareer();
  if (hadCareer && backupKey === null) return false;
  Storage.remove(CAREER_KEY);
  return true;
}
