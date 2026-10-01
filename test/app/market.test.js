/* Proves de src/app/market.js i del mercat a app/airline.js (D2+D5,
 * docs/DECISIONS.md 30/09/2026): models de les pestanyes Fleet i Market,
 * comprar, vendre, desar i el boto DEV.
 *
 * Node no te localStorage: cada prova injecta un doble a globalThis, com a
 * airline.test.js.
 *
 * Correr:  npm test
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createCareer, LESSONS, BALANCE, financeAircraft, tierOf } from '../../src/career/index.js';
import { on, _resetBus } from '../../src/app/bus.js';
import { CAREER_KEY } from '../../src/app/save.js';
import {
  openAirline, currentCareer, createAirline, unlockAllLessons, graduateCareer, topBarModel,
  ensureMarket, _resetAirline
} from '../../src/app/airline.js';
import {
  MINUTES_PER_DAY, listingOffer, cardModel, marketModel, fleetModel, buyListing, sellAirframe, devNewMarket
} from '../../src/app/market.js';
import {
  AIRCRAFT_IMAGES, IMAGE_DIR, SILHOUETTES, silhouetteOf, imageOf
} from '../../src/app/aircraft-images.js';

class FakeStorage {
  constructor() { this.data = new Map(); }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}

const ORIGINAL = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let store;

beforeEach(() => {
  store = new FakeStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  _resetAirline();
});

afterEach(() => {
  if (ORIGINAL) Object.defineProperty(globalThis, 'localStorage', ORIGINAL);
  else delete globalThis.localStorage;
  _resetBus();
  _resetAirline();
});

const stored = () => JSON.parse(store.getItem(CAREER_KEY));

/** Partida creada, amb totes les llicons i graduada: el punt de partida del centre d operacions. */
function graduatedCareer() {
  createAirline('Flota', { seed: 20260930, createdAt: '2026-09-30T10:00:00.000Z' });
  unlockAllLessons();
  graduateCareer();
  return currentCareer();
}

const basicMi9 = s => s.market.listings.find(l => l.typeId === 'commuter' && l.tier === 'basic');

describe('mercat en graduar-se i en carregar (G11)', () => {
  test('graduateCareer deixa la partida amb el primer mercat, desat', () => {
    const s = graduatedCareer();
    assert.ok(s.market && s.market.listings.length > 0);
    assert.ok(basicMi9(s));
    assert.deepEqual(stored().market, s.market);
  });

  test('una partida graduada desada sense market el genera en carregar-la, i la desa', () => {
    const s = graduatedCareer();
    const raw = { ...s };
    delete raw.market;
    store.setItem(CAREER_KEY, JSON.stringify(raw));
    _resetAirline();
    assert.equal(openAirline().status, 'ok');
    assert.deepEqual(currentCareer().market, s.market);
    assert.deepEqual(stored().market, s.market);
  });

  test('ensureMarket no fa res si el mercat es al dia; a l escola no en genera', () => {
    graduatedCareer();
    assert.equal(ensureMarket(), false);
    _resetAirline();
    createAirline('Escola', { seed: 1, createdAt: '' });
    assert.equal(ensureMarket(), false);
    assert.equal(currentCareer().market, undefined);
  });
});

