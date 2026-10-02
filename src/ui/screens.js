/* Pantalles d Airline: menu principal, nom del pilot, escola, graduacio,
 * centre d operacions i avisos. Nomes pinten: cada boto crida una accio que
 * rep de l encaminador (airline-ui.js), que es qui parla amb app/.
 * NOU: tasca C5+D1 d ENGINEERING.md (docs/DECISIONS.md, 30/09/2026, E1-E9).
 *
 * EXPORTA: mainMenuScreen nameScreen schoolScreen graduationScreen
 *          opsScreen noticeScreen creditsScreen OPS_TABS CREDITS
 *
 * INTERFICIE (no la canviis, airline-ui.js en depen):
 *   mainMenuScreen({ onFreeFlight, onAirline, onSettings?, onCredits? })
 *     onSettings: fila d ajustos (X1 del D2+D5), el mateix panell que Esc
 *     dins d un vol; onCredits: fila de credits (TA-8)
 *   creditsScreen({ onBack })   fonts de dades i atribucions obligatories
 *     (terreny real, docs/DECISIONS.md, 2026-10-02, TA-8): una entrada per
 *     font de CREDITS, amb els textos de credits.<id>.* a i18n
 *   nameScreen({ onSubmit(name) -> missatge d error o null, onBack })
 *   schoolScreen(state, { onFly(lessonId), onGuide, onExport, onImport,
 *     onOps, onBack })   onOps nomes si el pilot es graduat
 *   graduationScreen(state, result, { onOpen })   result de graduateCareer()
 *   opsScreen(state, topBarModel, { onSchool, onExport, onImport, onBack,
 *     tab?, onTab?, panels? })   tab: pestanya inicial (OPS_TABS[0] si no
 *     n hi ha); onTab(id) en canviar de pestanya; panels: { id: () =>
 *     Element } per a les pestanyes que ja existeixen (D2 Fleet, D5
 *     Market). La resta diuen "Aviat".
 *   noticeScreen({ title, text, tone, buttons: [{ label, primary?, onClick }] })
 *   Totes retornen un Element.
 */

import { t, fmtMoney, fmtNumber } from '../i18n/index.js';
import { LESSONS, isLessonAvailable } from '../career/index.js';
import { lessonGoalParams, messageText, NAME_MAX_LENGTH } from '../app/index.js';
import { el } from './dom.js';
import { topBar } from './top-bar.js';

/** les set pestanyes de DESIGN.md, en ordre (E7) */
export const OPS_TABS = ['dispatch', 'fleet', 'market', 'crew', 'pilot', 'finance', 'map'];

const button = (label, onClick, primary) => el('button', { type: 'button', class: primary ? 'pa-primary' : null, onclick: onClick }, label);

/** fila clicable del taulell, activable amb el teclat */
function clickRow(onClick, ...cells) {
  const act = e => { if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } };
  return el('div', { class: 'pa-row pa-click', role: 'button', tabindex: 0, onclick: act, onkeydown: act }, ...cells);
}

export function mainMenuScreen({ onFreeFlight, onAirline, onSettings, onCredits }) {
  return el('section', { 'aria-labelledby': 'paMenuTitle' },
    el('h1', { id: 'paMenuTitle' }, t('menu.title')),
    el('p', { class: 'pa-sub' }, t('menu.subtitle')),
    el('div', { class: 'pa-board' },
      el('div', { class: 'pa-head' }, el('span', {}, t('menu.col.flight')), el('span', {}, t('menu.col.mode')), el('span', { class: 'pa-status' }, t('menu.col.status'))),
      clickRow(onFreeFlight, el('span', { class: 'pa-code' }, t('menu.freeFlight.code')),
        el('span', { class: 'pa-name' }, t('menu.freeFlight'), el('span', { class: 'pa-desc' }, t('menu.freeFlight.desc'))),
        el('span', { class: 'pa-status pa-ok' }, t('menu.status.open'))),
      clickRow(onAirline, el('span', { class: 'pa-code' }, t('menu.airline.code')),
        el('span', { class: 'pa-name' }, t('menu.airline'), el('span', { class: 'pa-desc' }, t('menu.airline.desc'))),
        el('span', { class: 'pa-status pa-warn' }, t('menu.status.boarding'))),
      onSettings ? clickRow(onSettings, el('span', { class: 'pa-code' }, t('menu.settings.code')),
        el('span', { class: 'pa-name' }, t('menu.settings'), el('span', { class: 'pa-desc' }, t('menu.settings.desc'))),
        el('span', { class: 'pa-status pa-off' }, t('menu.status.ground'))) : null,
      onCredits ? clickRow(onCredits, el('span', { class: 'pa-code' }, t('menu.credits.code')),
        el('span', { class: 'pa-name' }, t('menu.credits'), el('span', { class: 'pa-desc' }, t('menu.credits.desc'))),
        el('span', { class: 'pa-status pa-off' }, t('menu.status.ground'))) : null));
}

