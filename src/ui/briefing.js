/* Briefing abans de volar (D3+D4, docs/DECISIONS.md 2026-10-02, D3D4-4 i
 * D3D4-5): ruta i pista d arribada, meteo a l origen i al desti,
 * passatgers, preu o tarifa, combustible (minim del pla, amunt fins al
 * diposit), massa i hora d arribada prevista; si la pista d arribada te mes
 * vent de cua del permes, l avis i l alternatiu. Nomes pinta el pla de
 * planOwnFlight / planContract (app/dispatch.js): cap calcul aqui.
 * NOU: tasca D4 d ENGINEERING.md.
 *
 * EXPORTA: briefingScreen
 *
 * INTERFICIE (no la canviis, airline-ui.js en depen):
 *   briefingScreen(plan, { replan({ fuelKg }), onAlternate(icao), onFly(plan), onBack }) -> Element
 *     replan torna el pla amb el combustible nou (el lliscador el pinta en
 *     directe). onAlternate nomes als vols propis (el contracte te el desti
 *     fix: nomes l avis).
 */

import { t, fmtMoney, fmtNumber, fmtDuration } from '../i18n/index.js';
import { minuteParts, turbulenceLevel } from '../app/index.js';
import { MAX_TAILWIND_KT as MAX_TAILWIND } from '../world/index.js';
import { el, fill } from './dom.js';

const button = (label, onClick, primary, disabled) =>
  el('button', { type: 'button', class: primary ? 'pa-primary' : null, onclick: onClick, disabled: !!disabled }, label);

const kv = (label, value, cls) => el('div', { class: 'pa-kv' }, el('span', {}, label), el('b', { class: cls || null }, value));

const when = minute => { const m = minuteParts(minute); return t('briefing.when', { day: fmtNumber(m.day), time: m.hhmm }); };

function weatherTable(plan) {
  const row = (label, f) => el('tr', {}, el('th', {}, label), el('td', {}, f(plan.weather.origin)), el('td', {}, f(plan.weather.dest)));
  return el('table', { class: 'pa-wx' },
    el('thead', {}, el('tr', {}, el('th', {}), el('th', {}, plan.from), el('th', {}, plan.to))),
    el('tbody', {},
      row(t('briefing.wx.wind'), w => w.gustKt > w.windKt
        ? t('briefing.wx.windGust', { dir: String(w.windDirDeg).padStart(3, '0'), kt: w.windKt, gust: w.gustKt })
        : t('briefing.wx.windValue', { dir: String(w.windDirDeg).padStart(3, '0'), kt: w.windKt })),
      row(t('briefing.wx.visibility'), w => w.visibilityM >= 10000 ? t('briefing.wx.visMax') : t('briefing.wx.visValue', { m: fmtNumber(w.visibilityM) })),
      row(t('briefing.wx.ceiling'), w => w.ceilingFt === null ? t('briefing.wx.clear') : t('briefing.wx.ceilingValue', { ft: fmtNumber(w.ceilingFt) })),
      row(t('briefing.wx.turbulence'), w => t('briefing.wx.turb.' + turbulenceLevel(w))),
      row(t('briefing.wx.conditions'), w => el('span', { class: w.hard ? 'pa-bad' : 'pa-ok' }, t(w.hard ? 'briefing.wx.hard' : 'briefing.wx.normal')))));
}