describe('cardModel i imatges (K4, K5)', () => {
  const cardOf = (s, l) => cardModel(listingOffer(s, l));
  const sample = (s, over) => ({ ...basicMi9(s), ...over });

  test('targeta d una oferta: etiqueta, preu actual i preu ratllat, dades curtes', () => {
    const s = graduatedCareer(), base = basicMi9(s);
    const l = sample(s, { listPrice: 400000, offerPct: 0.15, price: 340000, hours: 12345.4,
      condition: { engines: 60, gear: 70, airframe: 80, avionics: 91 } });
    const c = cardOf(s, l);
    assert.equal(c.reg, base.reg);
    assert.equal(c.name, 'Migjorn Mi-9');
    assert.equal(c.tier, 'basic');
    assert.equal(c.year, base.yearBuilt);
    assert.equal(c.isOffer, true);
    assert.equal(c.offerPct, 15);
    assert.equal(c.price, 340000);
    assert.equal(c.listPrice, 400000);
    assert.equal(c.hours, 12345);
    assert.equal(c.condition, 75);
    assert.equal(c.revenueMult, tierOf('basic').revenueMult);
  });

  test('sense oferta no hi ha etiqueta ni preu ratllat; un anunci d abans de K1 es llegeix igual', () => {
    const s = graduatedCareer(), base = basicMi9(s);
    const plain = cardOf(s, sample(s, { listPrice: base.price, offerPct: 0 }));
    assert.deepEqual([plain.isOffer, plain.offerPct, plain.listPrice, plain.price], [false, 0, null, base.price]);
    const { listPrice, offerPct, ...old } = base;
    assert.deepEqual(cardOf(s, old), cardOf(s, { ...old, listPrice: old.price, offerPct: 0 }));
    assert.equal(cardOf(s, old).isOffer, false);
  });

  test('el percentatge de l etiqueta arrodoneix l offerPct', () => {
    const s = graduatedCareer();
    assert.equal(cardOf(s, sample(s, { offerPct: 0.104, listPrice: 1000, price: 896 })).offerPct, 10);
    assert.equal(cardOf(s, sample(s, { offerPct: 0.196, listPrice: 1000, price: 804 })).offerPct, 20);
  });

  test('sense habilitacio: targeta bloquejada amb l habilitacio que falta; amb ella, no', () => {
    const s = graduatedCareer();
    const nb = { ...basicMi9(s), typeId: 'nb', tier: 'standard' };
    const c = cardOf(s, nb);
    assert.equal(c.locked, true);
    assert.equal(c.missingRating, 'narrowbody');
    const mi9 = cardOf(s, basicMi9(s));
    assert.deepEqual([mi9.locked, mi9.missingRating], [false, null]);
    const withRating = { ...s, pilot: { ...s.pilot, ratings: [...s.pilot.ratings, 'narrowbody'] } };
    assert.deepEqual([cardOf(withRating, nb).locked, cardOf(withRating, nb).missingRating], [false, null]);
  });

  test('sense imatge al mapa, silueta de la classe; amb imatge, la URL i cap silueta', () => {
    const s = graduatedCareer(), l = basicMi9(s);
    assert.equal(imageOf('commuter'), null);
    const c = cardOf(s, l);
    assert.deepEqual([c.image, c.silhouette], [null, 'commuter']);
    // un render nou es nomes un fitxer a public/aircraft/ i una linia al mapa
    assert.equal(imageOf('commuter', { commuter: 'mi-9.webp' }), 'aircraft/mi-9.webp');
    assert.equal(imageOf('nb', { commuter: 'mi-9.webp' }), null);
    assert.equal(Object.isFrozen(AIRCRAFT_IMAGES), true);
  });

  test('imageOf prefixa IMAGE_DIR; cada tipus del joc te silueta, i la silueta es una de les sis', () => {
    assert.equal(IMAGE_DIR, 'aircraft/');
    assert.deepEqual([...SILHOUETTES], ['commuter', 'turboprop', 'regionalJet', 'narrowbody', 'widebody', 'jumbo']);
    for (const typeId of Object.keys(BALANCE.fleetTypes)) {
      assert.ok(SILHOUETTES.includes(silhouetteOf(typeId)), typeId);
    }
    assert.deepEqual(Object.keys(BALANCE.usedPrice).sort(), Object.keys(BALANCE.usedPrice).filter(t => SILHOUETTES.includes(silhouetteOf(t))).sort());
    for (const typeId of Object.keys(AIRCRAFT_IMAGES)) {
      assert.ok(Object.hasOwn(BALANCE.usedPrice, typeId), 'imatge d un tipus que no existeix: ' + typeId);
      assert.equal(imageOf(typeId), IMAGE_DIR + AIRCRAFT_IMAGES[typeId]);
    }
  });

  test('la silueta segueix la classe: jumbo, widebody, narrowbody, jet regional, turbohelix i commuter', () => {
    const by = { commuter: 'commuter', tp: 'turboprop', tpShort: 'turboprop', rj: 'regionalJet',
      nb: 'narrowbody', nbShort: 'narrowbody', nbStretch: 'narrowbody', wb: 'widebody', wbEr: 'widebody', jumbo: 'jumbo' };
    for (const [typeId, sil] of Object.entries(by)) assert.equal(silhouetteOf(typeId), sil, typeId);
  });
});

describe('marketModel i listingOffer', () => {
  test('grups per habilitacio en l ordre de BALANCE.ratings; renovacio cada dia de joc', () => {
    const s = graduatedCareer(), m = marketModel(s);
    const order = Object.keys(BALANCE.ratings);
    assert.deepEqual(m.groups.map(g => g.rating), order.filter(r => m.groups.some(g => g.rating === r)));
    assert.equal(m.groups.reduce((n, g) => n + g.offers.length, 0), s.market.listings.length);
    assert.equal(m.count, s.market.listings.length);
    assert.equal(m.renewDays, BALANCE.market.regenMinutes / MINUTES_PER_DAY);
    assert.equal(m.renewDays, 1);
  });

  test('desglossament de les dues modalitats, i revisions pendents en hores que falten', () => {
    const s = graduatedCareer(), l = basicMi9(s), o = listingOffer(s, l);
    const f = financeAircraft(l.price);
    assert.equal(o.name, 'Migjorn Mi-9');
    assert.equal(o.tier, tierOf('basic'));
    assert.equal(o.hasRating, true);
    assert.equal(o.cash.ok, true);
    assert.equal(o.cash.cashAfter, s.company.cash - l.price);
    assert.equal(o.financed.ok, true);
    assert.equal(o.financed.downPayment, f.downPayment);
    assert.equal(o.financed.loan.instalment, f.loan.instalment);
    assert.equal(o.financed.totalCost, f.loan.instalment * f.loan.termFlights);
    assert.equal(o.toA, l.maintenance.nextAHours - l.hours);
    assert.equal(o.ageYears, BALANCE.market.referenceYear - l.yearBuilt);
  });

  test('sense habilitacio, les dues opcions desactivades amb el motiu rating (G7)', () => {
    const s = graduatedCareer();
    const l = { ...basicMi9(s), typeId: 'nb', price: 1000 };
    const o = listingOffer(s, l);
    assert.equal(o.hasRating, false);
    assert.equal(o.rating, 'narrowbody');
    assert.deepEqual([o.cash.ok, o.cash.reason, o.financed.ok, o.financed.reason], [false, 'rating', false, 'rating']);
  });
});

