/* Proves de tools/balance.mjs (tasca B5): el harness economic es
 * determinista. Nomes 20 vols, perque sigui rapida.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { runBalance, formatReport } from '../tools/balance.mjs';

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
});
