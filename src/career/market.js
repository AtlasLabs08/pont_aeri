/* Mercat d ocasio i categories d avio (DESIGN.md, "Mercat d ocasio";
 * docs/DECISIONS.md, 30/09/2026, G2-G4). NOU: tasques D2+D5 d ENGINEERING.md.
 * Funcions pures: no modifiquen la partida que reben. Comprar i vendre son a
 * finance.js; aplicar-ho a la partida i desar-la es feina d app/.
 *
 * EXPORTA: DEFAULT_TIER GUARANTEED_TIERS MARKET_RNG_TAG tierOf airframeTier
 *          marketEpoch priceOf typeGroups generateMarket refreshMarket
 *
 * IMPORTA: BALANCE, derivedRng de ./rng.js.
 *
 * INTERFICIE (no la canviis, finance.js, app/, ui/ i els tests en depenen):
 *   DEFAULT_TIER = 'standard'   categoria d un Airframe sense tier (G11)
 *   GUARANTEED_TIERS = ['basic', 'standard']   anuncis garantits per habilitacio
 *   tierOf(key) -> el tram de BALANCE.market.tiers. null o undefined donen
 *     DEFAULT_TIER. Llanca un Error si la clau es desconeguda.
 *   airframeTier(airframe) -> airframe.tier, o DEFAULT_TIER si no en te.
 *   marketEpoch(minute) -> floor(minute / market.regenMinutes). Mai hora real.
 *   priceOf(typeId, tier, ageYears, condition) -> euros enters (G3):
 *     condition es l objecte dels 4 sistemes (o un numero, la seva mitjana).
 *     t = tierOf(tier); ageN i condN retallats a [0, 1] dins dels trams de t;
 *     score = ageWeight * (1 - ageN) + (1 - ageWeight) * condN;
 *     round(usedPrice[typeId] * lerp(t.priceFactor[0], t.priceFactor[1], score)).
 *     Llanca un Error si typeId no es a BALANCE.usedPrice o si l edat o
 *     l estat no son numeros finits.
 *   typeGroups(ratings) -> { rated, next, other }   tipus de BALANCE.fleetTypes
 *     (en el seu ordre) segons les habilitacions del pilot: rated, els de
 *     les que te; next, els de la primera de BALANCE.ratings (en ordre) que
 *     no te; other, la resta. El mapa tipus -> habilitacio es
 *     fleetTypes[..].rating.
 *   generateMarket(state, epoch) -> { epoch, listings }   (G4)
 *     Tot l atzar surt de derivedRng(state.rngSeed, MARKET_RNG_TAG, epoch):
 *     no toca rngCounter ni res de la partida. Composicio:
 *       1) Garanties: per a cada habilitacio del pilot (ordre de
 *          BALANCE.ratings), un anunci de cada GUARANTEED_TIERS d un tipus
 *          d aquella habilitacio, preferint tipus encara no coberts; despres,
 *          un anunci per a cada tipus rated sense cap (categoria amb
 *          tierWeights).
 *       2) n = enter uniforme de market.listings; mentre en falten, grup amb
 *          els pesos de mix (buit -> rated; si rated tambe ho es, tots els
 *          tipus), tipus uniforme dins del grup i categoria amb tierWeights.
 *          Si les garanties ja passen de n, la llista son les garanties.
 *     Cada anunci (Listing, types.js), amb t = la seva categoria i cls la
 *     classe del tipus: ageYears enter uniforme de t.ageYears, yearBuilt =
 *     referenceYear - ageYears; cada sistema, enter uniforme de t.condition;
 *     hours = round(ageYears * hoursPerYear[cls] * (1 - hoursJitter +
 *     2 * hoursJitter * u)); cycles = round(hours / hoursPerCycle[cls]);
 *     maintenance.nextAHours / nextCHours = hours + enter uniforme entre 1
 *     i checks.A / C.intervalHours (hores absolutes, com wear.js); reg
 *     'EC-' + 3 lletres, unica entre la flota i la llista; price = priceOf.
 *   refreshMarket(state) -> la mateixa partida si state.market.epoch >=
 *     marketEpoch(clock.minute); si falta market o l epoch calculat es mes
 *     gran, una partida nova amb market = generateMarket(state, epoch).
 */

import { BALANCE } from './balance.js';
import { derivedRng } from './rng.js';

export const DEFAULT_TIER = 'standard';
export const GUARANTEED_TIERS = Object.freeze(['basic', 'standard']);
export const MARKET_RNG_TAG = 'market';

const CONDITION_KEYS = ['engines', 'gear', 'airframe', 'avionics'];
const REG_PREFIX = 'EC-';
const REG_LETTERS = 3;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const lookup = (table, key, fallback) => Object.hasOwn(table, key) ? table[key] : fallback;
const clamp01 = x => Math.min(1, Math.max(0, x));
const lerp = (a, b, s) => a + (b - a) * s;

/** Tram de la categoria. Vegeu la capcalera. */
export function tierOf(key) {
  const k = key ?? DEFAULT_TIER;
  const t = BALANCE.market.tiers.find(x => x.key === k);
  if (!t) throw new Error('tierOf: categoria desconeguda: ' + key);
  return t;
}

/** Categoria d un avio de la flota: la desada, o standard si no en te (G11). */
export function airframeTier(airframe) {
  return airframe.tier ?? DEFAULT_TIER;
}