describe('buyListing, fleetModel i sellAirframe', () => {
  test('comprar al comptat: desa, emet career:changed, l anunci surt i la barra superior compta l avio', () => {
    const s = graduatedCareer(), l = basicMi9(s);
    let events = 0;
    on('career:changed', () => { events++; });
    const r = buyListing(l.reg, 'cash');
    assert.equal(r.ok, true);
    assert.equal(r.saved, true);
    assert.equal(events, 1);
    const n = currentCareer();
    assert.equal(n.company.cash, s.company.cash - l.price);
    assert.ok(!n.market.listings.some(x => x.reg === l.reg));
    assert.deepEqual(stored(), n);
    const bar = topBarModel(n);
    assert.deepEqual([bar.fleetReady, bar.fleetTotal], [1, 1]);
  });

  test('comprar financat: la fila de la flota porta la quota i els vols que queden', () => {
    const s = graduatedCareer(), l = basicMi9(s);
    assert.equal(buyListing(l.reg, 'financed').ok, true);
    const [row] = fleetModel(currentCareer());
    const f = financeAircraft(l.price);
    assert.equal(row.airframe.reg, l.reg);
    assert.equal(row.tier.key, 'basic');
    assert.deepEqual(row.loan, { id: 'L-' + l.reg, instalment: f.loan.instalment, flightsLeft: f.loan.termFlights, balance: f.loan.principal });
    assert.equal(row.toA, l.maintenance.nextAHours - l.hours);
    assert.equal(row.quote.ok, true);
  });

  test('sense coixi o sense habilitacio no es compra i no es desa res', () => {
    const s = graduatedCareer();
    const before = store.getItem(CAREER_KEY);
    const tp = s.market.listings.find(l => BALANCE.fleetTypes[l.typeId].rating !== 'commuter');
    if (tp) assert.deepEqual(buyListing(tp.reg, 'cash'), { ok: false, reason: 'rating' });
    const mi9 = basicMi9(s);
    assert.equal(buyListing(mi9.reg, 'cash').ok, true);
    const other = currentCareer().market.listings.find(l => l.typeId === 'commuter');
    const r = buyListing(other.reg, 'cash');
    assert.equal(r.ok, false);
    assert.ok(['cash', 'reserve'].includes(r.reason));
    assert.deepEqual(buyListing('EC-ZZZ', 'cash'), { ok: false, reason: 'unknown' });
    assert.notEqual(store.getItem(CAREER_KEY), before);
  });

  test('vendre: cancel.la el prestec, torna el net i desa', () => {
    const s = graduatedCareer(), l = basicMi9(s);
    buyListing(l.reg, 'financed');
    const mid = currentCareer(), q = fleetModel(mid)[0].quote;
    const r = sellAirframe(l.reg);
    assert.equal(r.ok, true);
    assert.equal(r.net, q.net);
    const n = currentCareer();
    assert.equal(n.company.cash, mid.company.cash + q.net);
    assert.deepEqual(n.fleet, []);
    assert.ok(!n.company.loans.some(x => x.id === 'L-' + l.reg));
    assert.deepEqual(stored(), n);
    assert.deepEqual(sellAirframe(l.reg), { ok: false, reason: 'unknown' });
  });
});

describe('devNewMarket (boto DEV)', () => {
  test('genera la llista de l epoch seguent al desat i la desa; el rellotge no la torna enrere', () => {
    const s = graduatedCareer();
    assert.equal(devNewMarket(), true);
    const n = currentCareer();
    assert.equal(n.market.epoch, s.market.epoch + 1);
    assert.notDeepEqual(n.market.listings, s.market.listings);
    assert.deepEqual(stored().market, n.market);
    assert.equal(ensureMarket(), false);
    _resetAirline();
    assert.equal(devNewMarket(), false);
  });
});
