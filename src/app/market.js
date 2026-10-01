/* Pestanyes Fleet i Market del centre d operacions (D2+D5, docs/DECISIONS.md
 * 30/09/2026, G1-G9): models purs que ui/ nomes pinta, i les operacions que
 * canvien la partida (comprar, vendre, boto DEV), que la desen i emeten
 * 'career:changed' amb updateCareer (airline.js).
 * NOU: tasques D2+D5 d ENGINEERING.md.
 *
 * EXPORTA: MINUTES_PER_DAY listingOffer marketModel fleetModel buyListing
 *          sellAirframe devNewMarket
 *
 * IMPORTA: career/ (BALANCE, tierOf, airframeTier, purchaseRule,
 *   buyAircraft, sellQuote, sellAircraft, generateMarket, marketEpoch),
 *   AIRCRAFT de core/ (noms dels models, que no es tradueixen),
 *   currentCareer i updateCareer d airline.js.
 *
 * INTERFICIE (no la canviis, ui/, index.html i els tests en depenen):
 *   MINUTES_PER_DAY = 1440
 *   listingOffer(state, listing) -> { listing, name, tier, rating, hasRating,
 *     ageYears, toA, toC, cash, financed }
 *     tier = el tram de BALANCE.market.tiers (revenueMult, wearMult);
 *     toA / toC = hores que falten per a l A-check i el C-check; cash i
 *     financed = purchaseRule de cada modalitat, amb reason 'rating' si el
 *     pilot no te l habilitacio (G7, passa per davant); financed porta a
 *     mes totalCost = instalment * termFlights (cost total del prestec).
 *   marketModel(state) -> { groups: [{ rating, offers }], renewDays, count }
 *     una llista per habilitacio, en l ordre de BALANCE.ratings (commuter,
 *     turboprop, narrowbody, widebody, quad = jumbo), nomes les que tenen
 *     anuncis; renewDays = market.regenMinutes / MINUTES_PER_DAY.
 *   fleetModel(state) -> [{ airframe, name, tier, toA, toC, loan, quote }]
 *     loan = { id, instalment, flightsLeft, balance } o null (al comptat o
 *     ja tornat); quote = sellQuote (G9).
 *   buyListing(reg, mode) -> { ok, reason?, airframe?, saved? }
 *     reason 'none' (sense partida), 'unknown' (l anunci no hi es) o el de
 *     buyAircraft ('rating', 'base', 'cash', 'reserve').
 *   sellAirframe(reg) -> { ok, reason?, quote?, loanBalance?, net?, saved? }
 *   devNewMarket() -> boolean   DEV: llista de l epoch seguent al desat
 *     (o al del rellotge, si no n hi ha), i la desa. false sense partida.
 */

import {
  BALANCE, tierOf, airframeTier, purchaseRule, buyAircraft, sellQuote, sellAircraft,
  generateMarket, marketEpoch
} from '../career/index.js';
import { AIRCRAFT } from '../core/index.js';
import { currentCareer, updateCareer } from './airline.js';

export const MINUTES_PER_DAY = 1440;

const nameOf = typeId => AIRCRAFT[typeId] ? AIRCRAFT[typeId].name : typeId;

export function listingOffer(state, listing) {
  const rating = BALANCE.fleetTypes[listing.typeId].rating;
  const hasRating = state.pilot.ratings.includes(rating);
  const co = state.company;
  const rule = mode => {
    const r = purchaseRule({ cash: co.cash, loans: co.loans, price: listing.price, mode });
    return hasRating ? r : { ...r, ok: false, reason: 'rating' };
  };
  const financed = rule('financed');
  return {
    listing, name: nameOf(listing.typeId), tier: tierOf(listing.tier), rating, hasRating,
    ageYears: BALANCE.market.referenceYear - listing.yearBuilt,
    toA: listing.maintenance.nextAHours - listing.hours,
    toC: listing.maintenance.nextCHours - listing.hours,
    cash: rule('cash'),
    financed: { ...financed, totalCost: financed.loan.instalment * financed.loan.termFlights }
  };
}

export function marketModel(state) {
  const listings = state.market ? state.market.listings : [];
  const groups = Object.keys(BALANCE.ratings).map(rating => ({
    rating,
    offers: listings.filter(l => BALANCE.fleetTypes[l.typeId].rating === rating).map(l => listingOffer(state, l))
  })).filter(g => g.offers.length > 0);
  return { groups, renewDays: BALANCE.market.regenMinutes / MINUTES_PER_DAY, count: listings.length };
}

export function fleetModel(state) {
  return state.fleet.map(a => {
    const l = a.finance.loanId === null ? null : state.company.loans.find(x => x.id === a.finance.loanId) ?? null;
    return {
      airframe: a, name: nameOf(a.typeId), tier: tierOf(airframeTier(a)),
      toA: a.maintenance.nextAHours - a.hours,
      toC: a.maintenance.nextCHours - a.hours,
      loan: l && l.balance > 0 ? { id: l.id, instalment: l.instalment, flightsLeft: l.termFlights - l.flightsPaid, balance: l.balance } : null,
      quote: sellQuote(state, a.reg)
    };
  });
}

export function buyListing(reg, mode) {
  const state = currentCareer();
  if (!state) return { ok: false, reason: 'none' };
  const listing = state.market ? state.market.listings.find(l => l.reg === reg) : null;
  if (!listing) return { ok: false, reason: 'unknown' };
  const r = buyAircraft(state, listing, mode);
  if (!r.ok) return r;
  return { ok: true, airframe: r.airframe, saved: updateCareer(r.state) };
}

export function sellAirframe(reg) {
  const state = currentCareer();
  if (!state) return { ok: false, reason: 'none' };
  const r = sellAircraft(state, reg);
  if (!r.ok) return r;
  return { ok: true, quote: r.quote, loanBalance: r.loanBalance, net: r.net, saved: updateCareer(r.state) };
}

export function devNewMarket() {
  const state = currentCareer();
  if (!state) return false;
  const epoch = (state.market ? state.market.epoch : marketEpoch(state.clock.minute)) + 1;
  updateCareer({ ...state, market: generateMarket(state, epoch) });
  return true;
}
