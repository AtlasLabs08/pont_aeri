/* Validacio del model de vol.
 *
 * Aixo es el harness de sempre, ara corrent com a test de debo. Cada avio
 * genera una subprova per fila comprovada, aixi quan una cosa peta el nom
 * del test et diu exactament que.
 *
 * Correr:  npm test
 *
 * Si aixo es en verd, el model de vol no ha canviat de comportament. Es
 * l'unica cosa que hi ha entre tu i un model d'IA que et trenca la fisica
 * sense dir-t'ho.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRCRAFT, AIRCRAFT_ORDER, Harness } from '../src/core/index.js';

const fmt = (v) => (typeof v === 'number' && isFinite(v) ? v.toFixed(2) : String(v));

for (const id of AIRCRAFT_ORDER) {
  const cfg = AIRCRAFT[id];

  describe(`${id} - ${cfg.name}`, () => {
    // Es vola una sola vegada per avio: run() fa totes les maniobres i es car.
    const result = Harness.run(id);

    for (const row of result.rows) {
      test(`${row.name}`, () => {
        assert.ok(
          isFinite(row.val),
          `${row.name} ha tornat un valor no finit (${row.val}). ` +
          `Normalment vol dir que la simulacio ha divergit.`
        );
        assert.ok(
          row.pass,
          `${row.name} = ${fmt(row.val)} ${row.unit || ''} ` +
          `fora del rang esperat [${row.range[0]}, ${row.range[1]}]`
        );
      });
    }
  });
}