export function briefingScreen(plan0, { replan, onAlternate, onFly, onBack }) {
  const node = el('section', { class: 'pa-briefing' });
  let plan = plan0;
  function render() {
    const fuel = el('div', { class: 'pa-section' });
    const slider = el('input', { type: 'range', class: 'pa-range', min: plan.minFuelKg, max: Math.max(plan.minFuelKg, plan.maxFuelKg), step: 10,
      value: plan.fuelKg, 'aria-label': t('briefing.fuel.load'),
      oninput: e => { plan = replan({ fuelKg: Number(e.target.value) }); paintFuel(); } });
    function paintFuel() {
      fill(fuel,
        el('h4', {}, t('briefing.fuel.title')),
        kv(t('briefing.fuel.trip'), t('briefing.kg', { kg: fmtNumber(plan.tripFuelKg) })),
        kv(t('briefing.fuel.min'), t('briefing.kg', { kg: fmtNumber(plan.minFuelKg) })),
        kv(t('briefing.fuel.max'), t('briefing.kg', { kg: fmtNumber(plan.maxFuelKg) })),
        el('label', { class: 'pa-field' }, el('span', { class: 'pa-label' }, t('briefing.fuel.load')), slider),
        kv(t('briefing.fuel.load'), t('briefing.kg', { kg: fmtNumber(plan.fuelKg) })),
        kv(t('briefing.mass'), t('briefing.kg', { kg: fmtNumber(plan.massKg) })),
        el('p', { class: 'pa-desc' }, t('briefing.fuel.note')));
    }
    paintFuel();
    const tail = plan.tailwindKt > MAX_TAILWIND
      ? el('div', { class: 'pa-dialog', role: 'alert' },
        el('p', { class: 'pa-msg pa-bad' }, t('briefing.tailwind', { kt: fmtNumber(plan.tailwindKt), rwy: plan.arrivalRunway, icao: plan.to, max: MAX_TAILWIND })),
        plan.alternate
          ? (plan.contract
            ? el('p', { class: 'pa-desc' }, t('briefing.alternateContract', { icao: plan.alternate }))
            : el('div', { class: 'pa-btns' }, button(t('briefing.alternateFly', { icao: plan.alternate }), () => onAlternate(plan.alternate))))
          : el('p', { class: 'pa-desc' }, t('briefing.noAlternate')))
      : null;
    fill(node,
      el('h2', {}, t('briefing.title', { from: plan.from, to: plan.to })),
      el('p', { class: 'pa-desc' }, t(plan.contract ? 'briefing.subtitleContract' : 'briefing.subtitle', { name: plan.name, reg: plan.reg })),
      el('div', { class: 'pa-section' },
        el('h4', {}, t('briefing.route')),
        kv(t('briefing.distance'), t('briefing.km', { km: fmtNumber(plan.km) })),
        kv(t('briefing.departure'), when(plan.departMinute)),
        kv(t('briefing.block'), fmtDuration(plan.blockMin)),
        kv(t('briefing.arrival'), when(plan.plannedArrivalMin)),
        kv(t('briefing.runway'), t('briefing.runwayValue', { icao: plan.to, rwy: plan.arrivalRunway }), plan.tailwindKt > MAX_TAILWIND ? 'pa-bad' : null)),
      tail,
      el('div', { class: 'pa-section' }, el('h4', {}, t('briefing.weather')), weatherTable(plan),
        plan.weatherBonus > 0 ? el('p', { class: 'pa-desc' }, t('briefing.weatherBonus', { pct: fmtNumber(plan.weatherBonus * 100) })) : null,
        el('p', { class: 'pa-desc' }, t('briefing.weatherSim'))),
      el('div', { class: 'pa-section' }, el('h4', {}, t('briefing.load')),
        kv(t('briefing.pax'), t('dispatch.paxValue', { pax: fmtNumber(plan.pax), seats: fmtNumber(plan.seats) })),
        plan.contract
          ? kv(t('briefing.fee'), fmtMoney(plan.fee))
          : [kv(t('dispatch.price'), fmtMoney(plan.price)), kv(t('dispatch.revenue'), fmtMoney(plan.estimate.revenue.tickets)),
            kv(t('dispatch.net'), fmtMoney(plan.estimate.net), plan.estimate.net < 0 ? 'pa-bad' : null)]),
      fuel,
      plan.ok ? null : el('p', { class: 'pa-msg pa-bad' }, t('dispatch.reason.' + plan.reason)),
      el('div', { class: 'pa-btns' },
        button(t('briefing.fly'), () => onFly(plan), true, !plan.ok),
        button(t('briefing.back'), onBack)));
  }
  render();
  return node;
}
