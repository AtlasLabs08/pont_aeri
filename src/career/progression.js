/* Progressio del pilot: XP, rangs, habilitacions de tipus i endorsements
 * (DESIGN.md, "Progressio del pilot"). NOU: tasca B4 d ENGINEERING.md.
 * Funcions pures: cap no modifica el Pilot que rep, en retornen un de nou.
 * Aplicar el resultat a la partida (i descomptar els diners) es feina d app/.
 *
 * EXPORTA: rankForXp nextRank rankPayMult dispatchLimits flightXp applyXp
 *          canFlyType purchaseRating purchaseEndorsement
 *
 * INTERFICIE (no la canviis, app/, la interficie, el C1, l E5 i els tests en depenen):
 *   rankForXp(xp) -> clau del rang mes alt de BALANCE.ranks amb xp >= llindar.
 *     Llanca un Error si xp no es un numero finit no negatiu.
 *   nextRank(xp) -> { key, xp, remaining } del rang seguent (xp = el seu
 *     llindar, remaining = llindar - xp), o null si ja es el mes alt.
 *   rankPayMult(rankKey) -> payMult del rang.
 *   dispatchLimits(rankKey) -> { slots, pct } (pct = dispatchPct del rang).
 *     Totes dues llancen un Error si la clau no es a BALANCE.ranks.
 *   flightXp({ landingXp, turbulence, hardWeather, destination }) -> enter.
 *     landingXp = computeFlightResult(...).landing.xp. Si landingXp > 0:
 *     round(landingXp * (turbulence ? xpMultipliers.turbulence : 1)
 *                     * (hardWeather ? xpMultipliers.hardWeather : 1)
 *                     * (1 + airportDifficulty[destination], 0 si no hi es)).
 *     Si landingXp <= 0 es retorna igual: els multiplicadors nomes pugen
 *     l XP positiva (docs/DECISIONS.md, 26/09/2026).
 *     Llanca un Error si landingXp no es un enter.
 *   applyXp(pilot, delta) -> { pilot, rankBefore, rankAfter, change }
 *     xp nova = max(0, pilot.xp + delta); rank = rankForXp(xp nova): la
 *     baixada es proporcional, el rang surt sempre de l XP.
 *     rankBefore = pilot.rank; change = 'up' | 'down' | null.
 *     La perdua per accident es delta = -assessDamage(...).xpLoss, igual als
 *     dos modes. Llanca un Error si delta no es un enter o si pilot.rank no
 *     es a BALANCE.ranks.
 *   canFlyType(pilot, typeId) -> true si pilot.ratings inclou
 *     BALANCE.fleetTypes[typeId].rating. Llanca un Error si el tipus no hi es.
 *   purchaseRating(pilot, cash, key), purchaseEndorsement(pilot, cash, key)
 *     -> { ok: true, pilot, cost } o { ok: false, reason }, amb reason
 *     'unknown' (la clau no es a BALANCE.ratings / BALANCE.endorsements),
 *     'owned' (ja la te), 'rank' (el rang del pilot es inferior al que demana,
 *     per ordre de BALANCE.ranks) o 'cash' (cash < cost), comprovats en
 *     aquest ordre. No resta diners: nomes diu el cost. El check-ride de les
 *     habilitacions es del C1: aqui es compra quan ja s ha passat.
 *     Llancen un Error si cash no es un numero finit o si pilot.rank no es a
 *     BALANCE.ranks.
 */

import { BALANCE } from './balance.js';

/** @typedef {import('./types.js').Pilot} Pilot */

const lookup = (table, key, fallback) => Object.hasOwn(table, key) ? table[key] : fallback;

/** Index de rankKey a BALANCE.ranks. Llanca si no hi es. */
function rankIndex(rankKey, fn) {
  const i = BALANCE.ranks.findIndex(r => r.key === rankKey);
  if (i < 0) throw new Error(fn + ': rang desconegut: ' + rankKey);
  return i;
}

