/* Proves de tools/balance.mjs (tasca B5): el harness economic es
 * determinista. Nomes 20 vols, perque sigui rapida.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { runBalance, startState, formatReport, HARNESS, harnessPurchase } from '../tools/balance.mjs';
import { createCareer, graduate, startingCompany, LESSONS, BALANCE, tierOf } from '../src/career/index.js';

/** graduate de career/, la del joc, sobre una partida nova amb totes les llicons aprovades */
function gameGraduation(seed) {
  const s = createCareer({ name: 'Joc', seed, createdAt: '' });
  return graduate({ ...s, school: { ...s.school, lessonsPassed: LESSONS.map(l => l.id) } });
}

describe('harness economic', () => {
  test('la mateixa llavor dona exactament el mateix resultat dues vegades', () => {
    const a = runBalance({ seed: 12345, flights: 20 });
    const b = runBalance({ seed: 12345, flights: 20 });
    assert.equal(a.log.length, 20);
    assert.deepEqual(a.log, b.log);
    assert.deepEqual(a.state, b.state);
    assert.equal(formatReport(a), formatReport(b));
  });

  test('una altra llavor dona una altra partida', () => {
    const a = runBalance({ seed: 12345, flights: 20 });
    const b = runBalance({ seed: 54321, flights: 20 });
    assert.notDeepEqual(a.log, b.log);
  });

  test('la llavor per defecte torna metriques finites i valid definit', () => {
    const r = runBalance();
    assert.equal(r.seed, HARNESS.seed);
    assert.equal(r.log.length, HARNESS.flights);
    assert.ok(r.valid && typeof r.valid.ok === 'boolean', 'valid definit');
    const m = r.metrics;
    const values = [m.firstCrew, ...m.jumps, m.negativePct, ...Object.values(m.actHours)];
    assert.ok(m.jumps.length > 0 && Object.keys(m.actHours).length > 0);
    for (const v of values) assert.ok(Number.isFinite(v), String(v));
  });

  test('el joc es gradua exactament al punt de partida del harness: saldo, credit, reputacio, base i pilot', () => {
    const h = startState({ seed: 777 }), g = gameGraduation(777);
    for (const k of ['cash', 'loans', 'reputation', 'bases']) assert.deepEqual(g.company[k], h.company[k], k);
    assert.deepEqual(g.company, { ...h.company });
    assert.deepEqual(g.network, h.network);
    assert.deepEqual(g.pilot, { ...h.pilot, name: 'Joc' });
    assert.equal(g.school.graduated, true);
    // tots dos surten de la funcio compartida, no de numeros copiats
    const shared = startingCompany(createCareer({}).company);
    for (const k of ['cash', 'loans', 'reputation', 'bases']) assert.deepEqual(h.company[k], shared[k], k);
  });
});

describe('harness economic: compres (D2+D5)', () => {
  test('mode per defecte: preu usedPrice, estat 100, categoria standard i multiplicadors 1', () => {
    const b = harnessPurchase('nb', 2);
    assert.equal(b.listing.price, BALANCE.usedPrice.nb);
    assert.equal(b.listing.tier, 'standard');
    assert.deepEqual(b.listing.condition, { engines: 100, gear: 100, airframe: 100, avionics: 100 });
    assert.deepEqual([b.revenueMult, b.wearMult], [1, 1]);
  });

  test('--tier: punt mig del priceFactor i del condition, i els multiplicadors de la categoria', () => {
    for (const t of BALANCE.market.tiers) {
      const b = harnessPurchase('tp', 1, t.key), c = (t.condition[0] + t.condition[1]) / 2;
      assert.equal(b.listing.price, Math.round(BALANCE.usedPrice.tp * (t.priceFactor[0] + t.priceFactor[1]) / 2), t.key);
      assert.equal(b.listing.tier, t.key);
      assert.deepEqual(b.listing.condition, { engines: c, gear: c, airframe: c, avionics: c });
      assert.deepEqual([b.revenueMult, b.wearMult], [t.revenueMult, t.wearMult]);
    }
    assert.throws(() => runBalance({ flights: 1, tier: 'gold' }), /gold/);
  });

  test('--tier: tots els avions de la categoria, estat final valid i determinista', () => {
    for (const tier of [null, 'basic', 'deluxe']) {
      const r = runBalance({ seed: 20260927, flights: 120, tier });
      assert.ok(r.purchases.length >= 2, String(tier));
      assert.equal(r.valid.ok, true, r.valid.errors.join('; '));
      for (const a of r.state.fleet) assert.equal(a.tier, tierOf(tier).key);
      // mode per defecte: el primer avio al comptat; amb --tier, tots financats
      assert.equal(r.purchases[0].downPayment === r.purchases[0].price, tier === null, String(tier));
      assert.equal(r.state.fleet[0].finance.loanId === null, tier === null, String(tier));
      assert.ok(Number.isFinite(r.metrics.minCash));
      const again = runBalance({ seed: 20260927, flights: 120, tier });
      assert.deepEqual(again.log, r.log);
    }
  });
});
