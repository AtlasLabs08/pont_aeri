/* Pestanya Market del centre d operacions (D5, docs/DECISIONS.md 30/09/2026 i
 * 01/10/2026, K4): targetes d anuncis agrupades per classe, filtre per categoria
 * i per ofertes i, en clicar-ne una, els efectes de la categoria i les dues
 * maneres de pagar amb el desglossament. Imatge o silueta (ui/silhouettes.js).
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
import { cardModel } from '../app/index.js';
import { el } from './dom.js';
import { tierBadge } from './fleet.js';
import { silhouette, padlock } from './silhouettes.js';

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

function stat(label, value) {
  return el('span', { class: 'pa-stat' }, el('i', {}, label), el('b', {}, value));
}

function card(offer, onSelect, selected) {
  const c = cardModel(offer);
  const act = e => { if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } };
  return el('div', { class: 'pa-card' + (c.locked ? ' pa-locked' : '') + (c.isOffer ? ' pa-deal' : '') + (selected ? ' pa-selected' : ''),
    role: 'button', tabindex: 0, 'aria-label': c.name + ' ' + c.reg, 'aria-expanded': String(!!selected), onclick: act, onkeydown: act },
    el('div', { class: 'pa-card-img' },
      c.image ? el('img', { src: c.image, alt: c.name, loading: 'lazy' }) : silhouette(c.silhouette),
      el('span', { class: 'pa-card-tags' }, tierBadge(c.tier),
        c.isOffer ? el('span', { class: 'pa-deal-tag' }, t('market.deal', { pct: fmtNumber(c.offerPct) })) : null),
      c.locked ? el('span', { class: 'pa-card-lock', title: t('market.card.locked') }, padlock()) : null),
    el('div', { class: 'pa-card-body' },
      el('h5', {}, c.name, el('span', { class: 'pa-year' }, ' ', c.year)),
      el('span', { class: 'pa-code' }, c.reg),
      el('div', { class: 'pa-card-price' },
        el('b', {}, fmtMoney(c.price)),
        c.isOffer ? el('s', { title: t('market.card.listPrice', { price: fmtMoney(c.listPrice) }) }, fmtMoney(c.listPrice)) : null),
      el('div', { class: 'pa-stats' },
        stat(t('market.card.hours'), fmtNumber(c.hours)),
        stat(t('market.col.condition'), fmtNumber(c.condition)),
        stat(t('market.card.revenue'), t('market.mult', { value: fmtNumber(c.revenueMult, 2) }))),
      c.locked ? el('p', { class: 'pa-card-need' }, padlock(), t('market.needsRating', { rating: t('rating.' + c.missingRating) })) : null));
}

export function marketPanel(model, { onBuy }) {
  const node = el('div', { class: 'pa-panel' });
  let filter = null, selected = null;
  function render() {
    const filters = [null, 'deals', ...TIERS].map(key => el('button', { type: 'button', 'aria-pressed': String(filter === key),
      onclick: () => { filter = key; selected = null; render(); } },
      key === null ? t('market.filter.all') : key === 'deals' ? t('market.filter.deals') : t('tier.' + key)));
    const keep = o => filter === null || (filter === 'deals' ? (o.listing.offerPct ?? 0) > 0 : o.listing.tier === filter);
    const groups = model.groups.map(g => ({ ...g, offers: g.offers.filter(keep) })).filter(g => g.offers.length > 0);
    const close = () => { selected = null; render(); };
    node.replaceChildren(el('div', {},
      el('h3', {}, t('market.title')),
      el('p', { class: 'pa-dim' }, t('market.renew', { count: model.renewDays })),
      el('div', { class: 'pa-filter', role: 'group', 'aria-label': t('market.filter') }, el('span', {}, t('market.filter')), filters),
      groups.length === 0 ? el('p', { class: 'pa-dim' }, t('market.empty')) : null,
      groups.map(g => el('section', {},
        el('h4', { class: 'pa-group' }, t('market.group.' + g.rating)),
        el('div', { class: 'pa-cards' },
          g.offers.map(o => o.listing.reg === selected
            ? [card(o, close, true), detail(o, { onBuy, onClose: close })]
            : card(o, () => { selected = o.listing.reg; render(); })))))));
    const open = node.querySelector('.pa-offer');
    if (open && open.scrollIntoView) open.scrollIntoView({ block: 'nearest' });
  }
  render();
  return node;
}
