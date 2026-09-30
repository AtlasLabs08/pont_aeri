/* Proves de career/market.js (D2+D5): mercat d ocasio, categories i preu
 * dins de la categoria (docs/DECISIONS.md, 30/09/2026, G2-G4).
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  BALANCE, createCareer, validate, graduate, LESSONS,
  DEFAULT_TIER, GUARANTEED_TIERS, tierOf, airframeTier, marketEpoch, priceOf, typeGroups,
  generateMarket, refreshMarket
} from '../../src/career/index.js';

const M = BALANCE.market;
const RATING_ORDER = Object.keys(BALANCE.ratings);
const ratingOf = typeId => BALANCE.fleetTypes[typeId].rating;

/** Partida amb aquestes habilitacions i llavor. */
function career(ratings = ['commuter'], seed = 20260930) {
  const s = createCareer({ name: 'Mercat', seed, createdAt: '' });
  s.pilot.ratings = [...ratings];
  s.company.bases = ['LEBL'];
  return s;
}

/** Nombre d anuncis garantits (G4, pas 1) per a aquestes habilitacions. */
function guaranteeCount(ratings) {
  const held = RATING_ORDER.filter(r => ratings.includes(r));
  const types = Object.keys(BALANCE.fleetTypes);
  let n = 0;
  for (const r of held) {
    const ofRating = types.filter(t => ratingOf(t) === r);
    n += GUARANTEED_TIERS.length + Math.max(0, ofRating.length - GUARANTEED_TIERS.length);
  }
  return n;
}

const cond = v => ({ engines: v, gear: v, airframe: v, avionics: v });

describe('tierOf i airframeTier', () => {
  test('tierOf torna el tram; null i undefined son standard; clau desconeguda llanca', () => {
    for (const t of M.tiers) assert.equal(tierOf(t.key), t);
    assert.equal(tierOf(undefined).key, DEFAULT_TIER);
    assert.equal(tierOf(null).key, DEFAULT_TIER);
    assert.throws(() => tierOf('gold'), /gold/);
  });

  test('un avio sense tier es standard', () => {
    assert.equal(airframeTier({}), 'standard');
    assert.equal(airframeTier({ tier: 'deluxe' }), 'deluxe');
  });
});

describe('priceOf (G3)', () => {
  test('els extrems donen exactament els limits de priceFactor de cada categoria', () => {
    for (const typeId of Object.keys(BALANCE.usedPrice)) {
      for (const t of M.tiers) {
        const used = BALANCE.usedPrice[typeId];
        assert.equal(priceOf(typeId, t.key, t.ageYears[0], cond(t.condition[1])), Math.round(used * t.priceFactor[1]), typeId + ' ' + t.key + ' millor');
        assert.equal(priceOf(typeId, t.key, t.ageYears[1], cond(t.condition[0])), Math.round(used * t.priceFactor[0]), typeId + ' ' + t.key + ' pitjor');
        // fora del tram es retalla
        assert.equal(priceOf(typeId, t.key, 0, cond(100)), Math.round(used * t.priceFactor[1]));
        assert.equal(priceOf(typeId, t.key, 99, cond(0)), Math.round(used * t.priceFactor[0]));
      }
    }
  });

  test('creix amb l estat i baixa amb l edat', () => {
    for (const t of M.tiers) {
      const [a0, a1] = t.ageYears, [c0, c1] = t.condition;
      const midAge = (a0 + a1) / 2, midCond = (c0 + c1) / 2;
      assert.ok(priceOf('nb', t.key, midAge, cond(c1)) > priceOf('nb', t.key, midAge, cond(midCond)), t.key + ' estat');
      assert.ok(priceOf('nb', t.key, midAge, cond(midCond)) > priceOf('nb', t.key, midAge, cond(c0)), t.key + ' estat');
      assert.ok(priceOf('nb', t.key, a0, cond(midCond)) > priceOf('nb', t.key, midAge, cond(midCond)), t.key + ' edat');
      assert.ok(priceOf('nb', t.key, midAge, cond(midCond)) > priceOf('nb', t.key, a1, cond(midCond)), t.key + ' edat');
    }
  });

  test('mitjana dels quatre sistemes, i un numero es la mitjana', () => {
    const t = tierOf('premium');
    const mixed = { engines: 85, gear: 96, airframe: 85, avionics: 96 };
    assert.equal(priceOf('tp', 'premium', 9, mixed), priceOf('tp', 'premium', 9, 90.5));
    // 1.800.000 * lerp(1,0; 1,2; 0,5 * (1 - 4/9) + 0,5 * (5,5/11)) = 1.800.000 * 1,1055... -> 1.990.000
    const score = 0.5 * (1 - (9 - t.ageYears[0]) / (t.ageYears[1] - t.ageYears[0])) + 0.5 * 0.5;
    assert.equal(priceOf('tp', 'premium', 9, mixed), Math.round(1800000 * (1 + 0.2 * score)));
  });

  test('llanca amb un tipus o una categoria desconeguts', () => {
    assert.throws(() => priceOf('zeppelin', 'basic', 5, cond(80)), /zeppelin/);
    assert.throws(() => priceOf('nb', 'gold', 5, cond(80)), /gold/);
    assert.throws(() => priceOf('nb', 'basic', NaN, cond(80)), /finits/);
  });
});

