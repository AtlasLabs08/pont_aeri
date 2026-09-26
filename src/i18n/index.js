/* Traduccio i format de textos, numeros, diners, dates i durades, tot amb Intl.
 * NOU. Tasca A1 d ENGINEERING.md, seccio 9.
 *
 * EXPORTA: t setLang getLang fmtMoney fmtNumber fmtDateTime fmtDuration
 *
 * IMPORTA: nomes ./en.js i ./ca.js. Cap altra capa: i18n no sap res del
 * rellotge de la partida ni del navegador.
 *
 * INTERFICIE (no la canviis, ui/, app/ i els tests en depenen):
 *   t(key, params)          text de l idioma actiu. {nom} -> params.nom.
 *                           Si params.count es un numero i existeixen key.one /
 *                           key.other, tria la forma amb Intl.PluralRules.
 *                           Clau absent: cau a en; absent tambe a en: la clau.
 *   setLang(lang)           'en' | 'ca'. Qualsevol altre valor deixa 'en'.
 *   getLang()               idioma actiu. Per defecte 'en'.
 *   fmtMoney(euros)         euros enters, sense decimals: '400.000 €'
 *   fmtNumber(n, decimals)  decimals fixos, per defecte 0
 *   fmtDateTime(date)       un Date; '' si no es una data valida
 *   fmtDuration(minutes)    '2 h 40 min', '2 h', '40 min'. Arrodoneix al minut;
 *                           negatiu o no finit: '0 min'
 */

import en from './en.js';
import ca from './ca.js';

const DICTS = { en, ca };
const LOCALES = { en: 'en-GB', ca: 'ca-ES' };

let lang = 'en';

export function setLang(l) { lang = Object.hasOwn(DICTS, l) ? l : 'en'; return lang; }
export function getLang() { return lang; }

function locale() { return LOCALES[lang]; }

/** text de la clau a l idioma actiu o, si no hi es, a en; undefined si enlloc */
function lookup(key) {
  if (Object.hasOwn(DICTS[lang], key)) return DICTS[lang][key];
  if (Object.hasOwn(en, key)) return en[key];
  return undefined;
}

function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => Object.hasOwn(params, name) ? String(params[name]) : m);
}

export function t(key, params) {
  let text;
  if (params && typeof params.count === 'number' && lookup(key + '.other') !== undefined) {
    const cat = new Intl.PluralRules(locale()).select(params.count);
    text = lookup(key + '.' + cat) ?? lookup(key + '.other');
  }
  if (text === undefined) text = lookup(key);
  if (text === undefined) return key;
  return interpolate(text, params);
}

export function fmtMoney(euros) {
  return new Intl.NumberFormat(locale(), {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(euros);
}

export function fmtNumber(n, decimals = 0) {
  return new Intl.NumberFormat(locale(), {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals
  }).format(n);
}

export function fmtDateTime(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function fmtDuration(minutes) {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const h = Math.floor(total / 60), m = total % 60;
  if (h === 0) return t('duration.m', { m });
  if (m === 0) return t('duration.h', { h: fmtNumber(h) });
  return t('duration.hm', { h: fmtNumber(h), m });
}
