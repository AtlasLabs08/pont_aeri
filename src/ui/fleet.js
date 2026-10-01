/* Pestanya Fleet del centre d operacions (D2, docs/DECISIONS.md 30/09/2026):
 * una fila per avio i la confirmacio de venda. Nomes pinta fleetModel
 * (app/market.js) i crida les accions que rep de l encaminador.
 * NOU: tasca D2 d ENGINEERING.md.
 *
 * EXPORTA: fleetPanel tierBadge conditionCells
 *
 * INTERFICIE (no la canviis, airline-ui.js i market.js en depenen):
 *   fleetPanel(rows, { onSell(reg), onMarket }) -> Element
 *     rows = fleetModel(state). Sense avions, un text i un boto a Market.
 *     Vendre obre una confirmacio amb la cotitzacio, el prestec que es
 *     cancel.la i el net; si no es pot, el boto queda desactivat amb el motiu.
 *   tierBadge(key) -> Element   etiqueta de categoria, un estil per a cada una
 *   conditionCells(condition) -> Element   els 4 estats (0-100)
 */

import { t, fmtMoney, fmtNumber } from '../i18n/index.js';
import { BALANCE } from '../career/index.js';
import { el } from './dom.js';

const CONDITION_KEYS = ['engines', 'gear', 'airframe', 'avionics'];

const button = (label, onClick, primary, disabled) =>
  el('button', { type: 'button', class: primary ? 'pa-primary' : null, onclick: onClick, disabled: !!disabled }, label);

export function tierBadge(key) {
  return el('span', { class: 'pa-tier pa-tier-' + key }, t('tier.' + key));
}

export function conditionCells(condition) {
  return el('span', { class: 'pa-conds' }, CONDITION_KEYS.map(k => {
    const v = Math.round(condition[k]);
    return el('span', { class: 'pa-cond' + (v < BALANCE.failure.threshold ? ' pa-bad' : ''), title: t('cond.' + k) },
      el('i', {}, t('cond.' + k)), el('b', {}, fmtNumber(v)));
  }));
}

/** hores que falten per a una revision, o "ja toca" */
const hoursLeft = h => h > 0 ? fmtNumber(Math.ceil(h)) : t('fleet.checkDue');

function sellDialog(row, { onConfirm, onCancel }) {
  const q = row.quote;
  const reason = q.ok ? null : el('p', { class: 'pa-msg pa-bad', role: 'alert' }, t('fleet.reason.' + q.reason));
  return el('div', { class: 'pa-dialog', role: 'alertdialog', 'aria-label': t('fleet.sellTitle', { reg: row.airframe.reg }) },
    el('h3', {}, t('fleet.sellTitle', { reg: row.airframe.reg })),
    el('div', { class: 'pa-kv' }, el('span', {}, t('fleet.sellQuote', { fee: fmtNumber(BALANCE.market.sellFee * 100) + ' %' })), el('b', {}, fmtMoney(q.quote))),
    el('div', { class: 'pa-kv' }, el('span', {}, t('fleet.sellLoan')), el('b', {}, fmtMoney(q.loanBalance > 0 ? -q.loanBalance : 0))),
    el('div', { class: 'pa-kv' }, el('span', {}, t('fleet.sellNet')), el('b', { class: q.net < 0 ? 'pa-bad' : null }, fmtMoney(q.net))),
    reason,
    el('div', { class: 'pa-btns' },
      button(t('fleet.sellConfirm'), onConfirm, true, !q.ok),
      button(t('fleet.sellCancel'), onCancel)));
}

export function fleetPanel(rows, { onSell, onMarket }) {
  if (rows.length === 0) {
    return el('div', { class: 'pa-panel' },
      el('h3', {}, t('fleet.title')),
      el('p', {}, t('fleet.empty')),
      el('div', { class: 'pa-btns' }, button(t('fleet.toMarket'), onMarket, true)));
  }
  const node = el('div', { class: 'pa-panel' });
  function render(open) {
    node.replaceChildren(
      el('h3', {}, t('fleet.title')),
      el('div', { class: 'pa-board pa-fleet' }, rows.map(row => {
        const a = row.airframe;
        const card = el('div', { class: 'pa-row pa-airframe' },
          el('span', { class: 'pa-code' }, a.reg),
          el('span', { class: 'pa-name' }, row.name, ' ', tierBadge(row.tier.key),
            el('span', { class: 'pa-desc' }, [t('fleet.year', { year: a.yearBuilt }), t('fleet.hours', { hours: fmtNumber(Math.round(a.hours)) }),
              t('fleet.cycles', { cycles: fmtNumber(a.cycles) }), t('fleet.location', { icao: a.location })].join(' · ')),
            el('span', { class: 'pa-desc' }, t('fleet.checks', { a: hoursLeft(row.toA), c: hoursLeft(row.toC) })),
            el('span', { class: 'pa-desc' }, row.loan
              ? t('fleet.loan', { instalment: fmtMoney(row.loan.instalment), flights: fmtNumber(row.loan.flightsLeft) })
              : t('fleet.outright'))),
          conditionCells(a.condition),
          el('span', { class: 'pa-status ' + (a.status === 'ready' ? 'pa-ok' : 'pa-warn') }, t('fleet.status.' + a.status),
            el('br'), button(t('fleet.sell'), () => render(a.reg))));
        return open === a.reg
          ? [card, sellDialog(row, { onConfirm: () => onSell(a.reg), onCancel: () => render(null) })]
          : card;
      })));
  }
  render(null);
  return node;
}
