/* Pestanya Dispatch del centre d operacions (D3+D4, docs/DECISIONS.md
 * 2026-10-02, D3D4-1, D3D4-9 i D3D4-10): el vol propi (avio, desti, hora i
 * preu, amb els passatgers i els ingressos previstos en directe) i els vols
 * de contracte. Nomes pinta dispatchModel i els plans de planOwnFlight
 * (app/dispatch.js), que rep de l encaminador: cap calcul aqui.
 * NOU: tasca D3 d ENGINEERING.md.
 *
 * EXPORTA: dispatchPanel
 *
 * INTERFICIE (no la canviis, airline-ui.js en depen):
 *   dispatchPanel(model, { planOf(sel), onBriefing(plan), onContract(offerId) }) -> Element
 *     model = dispatchModel(state). sel = { reg, to, hour, price } (price null
 *     = el recomanat); planOf torna el pla de planOwnFlight. La tria es estat
 *     local del panell.
 */

import { t, fmtMoney, fmtNumber } from '../i18n/index.js';
import { HOURS_PER_DAY } from '../app/index.js';
import { el } from './dom.js';

const button = (label, onClick, primary, disabled) =>
  el('button', { type: 'button', class: primary ? 'pa-primary' : null, onclick: onClick, disabled: !!disabled }, label);

const kv = (label, value, cls) => el('div', { class: 'pa-kv' }, el('span', {}, label), el('b', { class: cls || null }, value));

const hh = h => String(h).padStart(2, '0') + ':00';

function select(label, options, value, onChange) {
  const s = el('select', { class: 'pa-select', 'aria-label': label, onchange: () => onChange(s.value) },
    options.map(o => el('option', { value: o.value, selected: o.value === value, disabled: !!o.disabled }, o.label)));
  return el('label', { class: 'pa-field' }, el('span', { class: 'pa-label' }, label), s);
}

function ownFlight(model, { planOf, onBriefing }) {
  const ready = model.aircraft.filter(a => a.ready);
  const node = el('div', { class: 'pa-own' });
  if (model.hasPending) return el('p', { class: 'pa-msg pa-warn' }, t('dispatch.pending'));
  if (ready.length === 0) return el('p', { class: 'pa-msg pa-dim' }, t(model.aircraft.length === 0 ? 'dispatch.noFleet' : 'dispatch.noReady'));
  const sel = { reg: ready[0].airframe.reg, to: null, hour: 9, price: null };
  const firstDest = a => (a.destinations.find(d => d.inRange) || a.destinations[0]).icao;
  sel.to = firstDest(ready[0]);

  function render() {
    const a = ready.find(x => x.airframe.reg === sel.reg);
    const plan = planOf(sel);
    const slider = plan.priceBounds ? el('input', { type: 'range', class: 'pa-range', min: plan.priceBounds[0], max: plan.priceBounds[1], step: 1,
      value: plan.price, 'aria-label': t('dispatch.price'),
      oninput: e => { sel.price = Number(e.target.value); update(); } }) : null;
    const summary = el('div', { class: 'pa-summary' });
    function update() {
      const p = planOf(sel);
      summary.replaceChildren(
        kv(t('dispatch.price'), t('dispatch.priceValue', { price: fmtMoney(p.price), rec: fmtMoney(p.recommendedPrice) })),
        kv(t('dispatch.pax'), t('dispatch.paxValue', { pax: fmtNumber(p.pax), seats: fmtNumber(p.seats) })),
        kv(t('dispatch.revenue'), fmtMoney(p.estimate.revenue.tickets)),
        kv(t('dispatch.net'), fmtMoney(p.estimate.net), p.estimate.net < 0 ? 'pa-bad' : null),
        p.ok ? null : el('p', { class: 'pa-msg pa-bad' }, t('dispatch.reason.' + p.reason)),
        el('div', { class: 'pa-btns' }, button(t('dispatch.toBriefing'), () => onBriefing(planOf(sel)), true, !p.ok)));
    }
    node.replaceChildren(
      el('div', { class: 'pa-fields' },
        select(t('dispatch.aircraft'), ready.map(x => ({ value: x.airframe.reg, label: t('dispatch.aircraftOption', { reg: x.airframe.reg, name: x.name, icao: x.airframe.location }) })),
          sel.reg, v => { sel.reg = v; sel.to = firstDest(ready.find(x => x.airframe.reg === v)); sel.price = null; render(); }),
        select(t('dispatch.destination'), a.destinations.map(d => ({ value: d.icao, disabled: !d.inRange,
          label: t('dispatch.destOption', { icao: d.icao, city: d.city, km: fmtNumber(d.km) }) })),
          sel.to, v => { sel.to = v; sel.price = null; render(); }),
        select(t('dispatch.hour'), Array.from({ length: HOURS_PER_DAY }, (_, h) => ({ value: String(h), label: hh(h) })),
          String(sel.hour), v => { sel.hour = Number(v); render(); })),
      el('label', { class: 'pa-field' }, el('span', { class: 'pa-label' }, t('dispatch.price')), slider),
      summary);
    update();
  }
  render();
  return node;
}

function contracts(model, onContract) {
  if (model.contracts.length === 0) return el('p', { class: 'pa-msg pa-dim' }, t('dispatch.noContracts'));
  return el('div', { class: 'pa-board pa-contracts' }, model.contracts.map(c =>
    el('div', { class: 'pa-row' },
      el('span', { class: 'pa-code' }, hh(c.hour)),
      el('span', { class: 'pa-name' }, t('dispatch.contractRoute', { from: c.from, to: c.to }),
        el('span', { class: 'pa-desc' }, t('dispatch.contractDesc', { name: c.name, reg: c.reg, pax: fmtNumber(c.pax),
          km: fmtNumber(c.km), fromCity: c.fromCity, toCity: c.toCity }))),
      el('span', { class: 'pa-status' }, el('b', { class: 'pa-price' }, fmtMoney(c.fee)), el('br'),
        button(t('dispatch.toBriefing'), () => onContract(c.id))))));
}

export function dispatchPanel(model, { planOf, onBriefing, onContract }) {
  return el('div', { class: 'pa-panel pa-dispatch' },
    model.negative ? el('p', { class: 'pa-msg pa-bad', role: 'alert' }, t('dispatch.negative')) : null,
    el('h3', {}, t('dispatch.own.title')),
    el('p', { class: 'pa-desc' }, t('dispatch.own.intro', { day: fmtNumber(model.day) })),
    ownFlight(model, { planOf, onBriefing }),
    el('h3', {}, t('dispatch.contracts.title')),
    el('p', { class: 'pa-desc' }, t('dispatch.contracts.intro')),
    contracts(model, onContract));
}
