/* Debrief d un vol d Airline, despres de l informe d aterratge (D3+D4,
 * docs/DECISIONS.md 2026-10-02, D3D4-12): compte de resultats (ingressos,
 * costos i net), el que es paga fora del resultat (cicles, danys i quotes),
 * la variacio del saldo, XP i progres de rang, desgast, danys, reputacio i
 * desviament. Nomes pinta debriefModel (app/dispatch.js): cap calcul aqui.
 * NOU: tasca D4 d ENGINEERING.md.
 *
 * EXPORTA: debriefScreen
 *
 * INTERFICIE (no la canviis, airline-ui.js en depen):
 *   debriefScreen(model, { onContinue }) -> Element   model = debriefModel(settlement)
 */

import { t, fmtMoney, fmtNumber, fmtDuration } from '../i18n/index.js';
import { el } from './dom.js';

const kv = (label, value, cls, rowCls) => el('div', { class: 'pa-kv' + (rowCls ? ' ' + rowCls : '') }, el('span', {}, label), el('b', { class: cls || null }, value));
const money = (v, label, rowCls) => kv(label, fmtMoney(v), v < 0 ? 'pa-bad' : v === 0 ? 'pa-dim' : null, rowCls);
const signed = v => (v > 0 ? '+' : '') + fmtNumber(v, Number.isInteger(v) ? 0 : 1);

export function debriefScreen(m, { onContinue }) {
  const sec = (title, ...children) => el('div', { class: 'pa-section' }, el('h4', {}, title), ...children);
  const timing = m.arrivalDeltaMin === null ? null
    : kv(t('debrief.arrival'), m.arrivalDeltaMin === 0 ? t('debrief.onTime')
      : t(m.arrivalDeltaMin > 0 ? 'debrief.late' : 'debrief.early', { min: fmtNumber(Math.abs(m.arrivalDeltaMin)) }));
  return el('section', { class: 'pa-debrief' },
    el('h2', {}, t('debrief.airline.title', { from: m.route.from, to: m.route.landedAt ?? m.route.to })),
    el('p', { class: 'pa-desc' }, t(m.contract ? 'debrief.subtitleContract' : 'debrief.subtitle')),
    m.divert ? el('div', { class: 'pa-dialog', role: 'alert' },
      el('p', { class: 'pa-msg pa-bad' }, t('debrief.divert', { icao: m.divert.landedAt, to: m.route.to,
        pct: fmtNumber(m.divert.revenueMult * 100), rep: signed(m.divert.reputation) })),
      m.route.location ? el('p', { class: 'pa-desc' }, t('debrief.divertLocation', { icao: m.route.location })) : null) : null,
    sec(t('debrief.landing'),
      kv(t('debrief.score'), m.landing.score === null ? t('debrief.noLanding') : t('debrief.scoreValue', { score: fmtNumber(m.landing.score) })),
      kv(t('debrief.band'), t(m.landing.key)),
      kv(t('debrief.mult'), t('market.mult', { value: fmtNumber(m.landing.mult, 2) })),
      kv(t('debrief.block'), fmtDuration(m.blockMin)),
      timing),
    sec(t('debrief.revenue'), m.revenue.map(r => money(r.value, t('debrief.rev.' + r.key))), money(m.revenueTotal, t('debrief.total'), 'pa-total')),
    m.costs.length ? sec(t('debrief.costs'), m.costs.map(c => money(-c.value, t('debrief.cost.' + c.key))), money(-m.costsTotal, t('debrief.total'), 'pa-total')) : null,
    sec(t('debrief.result'),
      m.factor ? kv(t('debrief.factor'), t('debrief.factorValue', { subtotal: fmtMoney(m.factor.subtotal), K: fmtNumber(m.factor.K, 1), r: fmtNumber(m.factor.rotation, 1) })) : null,
      money(m.net, t('debrief.net'), 'pa-total'),
      m.after.map(a => money(a.value, t('debrief.after.' + a.key))),
      money(m.cashDelta, t('debrief.cashDelta'), 'pa-total'),
      money(m.cashAfter, t('debrief.cashAfter'))),
    sec(t('debrief.xp'),
      kv(t('debrief.xpGained'), signed(m.xp.gained), m.xp.gained < 0 ? 'pa-bad' : null),
      kv(t('debrief.xpTotal'), fmtNumber(m.xp.total)),
      kv(t('debrief.rank'), t('rank.' + m.xp.rankAfter)),
      m.xp.next ? kv(t('debrief.nextRank', { rank: t('rank.' + m.xp.next) }), t('debrief.remaining', { xp: fmtNumber(m.xp.remaining) })) : null,
      el('div', { class: 'pa-xpbar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(m.xp.progress * 100) },
        el('span', { style: 'width:' + Math.round(m.xp.progress * 100) + '%' })),
      m.xp.rankUp ? el('p', { class: 'pa-msg pa-ok', role: 'status' }, t('debrief.rankUp', { rank: t('rank.' + m.xp.rankAfter) })) : null,
      m.xp.rankDown ? el('p', { class: 'pa-msg pa-bad' }, t('debrief.rankDown', { rank: t('rank.' + m.xp.rankAfter) })) : null),
    m.wear ? sec(t('debrief.wear'), m.wear.map(w => kv(t('cond.' + w.key),
      t('debrief.wearValue', { after: fmtNumber(w.after, 1), delta: fmtNumber(w.delta, 1) }), w.delta < 0 ? 'pa-warn' : null))) : null,
    m.damage.items.length ? sec(t('debrief.damage'),
      m.damage.items.map(i => kv(t('debrief.damage.' + i.id), m.contract ? t('debrief.notYours') : fmtMoney(-i.cost), m.contract ? 'pa-dim' : 'pa-bad')),
      m.damage.groundedDays > 0 ? kv(t('debrief.grounded'), t('debrief.groundedValue', { days: fmtNumber(m.damage.groundedDays) }), 'pa-bad') : null,
      m.damage.xpLoss > 0 ? kv(t('debrief.xpLoss'), signed(-m.damage.xpLoss), 'pa-bad') : null) : null,
    sec(t('debrief.reputation'),
      kv(t('debrief.reputationValue', { before: fmtNumber(m.reputation.before, 1) }), t('debrief.reputationAfter', {
        after: fmtNumber(m.reputation.after, 1), delta: signed(m.reputation.delta) }), m.reputation.delta < 0 ? 'pa-bad' : null)),
    el('div', { class: 'pa-btns' }, el('button', { type: 'button', class: 'pa-primary', onclick: onContinue }, t('debrief.continue'))));
}