/** fonts de dades amb atribucio obligatoria (TA-8); textos a i18n: credits.<id>.term, .text i .attribution */
export const CREDITS = ['terrain', 'photo', 'airports'];

export function creditsScreen({ onBack }) {
  return el('section', { 'aria-labelledby': 'paCreditsTitle' },
    el('h2', { id: 'paCreditsTitle' }, t('credits.title')),
    el('p', { class: 'pa-dim' }, t('credits.intro')),
    ...CREDITS.map(id => el('div', { class: 'pa-credit' },
      el('h3', {}, t(`credits.${id}.term`)),
      el('p', {}, t(`credits.${id}.text`)),
      el('p', { class: 'pa-dim' }, t(`credits.${id}.attribution`)))),
    el('div', { class: 'pa-btns' }, button(t('menu.back'), onBack, true)));
}

export function nameScreen({ onSubmit, onBack }) {
  const input = el('input', { type: 'text', id: 'paPilotName', maxlength: NAME_MAX_LENGTH * 2, autocomplete: 'off', spellcheck: 'false' });
  const msg = el('p', { class: 'pa-msg pa-bad', role: 'alert' });
  const submit = e => { e.preventDefault(); const error = onSubmit(input.value); msg.textContent = error || ''; };
  const node = el('section', {},
    el('h2', {}, t('airline.name.title')),
    el('p', { class: 'pa-dim' }, t('airline.name.intro')),
    el('form', { onsubmit: submit },
      el('label', { class: 'pa-label', for: 'paPilotName' }, t('airline.name.label')),
      input,
      el('p', { class: 'pa-dim pa-msg' }, t('airline.name.hint', { max: NAME_MAX_LENGTH })),
      msg,
      el('div', { class: 'pa-btns' },
        el('button', { type: 'submit', class: 'pa-primary' }, t('airline.name.start')),
        button(t('airline.back'), onBack))));
  setTimeout(() => input.focus(), 0);
  return node;
}

function lessonStatus(school, lesson) {
  if (school.lessonsPassed.includes(lesson.id)) return { cls: 'pa-ok', key: 'school.status.passed', fly: 'school.repeat' };
  if (isLessonAvailable(school, lesson.id)) return { cls: 'pa-warn', key: 'school.status.available', fly: 'school.fly' };
  return { cls: 'pa-off', key: 'school.status.locked', fly: null };
}

