/* Palanca de gas a terra: transicions del reverse i limitador de taxi.
 * Logica pura i headless; index.html (Input.update, Game.onKey, Game.step) nomes la crida.
 * No toca la fisica de l empenta ni del reverse (flight-model.js): nomes decideix a quin
 * valor queda ctl.throttle i quan canvia ctl.reverse.
 *
 * EXPORTA: LEVER_RATE TAXI_LIMIT_KT TAXI_BAND_KT TAXI_MARGIN_KT TAXI_LEAD_S TAXI_ACC_TAU_S TAXI_FULL_THR TAXI_WARN_S leverIdle
 *          reverseToggle reverseUpdate reverseCancel
 *          makeTaxiLimiter taxiToggle taxiCap governThrottle taxiUpdate
 * IMPORTA: res
 *
 * Reverse (decisio del projecte, docs/DECISIONS.md):
 *   - desactivar-lo: la palanca baixa a ralenti, el reverse es desactiva quan hi arriba i
 *     l empenta queda a ralenti fins que el jugador mou la palanca;
 *   - activar-lo amb la palanca per sobre de ralenti: primer baixa a ralenti i el reverse
 *     entra a ralenti.
 * Limitador de taxi (decisio del projecte): retalla l empenta perque la velocitat sobre
 * el terra no passi de TAXI_LIMIT_KT; s activa i es desactiva amb una tecla, nomes a terra.
 *
 * INTERFICIE (no la canviis, els tests en depenen):
 *   ctl.revPending: null | 'on' | 'off'   transicio del reverse en curs
 *   taxiCap(throttle, gsKt) -> palanca retallada
 *   governThrottle(L, ctl, gsKt, dt) -> la palanca que va a la fisica en aquest pas
 */

/** velocitat de la palanca amb les tecles de gas (1/s): la mateixa que Input.update */
export const LEVER_RATE = 0.38;
/** velocitat maxima sobre el terra amb el limitador de taxi actiu (kt) */
export const TAXI_LIMIT_KT = 30;
/** els darrers nusos abans del limit en que la palanca es va retallant fins a ralenti */
export const TAXI_BAND_KT = 5;
/** nusos de marge sota el limit: la inercia dels motors fa que la velocitat encara pugi una mica despres del retall */
export const TAXI_MARGIN_KT = 2;
/** avantatge (s) amb que el limitador mira l acceleracio, i constant de temps (s) del filtre d aquesta */
export const TAXI_LEAD_S = 12;
export const TAXI_ACC_TAU_S = 0.5;
/** palanca a fons: a partir d aqui compta per a l avis */
export const TAXI_FULL_THR = 0.98;
/** segons amb el gas a fons, el limitador actiu i a una pista, abans de l avis */
export const TAXI_WARN_S = 3;

/** posicio de la palanca que es el ralenti d aquest avio (0 = ralenti; cfg.engines.leverIdle ho
 *  pot canviar per a un avio concret). Es l unic lloc que ho decideix. */
export function leverIdle(cfg) {
  const v = cfg && cfg.engines && cfg.engines.leverIdle;
  return typeof v === 'number' ? v : 0;
}

const EPS = 1e-6;

/** tecla del reverse. Retorna que ha passat: 'deployed' (reverse entrat ara), 'arming' (la palanca
 *  baixa a ralenti i el reverse entrara), 'stowing' (la palanca baixa a ralenti i el reverse es
 *  desactivara), 'cancelled' (s ha tornat a prémer durant la transicio: tot queda com era). */
export function reverseToggle(ctl, idle) {
  if (ctl.revPending) { ctl.revPending = null; return 'cancelled'; }
  if (ctl.reverse) { ctl.revPending = 'off'; return 'stowing'; }
  if (ctl.throttle > idle + EPS) { ctl.revPending = 'on'; return 'arming'; }
  ctl.reverse = true; return 'deployed';
}

/** el jugador mou la palanca (o l avio surt de terra): la transicio automatica es cancel.la i
 *  l estat del reverse queda com estava */
export function reverseCancel(ctl) { ctl.revPending = null; }

/** un pas: baixa la palanca a ralenti mentre hi ha una transicio en curs i, en arribar-hi, la
 *  completa. Retorna 'deployed' | 'stowed' | null. */
export function reverseUpdate(ctl, dt, idle) {
  if (!ctl.revPending) return null;
  ctl.throttle = Math.max(idle, ctl.throttle - LEVER_RATE * dt);
  if (ctl.throttle > idle + EPS) return null;
  ctl.throttle = idle;
  const on = ctl.revPending === 'on'; ctl.revPending = null; ctl.reverse = on;
  return on ? 'deployed' : 'stowed';
}

export function makeTaxiLimiter() { return { on: false, fullS: 0, warn: false }; }

/** tecla del limitador: nomes a terra. Retorna true si ha canviat l estat. */
export function taxiToggle(L, wow) {
  if (!wow) return false;
  L.on = !L.on; L.fullS = 0; L.warn = false; return true;
}

/** palanca retallada: la del jugador, escalada fins a ralenti en els TAXI_BAND_KT abans del limit.
 *  gsKt es la velocitat prevista (vegeu governThrottle), no l actual. */
export function taxiCap(throttle, gsKt) {
  const k = Math.min(1, Math.max(0, (TAXI_LIMIT_KT - TAXI_MARGIN_KT - gsKt) / TAXI_BAND_KT));
  return throttle * k;
}

/** la palanca que va a la fisica: la del jugador, o la retallada si el limitador es actiu (no amb el reverse).
 *  Els motors triguen a respondre (spool): el retall mira la velocitat que l avio tindra d aqui a TAXI_LEAD_S
 *  segons si segueix accelerant, estimada amb l acceleracio filtrada, no nomes l actual. */
export function governThrottle(L, ctl, gsKt, dt) {
  const acc = L.prevGs === undefined ? 0 : (gsKt - L.prevGs) / dt; L.prevGs = gsKt;
  L.acc = (L.acc || 0) + (acc - (L.acc || 0)) * Math.min(1, dt / TAXI_ACC_TAU_S);
  return L.on && !ctl.reverse ? taxiCap(ctl.throttle, gsKt + Math.max(0, L.acc) * TAXI_LEAD_S) : ctl.throttle;
}

/** un pas: compta el temps amb el gas a fons sobre una pista i aixeca l avis. No desactiva el
 *  limitador. Si l avio deixa el terra, el limitador es deixa anar (no te cap efecte a l aire). */
export function taxiUpdate(L, dt, { wow, onRunway, throttle }) {
  if (!wow) { L.on = false; L.fullS = 0; L.warn = false; return; }
  if (L.on && onRunway && throttle >= TAXI_FULL_THR) L.fullS += dt; else L.fullS = 0;
  L.warn = L.on && L.fullS > TAXI_WARN_S;
}
