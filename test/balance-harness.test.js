/* Proves de tools/balance.mjs (tasca B5): el harness economic es
 * determinista. Nomes 20 vols, perque sigui rapida.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { runBalance, startState, formatReport, HARNESS } from '../tools/balance.mjs';
import { createCareer, graduate, startingCompany, LESSONS } from '../src/career/index.js';

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

  test('el joc es gradua exactament al punt de partida del harness: saldo, credit, reputacio i pilot', () => {
    const h = startState({ seed: 777 }), g = gameGraduation(777);
    for (const k of ['cash', 'loans', 'reputation']) assert.deepEqual(g.company[k], h.company[k], k);
    assert.deepEqual(g.pilot, { ...h.pilot, name: 'Joc' });
    assert.equal(g.school.graduated, true);
    // tots dos surten de la funcio compartida, no de numeros copiats
    assert.deepEqual({ cash: h.company.cash, loans: h.company.loans, reputation: h.company.reputation },
      (({ cash, loans, reputation }) => ({ cash, loans, reputation }))(startingCompany(createCareer({}).company)));
  });
});