describe('marketEpoch i typeGroups', () => {
  test('un epoch per regenMinutes', () => {
    assert.equal(marketEpoch(0), 0);
    assert.equal(marketEpoch(M.regenMinutes - 1), 0);
    assert.equal(marketEpoch(M.regenMinutes), 1);
    assert.equal(marketEpoch(5 * M.regenMinutes + 3), 5);
  });

  test('rated, next i other segons les habilitacions i l ordre de BALANCE.ratings', () => {
    const g = typeGroups(['commuter']);
    assert.deepEqual(g.rated, ['commuter']);
    assert.deepEqual(g.next.sort(), ['tp', 'tpShort']);
    assert.equal(g.other.length, Object.keys(BALANCE.fleetTypes).length - 3);
    const all = typeGroups(RATING_ORDER);
    assert.equal(all.rated.length, Object.keys(BALANCE.fleetTypes).length);
    assert.deepEqual(all.next, []);
    assert.deepEqual(all.other, []);
    // l ordre de pilot.ratings no compta: la seguent es la primera de BALANCE.ratings que falta
    assert.deepEqual(typeGroups(['narrowbody', 'commuter']).next.sort(), ['tp', 'tpShort']);
  });
});

describe('generateMarket (G4)', () => {
  test('mateixa llavor i epoch: mateixa llista; no canvia rngCounter ni la partida', () => {
    const s = career();
    s.rngCounter = 17;
    const before = structuredClone(s);
    const a = generateMarket(s, 4), b = generateMarket(s, 4);
    assert.deepEqual(a, b);
    assert.equal(s.rngCounter, 17);
    assert.deepEqual(s, before);
    assert.equal(a.epoch, 4);
  });

  test('epoch diferent o llavor diferent: llista diferent', () => {
    const s = career();
    const base = generateMarket(s, 0).listings;
    assert.notDeepEqual(generateMarket(s, 1).listings, base);
    assert.notDeepEqual(generateMarket(career(['commuter'], 1), 0).listings, base);
  });

  test('nombre d anuncis dins de listings, o igual a les garanties si en passen', () => {
    const sets = [[], ['commuter'], ['commuter', 'turboprop'], ['commuter', 'turboprop', 'narrowbody'], RATING_ORDER];
    for (const ratings of sets) {
      const g = guaranteeCount(ratings);
      for (let epoch = 0; epoch < 40; epoch++) {
        const n = generateMarket(career(ratings), epoch).listings.length;
        if (g >= M.listings[1]) assert.equal(n, g, ratings.join(',') + ' @' + epoch);
        else assert.ok(n >= Math.max(M.listings[0], g) && n <= M.listings[1], ratings.join(',') + ' @' + epoch + ': ' + n);
      }
    }
  });

  test('matricules EC-XXX uniques, i cap de la flota', () => {
    const s = career(RATING_ORDER);
    s.fleet = [{ reg: 'EC-AAA' }];
    for (let epoch = 0; epoch < 60; epoch++) {
      const regs = generateMarket(s, epoch).listings.map(l => l.reg);
      for (const r of regs) assert.match(r, /^EC-[A-Z]{3}$/);
      assert.equal(new Set(regs).size, regs.length);
      assert.ok(!regs.includes('EC-AAA'));
    }
  });

  for (const ratings of [['commuter'], ['commuter', 'turboprop'], RATING_ORDER]) {
    test('garanties amb ' + ratings.length + ' habilitacio(ns)', () => {
      for (let epoch = 0; epoch < 30; epoch++) {
        const L = generateMarket(career(ratings, 7 + epoch), epoch).listings;
        const held = RATING_ORDER.filter(r => ratings.includes(r));
        // primer, basic i standard de cada habilitacio, en ordre, preferint tipus no coberts
        const seen = new Set();
        held.forEach((r, i) => {
          GUARANTEED_TIERS.forEach((tier, j) => {
            const l = L[i * GUARANTEED_TIERS.length + j];
            assert.equal(ratingOf(l.typeId), r);
            assert.equal(l.tier, tier);
            const ofRating = Object.keys(BALANCE.fleetTypes).filter(t => ratingOf(t) === r);
            if (ofRating.some(t => !seen.has(t))) assert.ok(!seen.has(l.typeId), 'tipus no cobert ' + l.typeId);
            seen.add(l.typeId);
          });
        });
        // despres, cada tipus rated te com a minim un anunci
        for (const t of typeGroups(ratings).rated) assert.ok(L.some(l => l.typeId === t), t);
      }
    });
  }

  test('cada anunci te edat, estat, hores, revisions i preu dins dels trams de la seva categoria', () => {
    for (let epoch = 0; epoch < 60; epoch++) {
      for (const l of generateMarket(career(RATING_ORDER.slice(0, 1 + epoch % 5)), epoch).listings) {
        const t = tierOf(l.tier), cls = BALANCE.fleetTypes[l.typeId].cls;
        const age = M.referenceYear - l.yearBuilt;
        assert.ok(Number.isInteger(age) && age >= t.ageYears[0] && age <= t.ageYears[1], l.reg + ' edat ' + age);
        for (const v of Object.values(l.condition)) {
          assert.ok(Number.isInteger(v) && v >= t.condition[0] && v <= t.condition[1], l.reg + ' estat ' + v);
        }
        const used = BALANCE.usedPrice[l.typeId];
        assert.ok(l.price >= Math.round(used * t.priceFactor[0]) && l.price <= Math.round(used * t.priceFactor[1]), l.reg + ' preu');
        assert.equal(l.price, priceOf(l.typeId, l.tier, age, l.condition));
        const base = age * M.hoursPerYear[cls];
        assert.ok(l.hours >= Math.round(base * (1 - M.hoursJitter)) && l.hours <= Math.round(base * (1 + M.hoursJitter)), l.reg + ' hores');
        assert.equal(l.cycles, Math.round(l.hours / M.hoursPerCycle[cls]));
        const toA = l.maintenance.nextAHours - l.hours, toC = l.maintenance.nextCHours - l.hours;
        assert.ok(toA >= 1 && toA <= BALANCE.checks.A.intervalHours, l.reg + ' A');
        assert.ok(toC >= 1 && toC <= BALANCE.checks.C.intervalHours, l.reg + ' C');
      }
    }
  });

  test('pesos de mix i tierWeights sobre moltes llistes, sense comptar les garanties', () => {
    const ratings = ['commuter'], g = typeGroups(ratings), skip = guaranteeCount(ratings);
    const groups = { rated: 0, next: 0, other: 0 }, tiers = Object.fromEntries(M.tiers.map(t => [t.key, 0]));
    let n = 0;
    for (let epoch = 0; epoch < 3000; epoch++) {
      for (const l of generateMarket(career(ratings), epoch).listings.slice(skip)) {
        groups[Object.keys(g).find(k => g[k].includes(l.typeId))]++;
        tiers[l.tier]++;
        n++;
      }
    }
    assert.ok(n > 15000, String(n));
    for (const [k, w] of Object.entries(M.mix)) assert.ok(Math.abs(groups[k] / n - w) < 0.015, 'mix ' + k + ' ' + groups[k] / n);
    for (const [k, w] of Object.entries(M.tierWeights)) assert.ok(Math.abs(tiers[k] / n - w) < 0.015, 'tier ' + k + ' ' + tiers[k] / n);
  });

  test('en graduar-se hi ha un Mi-9 basic i un d standard', () => {
    const s = createCareer({ name: 'Nova', seed: 314159, createdAt: '' });
    const g = refreshMarket(graduate({ ...s, school: { ...s.school, lessonsPassed: LESSONS.map(l => l.id) } }));
    assert.ok(g.market.listings.some(l => l.typeId === 'commuter' && l.tier === 'basic'));
    assert.ok(g.market.listings.some(l => l.typeId === 'commuter' && l.tier === 'standard'));
    assert.equal(validate(g).ok, true);
  });
});

describe('refreshMarket (G4)', () => {
  test('una partida sense market la completa, valida, sense tocar rngCounter', () => {
    const s = career();
    const r = refreshMarket(s);
    assert.notEqual(r, s);
    assert.equal(s.market, undefined);
    assert.equal(r.market.epoch, 0);
    assert.deepEqual(r.market, generateMarket(s, 0));
    assert.equal(r.rngCounter, s.rngCounter);
    assert.deepEqual(validate(r), { ok: true, errors: [] });
  });

  test('regenera just al canvi d epoch, i no abans', () => {
    const s = refreshMarket(career());
    const before = { ...s, clock: { minute: M.regenMinutes - 1 } };
    assert.equal(refreshMarket(before), before);
    const after = refreshMarket({ ...s, clock: { minute: M.regenMinutes } });
    assert.equal(after.market.epoch, 1);
    assert.deepEqual(after.market, generateMarket(s, 1));
  });

  test('un epoch desat mes gran que el del rellotge (boto DEV) no es torna a generar', () => {
    const s = refreshMarket(career());
    const dev = { ...s, market: generateMarket(s, s.market.epoch + 1) };
    assert.equal(refreshMarket(dev), dev);
  });
});
