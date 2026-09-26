/* career/ es pur: la regla 5 de la seccio 0 i la taula de dependencies de la
 * seccio 3 d ENGINEERING.md, fetes comprovables.
 *
 * Llegeix tots els fitxers .js de src/career/ (tambe els de subcarpetes) i
 * falla si el codi, sense comentaris, fa servir Math.random, Date,
 * localStorage, window o document, o si importa res de fora de career/,
 * core/ o world/. Els textos entre cometes es comproven igual que el codi.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const CAREER = join(SRC, 'career');
const ALLOWED_DIRS = ['career', 'core', 'world'].map(d => join(SRC, d) + sep);

const FORBIDDEN = [
  ['Math.random', /\bMath\s*\.\s*random\b/],
  ['Date', /\bDate\b/],
  ['localStorage', /\blocalStorage\b/],
  ['window', /\bwindow\b/],
  ['document', /\bdocument\b/],
  ['require', /\brequire\s*\(/]
];

/** Treu els comentaris // i /* *\/ i deixa intactes els textos entre cometes. */
function stripComments(src) {
  let out = '', i = 0, quote = null;
  while (i < src.length) {
    const c = src[i], next = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += next ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
    } else if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
      out += ' ';
    } else {
      if (c === '\'' || c === '"' || c === '`') quote = c;
      out += c;
      i++;
    }
  }
  return out;
}

/** Especificadors de tots els import/export ... from, import 'x' i import('x'). */
function importSpecifiers(code) {
  const specs = [];
  const res = [
    /\b(?:import|export)\b[^'"`;]*?\bfrom\s*(['"])([^'"]*)\1/g,
    /\bimport\s*(['"])([^'"]*)\1/g,
    /\bimport\s*\(\s*(['"])([^'"]*)\1\s*\)/g
  ];
  for (const re of res) for (const m of code.matchAll(re)) specs.push(m[2]);
  // import(x) amb una expressio: no es pot saber que importa, i per tant es prohibeix
  for (const m of code.matchAll(/\bimport\s*\(\s*([^'"\s])/g)) specs.push('<dinamic ' + m[1] + '...>');
  return specs;
}

/** Problemes d un fitxer de career/, com a llista de textos. */
function checkFile(path, src) {
  const code = stripComments(src), problems = [];
  for (const [name, re] of FORBIDDEN) if (re.test(code)) problems.push('fa servir ' + name);
  for (const spec of importSpecifiers(code)) {
    const target = spec.startsWith('.') ? resolve(dirname(path), spec) : null;
    if (!target || !ALLOWED_DIRS.some(d => target.startsWith(d))) {
      problems.push('importa ' + spec + ': nomes es permet ./, ../core/ i ../world/');
    }
  }
  return problems;
}

function listJs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? listJs(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []);
}

describe('career/ es pur', () => {
  const files = listJs(CAREER);

  test('hi ha fitxers per comprovar', () => {
    for (const f of ['index.js', 'state.js', 'types.js', 'balance.js']) {
      assert.ok(files.includes(join(CAREER, f)), f);
    }
  });

  for (const path of files) {
    test(relative(SRC, path), () => {
      assert.deepEqual(checkFile(path, readFileSync(path, 'utf8')), []);
    });
  }
});

describe('el detector funciona', () => {
  const at = join(CAREER, 'x.js');
  const bad = src => checkFile(at, src).length > 0;

  test('detecta les APIs prohibides al codi, no als comentaris', () => {
    assert.ok(bad('const r = Math.random();'));
    assert.ok(bad('const r = Math . random();'));
    assert.ok(bad('const t = Date.now();'));
    assert.ok(bad('const d = new Date(0);'));
    assert.ok(bad('localStorage.getItem("k");'));
    assert.ok(bad('const w = window.innerWidth;'));
    assert.ok(bad('document.body;'));
    assert.ok(bad('const g = globalThis["window"];'));
    assert.ok(!bad('// Math.random, Date, window, document\nconst a = 1;'));
    assert.ok(!bad('/* localStorage\n * Date */ const a = 1;'));
    assert.ok(!bad('const updated = 1, windowed = 2, documents = 3;'));
    assert.ok(!bad('const url = "http://x"; const d = 1;'));
  });

  test('nomes deixa importar de career/, core/ i world/', () => {
    assert.ok(!bad("import { BALANCE } from './balance.js';"));
    assert.ok(!bad("import { makeRng } from '../core/index.js';"));
    assert.ok(!bad("export * from '../world/index.js';"));
    assert.ok(!checkFile(join(CAREER, 'sub', 'y.js'), "import { a } from '../../core/index.js';").length);
    assert.ok(bad("import { Storage } from '../platform/storage.js';"));
    assert.ok(bad("import { t } from '../i18n/index.js';"));
    assert.ok(bad("import * as THREE from 'three';"));
    assert.ok(bad("import fs from 'node:fs';"));
    assert.ok(bad("import './../platform/x.js';"));
    assert.ok(bad("const m = await import('../app/index.js');"));
    assert.ok(bad('const m = await import(name);'));
    assert.ok(bad("import {\n  a,\n  b\n} from '../ui/x.js';"));
    assert.ok(bad("const fs = require('fs');"));
  });
});
