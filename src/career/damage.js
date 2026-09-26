/* Danys d un vol i asseguranca de cellula (DESIGN.md, "Danys, reparacions
 * i asseguranca"). NOU: tasca B3 d ENGINEERING.md. Funcions pures: no toquen
 * el CareerState. Aplicar el resultat a la partida es feina d app/.
 *
 * EXPORTA: assessDamage insurancePremium insuranceSplit
 *
 * INTERFICIE (no la canviis, app/, el debrief, el B5 i els tests en depenen):
 *   assessDamage({ record, airframeValue, mode, crashSeverity })
 *   -> { items: [{ id, cost, groundedDays }], cost, playerCost, groundedDays, xpLoss }
 *     Accident (record.crashCause no null): un sol item 'crash'. crashSeverity
 *     en [0, 1] es obligatori (qui crida el treu de draw(state)); cost,
 *     groundedDays i xpLoss s interpolen dins dels intervals de BALANCE.crash
 *     i s arrodoneixen. Sense perdua total de l avio (BACKLOG.md).
 *     Sense accident, items de BALANCE.damage:
 *       amb touchdown, veryHard si |fpm| > 800 o g > 2.6; si no, hardLanding
 *       si |fpm| > 600 o g > 2.2 (mai tots dos; comparacio estricta);
 *       tailStrike si record.tailStrike, amb touchdown o sense (tail strike
 *       a l enlairament d un vol que no aterra);
 *       offRunway si hi ha touchdown i touchdown.onRunway es fals.
 *       excursion no s avalua: el FlightRecord no porta la pista que queda
 *       al contacte (ho decidira l A4).
 *     cost de cada item = round(pctOfValue * airframeValue); cost = suma;
 *     groundedDays = el maxim dels items (0 si no n hi ha); xpLoss = 0 si no
 *     hi ha accident.
 *     mode 'own': playerCost = cost. mode 'contract': playerCost = 0 (l avio
 *     no es teu); la resta igual, per al debrief.
 *     Llanca un Error si el mode es desconegut, si airframeValue no es un
 *     numero finit no negatiu o, amb accident, si crashSeverity falta o no es
 *     a [0, 1].
 *   insurancePremium(airframeValue) = round(airframeValue * premiumPctPerFlight)
 *   insuranceSplit(cost, airframeValue, excessPct) -> { player, insurer }
 *     player = min(cost, round(excessPct * airframeValue)); insurer = la resta.
 *     Llanca un Error si excessPct no es a BALANCE.insurance.excessOptions.
 */

import { BALANCE } from './balance.js';

const MODES = ['own', 'contract'];

/** euros enters; converteix -0 en 0 */
const eur = x => Math.round(x) || 0;

const lerp = ([lo, hi], s) => lo + (hi - lo) * s;

/** Fila de BALANCE.damage amb aquest id. */
function damageRow(id) {
  const row = BALANCE.damage.find(d => d.id === id);
  if (!row) throw new Error('assessDamage: BALANCE.damage no te ' + id);
  return row;
}

/** Ids dels danys d un vol sense accident. El tail strike compta amb touchdown o sense. */
function contactDamageIds(record) {
  const td = record.touchdown, ids = [];
  if (td) {
    const fpm = Math.abs(td.fpm);
    const exceeds = row => fpm > row.fpm || td.g > row.g;
    if (exceeds(damageRow('veryHard'))) ids.push('veryHard');
    else if (exceeds(damageRow('hardLanding'))) ids.push('hardLanding');
  }
  if (record.tailStrike) ids.push('tailStrike');
  if (td && !td.onRunway) ids.push('offRunway');
  return ids;
}

/** Factura de danys d un vol. Vegeu la capcalera. */
export function assessDamage({ record, airframeValue, mode, crashSeverity }) {
  if (!MODES.includes(mode)) throw new Error('assessDamage: mode desconegut: ' + mode);
  if (!Number.isFinite(airframeValue) || airframeValue < 0) {
    throw new Error('assessDamage: airframeValue ha de ser un numero finit no negatiu');
  }

  let items, xpLoss = 0;
  if (record.crashCause != null) {
    const s = crashSeverity;
    if (!Number.isFinite(s) || s < 0 || s > 1) {
      throw new Error('assessDamage: amb accident cal crashSeverity dins de [0, 1]');
    }
    const C = BALANCE.crash;
    items = [{ id: 'crash', cost: eur(lerp([C.minPct, C.maxPct], s) * airframeValue),
      groundedDays: Math.round(lerp(C.groundedDays, s)) }];
    xpLoss = Math.round(lerp(C.xpLoss, s));
  } else {
    items = contactDamageIds(record).map(id => {
      const row = damageRow(id);
      return { id, cost: eur(row.pctOfValue * airframeValue), groundedDays: row.groundedDays };
    });
  }

  const cost = items.reduce((sum, it) => sum + it.cost, 0);
  const groundedDays = items.reduce((max, it) => Math.max(max, it.groundedDays), 0);
  return { items, cost, playerCost: mode === 'own' ? cost : 0, groundedDays, xpLoss };
}

/** Prima d asseguranca de cellula per vol, en euros. */
export function insurancePremium(airframeValue) {
  return eur(airframeValue * BALANCE.insurance.premiumPctPerFlight);
}

/** Qui paga uns danys amb asseguranca: el jugador fins a la franquicia. */
export function insuranceSplit(cost, airframeValue, excessPct) {
  if (!BALANCE.insurance.excessOptions.includes(excessPct)) {
    throw new Error('insuranceSplit: excessPct no es a BALANCE.insurance.excessOptions: ' + excessPct);
  }
  const player = Math.min(cost, eur(excessPct * airframeValue));
  return { player, insurer: cost - player };
}
