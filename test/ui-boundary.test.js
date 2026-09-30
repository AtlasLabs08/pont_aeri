/* Frontera de src/ui/ (tasca C5+D1): ui/ nomes pinta i crida app/. No importa
 * render/ ni fa servir Game (seccio 3 d ENGINEERING.md). Les proves no poden
 * importar ui/ (taula de la seccio 3): es llegeix el codi com a text.
 *
 * Correr:  npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const UI = new URL('../src/ui/', import.meta.url).pathname;
const files = readdirSync(UI).filter(f => f.endsWith('.js'));
/** codi sense comentaris */
const code = f => readFileSync(join(UI, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('ui/ te fitxers i un barrel index.js', () => {
  assert.ok(files.includes('index.js'));
  assert.ok(files.length > 1);
});

test('ui/ nomes importa d i18n/, career/, app/, platform/, core/, world/ i de si mateixa', () => {
  for (const f of files) {
    for (const [, from] of code(f).matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      assert.match(from, /^(\.\/[\w-]+\.js|\.\.\/(i18n|career|app|platform|core|world)\/index\.js)$/, f + ': ' + from);
    }
  }
});

test('ui/ no fa servir Game ni THREE', () => {
  for (const f of files) assert.doesNotMatch(code(f), /\b(Game|THREE)\b/, f);
});
