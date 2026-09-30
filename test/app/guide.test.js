/* Proves de src/app/guide.js, la guia de consulta (tasca C5, E5 de
 * docs/DECISIONS.md, 30/09/2026): les tecles surten de CONTROL_KEYS i cap
 * tecla que llegeixin Input o Game.onKey (index.html) hi falta.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GUIDE, guideSections } from '../../src/app/guide.js';
import { keyLabel } from '../../src/app/lesson-run.js';
import { CONTROL_KEYS } from '../../src/career/index.js';
import { setLang } from '../../src/i18n/index.js';
import en from '../../src/i18n/en.js';
import ca from '../../src/i18n/ca.js';

const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

/** tros d index.html entre dues marques (la primera inclosa) */
function slice(from, to) {
  const a = HTML.indexOf(from), b = HTML.indexOf(to, a);
  assert.ok(a >= 0 && b > a, from);
  return HTML.slice(a, b);
}

/** codis de tecla que llegeixen Input.update (K.down) i Game.onKey (case i code ===) */
function codesReadByGame() {
  const input = slice('const Input = {', 'SECTION 17');
  const onKey = slice('  onKey(code) {', '  cycleAccel()');
  const codes = new Set();
  for (const [, args] of input.matchAll(/K\.down\(([^)]*)\)/g)) for (const [, c] of args.matchAll(/'(\w+)'/g)) codes.add(c);
  for (const [, c] of onKey.matchAll(/case '(\w+)'/g)) codes.add(c);
  for (const [, c] of onKey.matchAll(/code === '(\w+)'/g)) codes.add(c);
  return codes;
}

const keySections = GUIDE.filter(s => s.kind === 'keys');
const allCodes = Object.values(CONTROL_KEYS).flat();

describe('guia de consulta: tecles', () => {
  test('cada tecla que llegeixen Input i Game.onKey es a CONTROL_KEYS', () => {
    const codes = codesReadByGame();
    assert.ok(codes.size > 30, 'el lector de index.html ha trobat ' + codes.size + ' codis');
    for (const c of codes) assert.ok(allCodes.includes(c), c);
  });

  test('cada comandament de la guia es a CONTROL_KEYS i cada codi de CONTROL_KEYS surt a la guia', () => {
    const shown = new Set();
    for (const s of keySections) for (const control of s.items) {
      assert.ok(Object.hasOwn(CONTROL_KEYS, control), control);
      for (const c of CONTROL_KEYS[control]) shown.add(c);
    }
    for (const c of allCodes) assert.ok(shown.has(c), c);
  });

  test('les tecles de cada fila son les de CONTROL_KEYS, amb keyLabel i sense repetir', () => {
    const rows = Object.fromEntries(guideSections().flatMap(s => s.rows).map(r => [r.textKey, r.term]));
    assert.equal(rows['guide.key.flapsDown'], keyLabel(CONTROL_KEYS.flapsDown[0]));
    assert.equal(rows['guide.key.throttleUp'], 'Shift / +');
    assert.equal(rows['guide.key.throttleDown'], '-');
    assert.equal(rows['guide.key.pitchDown'], 'W / ↑');
    assert.equal(rows['guide.key.cameraReset'], keyLabel(CONTROL_KEYS.cameraReset[0]));
    assert.equal(rows['guide.key.pause'], 'Esc');
  });
});

describe('guia de consulta: textos', () => {
  test('cada seccio i cada fila te text a en i a ca', () => {
    for (const s of guideSections()) {
      for (const k of [s.titleKey, ...s.rows.map(r => r.textKey)]) {
        assert.ok(Object.hasOwn(en, k), 'en: ' + k);
        assert.ok(Object.hasOwn(ca, k), 'ca: ' + k);
      }
    }
    for (const s of GUIDE.filter(g => g.kind === 'text')) for (const id of s.items) {
      const k = 'guide.' + s.id + '.' + id + '.term';
      assert.ok(Object.hasOwn(en, k) && Object.hasOwn(ca, k), k);
    }
  });

  test('els termes de les files de text surten d i18n en l idioma actiu', () => {
    const hud = () => guideSections().find(s => s.id === 'mouse').rows[0].term;
    assert.equal(hud(), en['guide.mouse.rightDrag.term']);
    setLang('ca');
    assert.equal(hud(), ca['guide.mouse.rightDrag.term']);
    setLang('en');
  });

  test('els textos de la guia no escriuen cap tecla: les tecles son a la columna de CONTROL_KEYS', () => {
    // una lletra sola entre espais o una tecla anomenada seria una tecla escrita a ma
    for (const [k, v] of Object.entries(en)) {
      if (!k.startsWith('guide.key.')) continue;
      assert.doesNotMatch(v, /\b(Shift|Esc|Home|Space|Enter)\b|(^|\s)[A-Z](\s|$|[.,])/, k + ': ' + v);
    }
  });

  test('la guia es nomes consulta: cap seccio no te criteris', () => {
    for (const s of GUIDE) assert.deepEqual(Object.keys(s).sort(), ['id', 'items', 'kind']);
  });
});