/** Index del rang mes alt amb xp >= llindar. */
function rankIndexForXp(xp, fn) {
  if (!Number.isFinite(xp) || xp < 0) throw new Error(fn + ': xp ha de ser un numero finit no negatiu');
  let i = 0;
  while (i + 1 < BALANCE.ranks.length && xp >= BALANCE.ranks[i + 1].xp) i++;
  return i;
}

/** Clau del rang que correspon a xp. */
export function rankForXp(xp) {
  return BALANCE.ranks[rankIndexForXp(xp, 'rankForXp')].key;
}

/** Rang seguent i XP que falta, o null al rang mes alt. */
export function nextRank(xp) {
  const next = BALANCE.ranks[rankIndexForXp(xp, 'nextRank') + 1];
  return next ? { key: next.key, xp: next.xp, remaining: next.xp - xp } : null;
}

/** Multiplicador de pagament als vols de contracte. */
export function rankPayMult(rankKey) {
  return BALANCE.ranks[rankIndex(rankKey, 'rankPayMult')].payMult;
}

/** Limits del despatx (E5) per a aquest rang. */
export function dispatchLimits(rankKey) {
  const r = BALANCE.ranks[rankIndex(rankKey, 'dispatchLimits')];
  return { slots: r.slots, pct: r.dispatchPct };
}

/** XP d un vol a partir de la del tram d aterratge. Vegeu la capcalera. */
export function flightXp({ landingXp, turbulence, hardWeather, destination }) {
  if (!Number.isInteger(landingXp)) throw new Error('flightXp: landingXp ha de ser un enter');
  if (landingXp <= 0) return landingXp;
  const m = BALANCE.xpMultipliers;
  return Math.round(landingXp
    * (turbulence ? m.turbulence : 1)
    * (hardWeather ? m.hardWeather : 1)
    * (1 + lookup(BALANCE.airportDifficulty, destination, 0)));
}

/** Suma delta a l XP del pilot i en recalcula el rang. Vegeu la capcalera. */
export function applyXp(pilot, delta) {
  if (!Number.isInteger(delta)) throw new Error('applyXp: delta ha de ser un enter');
  const before = rankIndex(pilot.rank, 'applyXp');
  const xp = Math.max(0, pilot.xp + delta);
  const after = rankIndexForXp(xp, 'applyXp');
  const rankAfter = BALANCE.ranks[after].key;
  return {
    pilot: { ...pilot, xp, rank: rankAfter },
    rankBefore: pilot.rank,
    rankAfter,
    change: after > before ? 'up' : after < before ? 'down' : null
  };
}

/** El pilot te l habilitacio que demana aquest tipus d avio. */
export function canFlyType(pilot, typeId) {
  const ft = lookup(BALANCE.fleetTypes, typeId, null);
  if (!ft) throw new Error('canFlyType: typeId desconegut a BALANCE.fleetTypes: ' + typeId);
  return pilot.ratings.includes(ft.rating);
}

/** Compra comuna d una entrada de table, que es desa a pilot[field]. */
function purchase(fn, table, field, pilot, cash, key) {
  if (!Number.isFinite(cash)) throw new Error(fn + ': cash ha de ser un numero finit');
  const pilotRank = rankIndex(pilot.rank, fn);
  const item = lookup(table, key, null);
  if (!item) return { ok: false, reason: 'unknown' };
  if (pilot[field].includes(key)) return { ok: false, reason: 'owned' };
  if (pilotRank < rankIndex(item.rank, fn)) return { ok: false, reason: 'rank' };
  if (cash < item.cost) return { ok: false, reason: 'cash' };
  return { ok: true, pilot: { ...pilot, [field]: [...pilot[field], key] }, cost: item.cost };
}

/** Compra una habilitacio de tipus (el check-ride ja s ha passat, C1). */
export function purchaseRating(pilot, cash, key) {
  return purchase('purchaseRating', BALANCE.ratings, 'ratings', pilot, cash, key);
}

/** Compra un endorsement. */
export function purchaseEndorsement(pilot, cash, key) {
  return purchase('purchaseEndorsement', BALANCE.endorsements, 'endorsements', pilot, cash, key);
}