export function schoolScreen(state, { onFly, onGuide, onExport, onImport, onOps, onBack }) {
  const school = state.school;
  const rows = LESSONS.map((lesson, i) => {
    const st = lessonStatus(school, lesson), attempts = school.attempts[lesson.id] || 0;
    return el('div', { class: 'pa-row' + (st.fly ? '' : ' pa-locked') },
      el('span', { class: 'pa-code' }, fmtNumber(i + 1)),
      el('span', { class: 'pa-name' }, t(lesson.titleKey),
        el('span', { class: 'pa-desc' }, messageText({ key: lesson.goalKey, params: lessonGoalParams(lesson) })),
        attempts > 0 ? el('span', { class: 'pa-desc' }, t('school.attempts', { count: attempts })) : null),
      el('span', { class: 'pa-status ' + st.cls }, t(st.key)),
      st.fly ? button(t(st.fly), () => onFly(lesson.id), !school.lessonsPassed.includes(lesson.id)) : el('span'));
  });
  return el('section', {},
    el('h2', {}, t('school.title')),
    el('p', { class: 'pa-sub' }, t('school.subtitle', { name: state.pilot.name })),
    el('div', { class: 'pa-board pa-lessons' },
      el('div', { class: 'pa-head' }, el('span', {}, t('school.col.number')), el('span', {}, t('school.col.lesson')),
        el('span', { class: 'pa-status' }, t('school.col.status')), el('span')),
      rows),
    school.graduated ? el('p', { class: 'pa-dim' }, t('school.repeatNote')) : null,
    el('div', { class: 'pa-btns' },
      onOps ? button(t('school.toOps'), onOps, true) : null,
      onGuide ? button(t('guide.open'), onGuide) : null,
      button(t('save.export'), onExport),
      button(t('save.import'), onImport),
      button(t('menu.back'), onBack)));
}

export function graduationScreen(state, result, { onOpen }) {
  return el('section', {},
    el('h2', {}, t('graduation.title')),
    el('p', { class: 'pa-sub' }, t('school.subtitle', { name: state.pilot.name })),
    el('p', {}, t('graduation.text')),
    el('div', { class: 'pa-board' },
      el('div', { class: 'pa-kv' }, el('span', {}, t('graduation.rating')), el('b', {}, t('rating.' + result.rating))),
      el('div', { class: 'pa-kv' }, el('span', {}, t('graduation.xp')), el('b', {}, t('graduation.xpValue', { xp: fmtNumber(result.xpGained) }))),
      el('div', { class: 'pa-kv' }, el('span', {}, t('graduation.cash')), el('b', {}, fmtMoney(result.cash)))),
    el('p', { class: 'pa-dim' }, t('graduation.cashNote', { loan: fmtMoney(result.loan) })),
    el('div', { class: 'pa-btns' }, button(t('graduation.open'), onOpen, true)));
}

export function opsScreen(state, model, { onSchool, onExport, onImport, onBack, tab, onTab, panels = {} }) {
  const panel = el('div', { class: 'pa-tabpanel', role: 'tabpanel' });
  const tabs = OPS_TABS.map(id => el('button', { type: 'button', role: 'tab', 'data-tab': id, onclick: () => select(id) }, t('ops.tab.' + id)));
  function select(id) {
    for (const b of tabs) b.setAttribute('aria-selected', String(b.dataset.tab === id));
    const live = typeof panels[id] === 'function';
    panel.className = 'pa-tabpanel' + (live ? ' pa-live' : '');
    if (live) panel.replaceChildren(panels[id]());
    else panel.textContent = t('ops.soon');
    if (onTab) onTab(id);
  }
  select(OPS_TABS.includes(tab) ? tab : OPS_TABS[0]);
  return el('div', {},
    topBar(model),
    el('section', { class: 'pa-ops' },
      el('h2', {}, t('ops.title')),
      el('div', { class: 'pa-tabs', role: 'tablist' }, tabs),
      panel,
      el('div', { class: 'pa-btns' },
        button(t('ops.toSchool'), onSchool),
        button(t('save.export'), onExport),
        button(t('save.import'), onImport),
        button(t('menu.back'), onBack))));
}

export function noticeScreen({ title, text, tone, buttons }) {
  return el('section', { role: 'alertdialog', 'aria-labelledby': 'paNoticeTitle' },
    el('h2', { id: 'paNoticeTitle', class: tone === 'bad' ? 'pa-bad' : 'pa-warn' }, title),
    el('p', {}, text),
    el('div', { class: 'pa-btns' }, buttons.map(b => button(b.label, b.onClick, b.primary))));
}
