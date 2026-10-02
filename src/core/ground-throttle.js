/* Palanca de gas a terra: transicions del reverse.
 * Logica pura i headless; index.html (Input.update, Game.onKey, Game.step) nomes la crida.
 * No toca la fisica de l empenta ni del reverse (flight-model.js): nomes decideix a quin
 * valor queda ctl.throttle i quan canvia ctl.reverse.
 *
 * EXPORTA: LEVER_RATE leverIdle reverseToggle reverseUpdate reverseCancel
 * IMPORTA: res
 *
 * Reverse (decisio del projecte, docs/DECISIONS.md):
 *   - desactivar-lo: la palanca baixa a ralenti, el reverse es desactiva quan hi arriba i
 *     l empenta queda a ralenti fins que el jugador mou la palanca;
 *   - activar-lo amb la palanca per sobre de ralenti: primer baixa a ralenti i el reverse
 *     entra a ralenti.
 * INTERFICIE (no la canviis, els tests en depenen):
 *   ctl.revPending: null | 'on' | 'off'   transicio del reverse en curs
 */

/** velocitat de la palanca amb les tecles de gas (1/s): la mateixa que Input.update */
export const LEVER_RATE = 0.38;
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
