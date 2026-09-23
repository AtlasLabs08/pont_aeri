/* Prova d'instantania: compara el comportament del model de vol amb els
 * valors mesurats ABANS de la migracio.
 *
 * Per que existeix: la simulacio es determinista. Mateixa entrada, mateix
 * resultat, sempre. Durant una migracio la regla es "no canviar ni una
 * formula", i per tant els numeros no han de "seguir dins del rang": han
 * de ser ELS MATEIXOS. Comprovar el rang es massa fluix per detectar-ho.
 *
 * Correr:  npm test
 *
 * PRECISIO: la instantania inicial es va copiar de la consola del navegador
 * amb toFixed(2), aixi que nomes te dos decimals. Per tant es compara a dos
 * decimals, que es tota la precisio disponible. Un cop acabada la migracio
 * amb tot en verd, regenera-la per tenir precisio completa:
 *
 *   node test/snapshot.test.js --update
 *
 * A partir d'aquell moment la prova sera molt mes sensible, que es el que
 * vols per al desenvolupament normal.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { AIRCRAFT_ORDER, Harness } from '../src/core/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAP = join(HERE, 'snapshot.json');

function measure() {
  const out = {};
  for (const r of Harness.runAll()) {
    out[r.id] = {};
    for (const row of r.rows) out[r.id][row.name] = row.val;
  }
  return out;
}

/* Quants decimals te el valor guardat. Si la instantania es de la consola
 * son 2; si es regenerada, son tots i la comparacio es fa exacta. */
function decimals(n) {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

if (process.argv.includes('--update')) {
  writeFileSync(SNAP, JSON.stringify(measure(), null, 2) + '\n');
  console.log(`Instantania regenerada amb precisio completa: ${SNAP}`);
  process.exit(0);
}

const expected = JSON.parse(readFileSync(SNAP, 'utf8'));
const actual = measure();

for (const id of AIRCRAFT_ORDER) {
  describe(`instantania ${id}`, () => {
    const exp = expected[id];
    const act = actual[id];

    test('cap metrica ha desaparegut o aparegut', () => {
      assert.deepEqual(
        Object.keys(act).sort(),
        Object.keys(exp).sort(),
        'el conjunt de metriques del harness ha canviat'
      );
    });

    for (const [name, want] of Object.entries(exp)) {
      test(name, () => {
        const got = act[name];
        assert.ok(isFinite(got), `${name} no es finit: ${got}`);

        const d = Math.min(Math.max(decimals(want), 2), 10);
        const same = got.toFixed(d) === want.toFixed(d);

        const diff = Math.abs(got - want);
        const rel = want === 0 ? diff : diff / Math.abs(want);

        assert.ok(
          same,
          `${name}\n` +
          `  esperat:   ${want}\n` +
          `  obtingut:  ${got.toFixed(Math.max(d, 4))}\n` +
          `  desviacio: ${(rel * 100).toPrecision(3)} %\n` +
          `  ${rel < 1e-4
              ? 'Molt petita: reordenacio de coma flotant. Revisa el diff; si nomes has mogut codi, es acceptable.'
              : 'Gran: has canviat comportament. git checkout del darrer pas i torna-hi.'}`
        );
      });
    }
  });
}
