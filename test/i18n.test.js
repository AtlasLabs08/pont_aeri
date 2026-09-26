/* Proves de src/i18n/ (tasca A1).
 *
 * Intl posa espais no separables (U+00A0, U+202F) als numeros, la moneda i
 * les hores. Les proves comparen contra la sortida del mateix Intl o
 * normalitzen els espais amb sp(); mai s escriuen a ma.
 *
 * Correr:  npm test
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  t, setLang, getLang, fmtMoney, fmtNumber, fmtDateTime, fmtDuration
} from '../src/i18n/index.js';
import en from '../src/i18n/en.js';
import ca from '../src/i18n/ca.js';

/** qualsevol espai (normal o no separable) -> espai normal */
const sp = (s) => s.replace(/\s/g, ' ');

afterEach(() => setLang('en'));

describe('idioma', () => {
  test('per defecte es en', () => {
    assert.equal(getLang(), 'en');
  });

  test('setLang canvia l idioma actiu', () => {
    setLang('ca');
    assert.equal(getLang(), 'ca');
    assert.equal(t('landing.solid'), 'Aterratge sòlid');
  });

  test('idioma desconegut: queda en', () => {
    setLang('ca');
    setLang('fr');
    assert.equal(getLang(), 'en');
  });
});

describe('t', () => {
  test('text simple', () => {
    assert.equal(t('landing.solid'), 'Solid landing');
  });

  test('interpola {nom} amb params', () => {
    assert.equal(t('flight.route', { from: 'LEBL', to: 'LEPA' }), 'From LEBL to LEPA');
    setLang('ca');
    assert.equal(t('flight.route', { from: 'LEBL', to: 'LEPA' }), 'De LEBL a LEPA');
  });

  test('un parametre que falta deixa el {nom} tal qual', () => {
    assert.equal(t('flight.route', { from: 'LEBL' }), 'From LEBL to {to}');
  });

  test('plurals amb Intl.PluralRules', () => {
    assert.equal(t('flight.count', { count: 1 }), '1 flight');
    assert.equal(t('flight.count', { count: 0 }), '0 flights');
    assert.equal(t('flight.count', { count: 7 }), '7 flights');
    setLang('ca');
    assert.equal(t('flight.count', { count: 1 }), '1 vol');
    assert.equal(t('flight.count', { count: 2 }), '2 vols');
  });

  test('clau que falta a ca: cau a en', () => {
    assert.equal(Object.hasOwn(ca, 'rank.up'), false, 'la prova necessita una clau absent a ca');
    setLang('ca');
    assert.equal(t('rank.up', { rank: 'ATPL' }), 'Promoted to ATPL');
  });

  test('clau que no hi es enlloc: retorna la clau', () => {
    assert.equal(t('no.existeix'), 'no.existeix');
    assert.equal(t('no.existeix', { count: 3 }), 'no.existeix');
    setLang('ca');
    assert.equal(t('no.existeix'), 'no.existeix');
  });

  test('ca no te cap clau que no sigui a en', () => {
    for (const k of Object.keys(ca)) assert.ok(Object.hasOwn(en, k), k);
  });
});

describe('formats', () => {
  test('fmtMoney: euros enters, sense decimals', () => {
    const gb = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const es = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    assert.equal(fmtMoney(400000), gb.format(400000));
    assert.equal(sp(fmtMoney(400000)), '€400,000');
    assert.equal(fmtMoney(1234.6), gb.format(1235));
    setLang('ca');
    assert.equal(fmtMoney(400000), es.format(400000));
    assert.equal(sp(fmtMoney(400000)), '400.000 €');
    assert.equal(sp(fmtMoney(-2500)), '-2.500 €');
  });

  test('fmtNumber: decimals fixos', () => {
    assert.equal(fmtNumber(1234.5678, 2), '1,234.57');
    assert.equal(fmtNumber(1234.5678), '1,235');
    assert.equal(fmtNumber(3, 1), '3.0');
    setLang('ca');
    assert.equal(sp(fmtNumber(1234.5678, 2)), '1.234,57');
  });

  test('fmtDateTime: rep un Date i usa el locale de l idioma', () => {
    const d = new Date(2026, 8, 26, 14, 5);
    const opts = { dateStyle: 'medium', timeStyle: 'short' };
    assert.equal(fmtDateTime(d), new Intl.DateTimeFormat('en-GB', opts).format(d));
    assert.match(sp(fmtDateTime(d)), /26 Sept? 2026.*14:05/);
    setLang('ca');
    assert.equal(fmtDateTime(d), new Intl.DateTimeFormat('ca-ES', opts).format(d));
    assert.match(sp(fmtDateTime(d)), /26.*2026.*14:05/);
  });

  test('fmtDateTime: data invalida o no Date -> cadena buida', () => {
    assert.equal(fmtDateTime(new Date('no')), '');
    assert.equal(fmtDateTime(1234), '');
    assert.equal(fmtDateTime(undefined), '');
  });

  test('fmtDuration', () => {
    assert.equal(sp(fmtDuration(160)), '2 h 40 min');
    assert.equal(sp(fmtDuration(120)), '2 h');
    assert.equal(sp(fmtDuration(40)), '40 min');
    assert.equal(sp(fmtDuration(0)), '0 min');
    assert.equal(sp(fmtDuration(59.6)), '1 h');
    assert.equal(sp(fmtDuration(-5)), '0 min');
    assert.equal(sp(fmtDuration(NaN)), '0 min');
    setLang('ca');
    assert.equal(sp(fmtDuration(160)), '2 h 40 min');
  });
});

test('i18n no importa res de fora de src/i18n/', () => {
  for (const f of ['index.js', 'en.js', 'ca.js']) {
    const src = readFileSync(new URL(`../src/i18n/${f}`, import.meta.url), 'utf8');
    for (const [, from] of src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      assert.match(from, /^\.\/[\w-]+\.js$/, `${f} importa ${from}`);
    }
  }
});
