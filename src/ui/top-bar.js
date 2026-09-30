/* Barra superior permanent d Airline (DESIGN.md, "Barra superior permanent";
 * docs/DECISIONS.md, 30/09/2026, E6). Nomes pinta el model de topBarModel
 * (app/airline.js): cap calcul aqui. Nomes es mostra al centre d operacions,
 * amb el pilot graduat. Data i hora, xip d avis, variacio de l ultim vol i
 * tendencia de la reputacio no hi son (E1, E2, D4): cap casella buida.
 * NOU: tasca D1 d ENGINEERING.md.
 *
 * EXPORTA: topBar
 *
 * INTERFICIE (no la canviis, ui/ en depen):
 *   topBar(model) -> Element
 */

import { t, fmtMoney, fmtNumber } from '../i18n/index.js';
import { el } from './dom.js';

const cell = (cls, label, ...value) => el('div', { class: 'pa-cell ' + cls }, el('i', {}, label), el('b', {}, ...value));

export function topBar(m) {
  const xpText = m.atMaxRank
    ? t('topbar.xpMax', { xp: fmtNumber(m.xp) })
    : t('topbar.xp', { xp: fmtNumber(m.xp), next: fmtNumber(m.xpNext) });
  const pct = Math.round(Math.min(1, Math.max(0, m.xpProgress)) * 100);
  return el('header', { class: 'pa-topbar', role: 'banner' },
    cell('pa-pilot', t('topbar.pilot'), m.name, el('span', { class: 'pa-rank' }, t('rank.' + m.rankKey))),
    el('div', { class: 'pa-cell' },
      el('i', {}, t('topbar.xpLabel')),
      el('b', {}, xpText),
      el('div', { class: 'pa-xpbar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct },
        el('span', { style: 'width:' + pct + '%' }))),
    cell('', t('topbar.cash'), fmtMoney(m.cash)),
    cell('', t('topbar.reputation'), t('topbar.reputationValue', { value: fmtNumber(m.reputation) })),
    cell('', t('topbar.fleet'), t('topbar.fleetValue', { ready: fmtNumber(m.fleetReady), total: fmtNumber(m.fleetTotal) })),
    cell('', t('topbar.base'), m.base ?? t('topbar.noBase')));
}