/** Epoch del mercat per a aquest minut de partida. */
export function marketEpoch(minute) {
  return Math.floor(minute / BALANCE.market.regenMinutes);
}

function meanCondition(condition) {
  if (typeof condition === 'number') return condition;
  return CONDITION_KEYS.reduce((s, k) => s + condition[k], 0) / CONDITION_KEYS.length;
}

/** Preu d un avio dins de la seva categoria (G3). Vegeu la capcalera. */
export function priceOf(typeId, tier, ageYears, condition) {
  const used = lookup(BALANCE.usedPrice, typeId, null);
  if (used === null) throw new Error('priceOf: typeId desconegut a BALANCE.usedPrice: ' + typeId);
  const t = tierOf(tier);
  const cond = meanCondition(condition);
  if (!Number.isFinite(ageYears) || !Number.isFinite(cond)) {
    throw new Error('priceOf: l edat i l estat han de ser numeros finits');
  }
  const ageN = clamp01((ageYears - t.ageYears[0]) / (t.ageYears[1] - t.ageYears[0]));
  const condN = clamp01((cond - t.condition[0]) / (t.condition[1] - t.condition[0]));
  const w = BALANCE.market.ageWeight;
  const score = w * (1 - ageN) + (1 - w) * condN;
  return Math.round(used * lerp(t.priceFactor[0], t.priceFactor[1], score));
}

/** Tipus d avio agrupats per les habilitacions del pilot. Vegeu la capcalera. */
export function typeGroups(ratings) {
  const types = Object.keys(BALANCE.fleetTypes);
  const ratingOf = typeId => BALANCE.fleetTypes[typeId].rating;
  const next = Object.keys(BALANCE.ratings).find(r => !ratings.includes(r)) ?? null;
  return {
    rated: types.filter(t => ratings.includes(ratingOf(t))),
    next: types.filter(t => ratingOf(t) === next),
    other: types.filter(t => !ratings.includes(ratingOf(t)) && ratingOf(t) !== next)
  };
}

/** Llista d anuncis d aquest epoch. Vegeu la capcalera. */
export function generateMarket(state, epoch) {
  const M = BALANCE.market;
  const u = derivedRng(state.rngSeed, MARKET_RNG_TAG, epoch);
  const randInt = (lo, hi) => lo + Math.floor(u() * (hi - lo + 1));
  const pick = list => list[Math.floor(u() * list.length)];
  const weighted = weights => {
    const entries = Object.entries(weights);
    let x = u() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [key, w] of entries) {
      if (x < w) return key;
      x -= w;
    }
    return entries[entries.length - 1][0];
  };
  const pickTier = () => weighted(Object.fromEntries(M.tiers.map(t => [t.key, M.tierWeights[t.key]])));

  const taken = new Set(state.fleet.map(a => a.reg));
  const newReg = () => {
    for (;;) {
      let reg = REG_PREFIX;
      for (let i = 0; i < REG_LETTERS; i++) reg += LETTERS[Math.floor(u() * LETTERS.length)];
      if (!taken.has(reg)) { taken.add(reg); return reg; }
    }
  };

  const listings = [];
  const covered = new Set();
  const add = (typeId, tier) => {
    const t = tierOf(tier), cls = BALANCE.fleetTypes[typeId].cls;
    const ageYears = randInt(t.ageYears[0], t.ageYears[1]);
    const condition = {};
    for (const k of CONDITION_KEYS) condition[k] = randInt(t.condition[0], t.condition[1]);
    const hours = Math.round(ageYears * M.hoursPerYear[cls] * (1 - M.hoursJitter + 2 * M.hoursJitter * u()));
    const cycles = Math.round(hours / M.hoursPerCycle[cls]);
    const maintenance = {
      nextAHours: hours + randInt(1, BALANCE.checks.A.intervalHours),
      nextCHours: hours + randInt(1, BALANCE.checks.C.intervalHours)
    };
    listings.push({ reg: newReg(), typeId, tier, yearBuilt: M.referenceYear - ageYears, hours, cycles,
      condition, maintenance, price: priceOf(typeId, tier, ageYears, condition) });
    covered.add(typeId);
  };

  // 1) Garanties
  const ratings = state.pilot.ratings;
  const groups = typeGroups(ratings);
  const types = Object.keys(BALANCE.fleetTypes);
  for (const rating of Object.keys(BALANCE.ratings).filter(r => ratings.includes(r))) {
    const ofRating = types.filter(t => BALANCE.fleetTypes[t].rating === rating);
    for (const tier of GUARANTEED_TIERS) {
      const fresh = ofRating.filter(t => !covered.has(t));
      add(pick(fresh.length ? fresh : ofRating), tier);
    }
  }
  for (const typeId of groups.rated) if (!covered.has(typeId)) add(typeId, pickTier());

  // 2) Fins a n
  const n = randInt(M.listings[0], M.listings[1]);
  while (listings.length < n) {
    const group = groups[weighted(M.mix)];
    const pool = group.length ? group : groups.rated.length ? groups.rated : types;
    add(pick(pool), pickTier());
  }
  return { epoch, listings };
}

/** Mercat al dia amb el rellotge de la partida. Vegeu la capcalera. */
export function refreshMarket(state) {
  const epoch = marketEpoch(state.clock.minute);
  if (state.market && state.market.epoch >= epoch) return state;
  return { ...state, market: generateMarket(state, epoch) };
}
