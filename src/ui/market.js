/* Pestanya Market del centre d operacions (D5, docs/DECISIONS.md 30/09/2026):
 * anuncis agrupats per classe, filtre per categoria i, en triar-ne un, els
 * efectes de la categoria i les dues maneres de pagar amb el desglossament.
 * Sense lloguer (G1). Nomes pinta marketModel (app/market.js) i crida
 * onBuy, que l encaminador passa a buyListing.
 * NOU: tasca D5 d ENGINEERING.md.
 *
 * EXPORTA: marketPanel
 *
 * INTERFICIE (no la canviis, airline-ui.js en depen):
 *   marketPanel(model, { onBuy(reg, mode) }) -> Element
 *     model = marketModel(state). El filtre i l anunci triat son estat
 *     local del panell: es pinten sense tornar a l encaminador.
 */

import { t, fmtMoney, fmtNumber } from '../i18n/index.js';
import { BALANCE } from '../career/index.js';
import { el } from './dom.js';
import { tierBadge, conditionCells } from './fleet.js';

const TIERS = BALANCE.market.tiers.map(x => x.key);

const button = (label, onClick, primary, disabled) =>
  el('button', { type: 'button', class: primary ? 'pa-primary' : null, onclick: onClick, disabled: !!disabled }, label);

const kv = (label, value, cls) => el('div', { class: 'pa-kv' }, el('span', {}, label), el('b', { class: cls || null }, value));

/** text del motiu pel qual una opcio no es pot fer (G6, G7) */
function reasonText(offer, rule) {
  if (rule.reason === 'rating') return t('market.reason.rating', { rating: t('rating.' + offer.rating) });
  if (rule.reason === 'reserve') {
    return t('market.reason.reserve', { reserve: fmtMoney(rule.reserve), flights: fmtNumber(BALANCE.financing.reserveFlights) });
  }
  return t('market.reason.' + rule.reason);
}

function option(offer, rule, title, rows, onBuy) {
  return el('div', { class: 'pa-option' + (rule.ok ? '' : ' pa-locked') },
    el('h4', {}, title),
    rows,
    kv(t('market.balanceAfter'), fmtMoney(rule.cashAfter), rule.cashAfter < 0 ? 'pa-bad' : null),
    rule.ok ? null : el('p', { class: 'pa-msg pa-bad' }, reasonText(offer, rule)),
    el('div', { class: 'pa-btns' }, button(t('market.buy'), onBuy, true, !rule.ok)));
}

function detail(offer, { onBuy, onClose }) {
  const l = offer.listing, c = offer.cash, f = offer.financed;
  const mult = v => t('market.mult', { value: fmtNumber(v, 2) });
  return el('div', { class: 'pa-dialog pa-offer' },
    el('h3', {}, offer.name, ' ', l.reg, ' ', tierBadge(l.tier)),
    el('div', { class: 'pa-effects' },
      el('h4', {}, t('market.effects')),
      kv(t('tier.' + l.tier), t('tier.cabin.' + l.tier)),
      kv(t('market.revenue'), mult(offer.tier.revenueMult)),
      kv(t('market.wear'), mult(offer.tier.wearMult))),
    el('div', { class: 'pa-options' },
      option(offer, c, t('market.cash.title'), [kv(t('market.cash.price'), fmtMoney(l.price))], () => onBuy(l.reg, 'cash')),
      option(offer, f, t('market.financed.title'), [
        kv(t('market.financed.down'), fmtMoney(f.downPayment)),
        kv(t('market.financed.loan'), fmtMoney(f.loan.principal)),
        kv(t('market.financed.instalment'), fmtMoney(f.loan.instalment)),
        kv(t('market.financed.flights'), fmtNumber(f.loan.termFlights)),
        kv(t('market.financed.total'), fmtMoney(f.totalCost))
      ], () => onBuy(l.reg, 'financed'))),
    el('div', { class: 'pa-btns' }, button(t('market.close'), onClose)));
}

function listingRow(offer, onSelect) {
  const l = offer.listing;
  const act = e => { if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } };
  return el('div', { class: 'pa-row pa-click pa-listing' + (offer.hasRating ? '' : ' pa-locked'), role: 'button', tabindex: 0,
    onclick: act, onkeydown: act },
    el('span', { class: 'pa-name' }, offer.name, ' ', tierBadge(l.tier),
      el('span', { class: 'pa-desc' }, el('span', { class: 'pa-code' }, l.reg), ' · ',
        t('market.year', { year: l.yearBuilt, hours: fmtNumber(l.hours), cycles: fmtNumber(l.cycles) })),
      el('span', { class: 'pa-desc' }, t('market.checks', { a: fmtNumber(offer.toA), c: fmtNumber(offer.toC) })),
      offer.hasRating ? null : el('span', { class: 'pa-desc pa-warn' }, t('market.needsRating', { rating: t('rating.' + offer.rating) }))),
    conditionCells(l.condition),
    el('span', { class: 'pa-price' }, fmtMoney(l.price)));
}

export function marketPanel(model, { onBuy }) {
  const node = el('div', { class: 'pa-panel' });
  let filter = null, selected = null;
  function render() {
    const filters = [null, ...TIERS].map(key => el('button', { type: 'button', 'aria-pressed': String(filter === key),
      onclick: () => { filter = key; selected = null; render(); } }, key === null ? t('market.filter.all') : t('tier.' + key)));
    const groups = model.groups.map(g => ({ ...g, offers: g.offers.filter(o => filter === null || o.listing.tier === filter) }))
      .filter(g => g.offers.length > 0);
    node.replaceChildren(el('div', {},
      el('h3', {}, t('market.title')),
      el('p', { class: 'pa-dim' }, t('market.renew', { count: model.renewDays })),
      el('div', { class: 'pa-filter', role: 'group', 'aria-label': t('market.filter') }, el('span', {}, t('market.filter')), filters),
      groups.length === 0 ? el('p', { class: 'pa-dim' }, t('market.empty')) : null,
      groups.map(g => el('div', {},
        el('h4', { class: 'pa-group' }, t('market.group.' + g.rating)),
        el('div', { class: 'pa-board pa-market' },
          el('div', { class: 'pa-head' }, el('span', {}, t('market.col.aircraft')), el('span', {}, t('market.col.condition')),
            el('span', { class: 'pa-price' }, t('market.col.price'))),
          g.offers.map(o => o.listing.reg === selected
            ? [listingRow(o, () => { selected = null; render(); }),
               detail(o, { onBuy, onClose: () => { selected = null; render(); } })]
            : listingRow(o, () => { selected = o.listing.reg; render(); })))))));
  }
  render();
  return node;
}
