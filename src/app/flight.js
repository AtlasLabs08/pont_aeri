/* Llancament i final de vol: pont entre app/ i el Game d index.html, sense
 * imports circulars. NOU: tasca C2 d ENGINEERING.md, seccio 3.
 *
 * EXPORTA: setFlightLauncher launchFlight onFlightFinished cancelFlight
 *          isFlightInProgress _resetFlight
 *
 * IMPORTA: RECORD_KEYS i OPTIONAL_RECORD_KEYS de core/, emit de ./bus.js.
 *
 * INTERFICIE (no la canviis, index.html i els tests en depenen):
 *   setFlightLauncher(fn)   index.html hi injecta una funcio que rep opts,
 *                           el copia a Game.opts i crida Game.spawn()
 *   launchFlight(opts) -> Promise<FlightRecord|null>
 *                           llanca si no hi ha launcher configurat o si ja hi
 *                           ha un vol en marxa. Crida fn amb una copia d opts:
 *                           modificar l opts original despres no afecta el
 *                           que ha rebut el launcher
 *   onFlightFinished(record)  index.html la crida quan Game acaba un vol.
 *                           Si hi ha un vol en marxa: resol la promesa amb
 *                           record, deixa l estat lliure i emet
 *                           'flight:finished' amb record; retorna true. Si al
 *                           record li falta alguna clau de RECORD_KEYS (menys
 *                           les d OPTIONAL_RECORD_KEYS, com landedAt),
 *                           rebutja la promesa en comptes de resoldre-la, no
 *                           emet, pero tambe deixa l estat lliure i retorna
 *                           true. Sense vol en marxa (Free Flight, o una
 *                           segona crida): no fa res, retorna false
 *   cancelFlight()          vol abandonat: resol la promesa amb null, deixa
 *                           l estat lliure, no emet. Sense vol en marxa, no
 *                           fa res
 *   isFlightInProgress()
 *   _resetFlight()          nomes per a les proves
 */

import { RECORD_KEYS, OPTIONAL_RECORD_KEYS } from '../core/index.js';
import { emit } from './bus.js';

let launcher = null;
let current = null;

export function setFlightLauncher(fn) {
  launcher = fn;
}

export function isFlightInProgress() {
  return current !== null;
}

export function launchFlight(opts) {
  if (typeof launcher !== 'function') throw new Error('cap launcher de vol configurat');
  if (current !== null) throw new Error('ja hi ha un vol en marxa');
  return new Promise((resolve, reject) => {
    current = { resolve, reject };
    launcher({ ...opts });
  });
}

export function onFlightFinished(record) {
  if (current === null) return false;
  const { resolve, reject } = current;
  current = null;
  const required = RECORD_KEYS.filter(k => !OPTIONAL_RECORD_KEYS.includes(k));
  const missing = !record || typeof record !== 'object'
    ? required
    : required.filter(k => !(k in record));
  if (missing.length > 0) {
    reject(new Error('FlightRecord incomplet: falta ' + missing.join(', ')));
    return true;
  }
  resolve(record);
  emit('flight:finished', record);
  return true;
}

export function cancelFlight() {
  if (current === null) return;
  const { resolve } = current;
  current = null;
  resolve(null);
}

export function _resetFlight() {
  launcher = null;
  current = null;
}
