/* Encaminador de les pantalles d Airline i del menu principal (E8): tria la
 * pantalla segons l estat de la partida (entryScreen, app/airline.js) i
 * lliga cada boto amb l operacio d app/. Desa la partida en tancar cada
 * pantalla (E1), mai per frame.
 * NOU: tasca C5+D1 d ENGINEERING.md (docs/DECISIONS.md, 30/09/2026).
 * No importa Game ni render/: el que toca el simulador arriba com a hooks.
 *
 * EXPORTA: initAirlineUi showMainMenu enterAirline showAirlineHome
 *          hideAirlineUi isAirlineUiOpen
 *
 * INTERFICIE (no la canviis, index.html en depen):
 *   initAirlineUi({ launchLesson(lessonId), openFreeFlight(), onShow() })
 *     crea el contenidor, l estil i l avis de 'save:error'. onShow es crida
 *     cada cop que s obre una pantalla (index.html amaga el menu de Free
 *     Flight i el HUD).
 *   showMainMenu()     les dues portes: Free Flight i Airline
 *   enterAirline()     openAirline() i la resposta a cada estat de loadCareer
 *   showAirlineHome()  la pantalla que toca amb la partida en memoria
 *     (tornar d una llico, boto DEV): nom, escola, graduacio o centre
 *   hideAirlineUi()    amaga la capa (desa si hi ha partida)
 *   isAirlineUiOpen() -> boolean
 */

import { t } from '../i18n/index.js';
import { BALANCE } from '../career/index.js';
import {
  on, openAirline, currentCareer, pendingCareer, entryScreen, createAirline,
  acceptBalanceMismatch, startOver, graduateCareer, exportCareer, importCareer,
  saveAirline, topBarModel, NAME_MAX_LENGTH
} from '../app/index.js';
import { el, ensureStyles } from './dom.js';
import { mainMenuScreen, nameScreen, schoolScreen, graduationScreen, opsScreen, noticeScreen } from './screens.js';

let root = null, hooks = {}, bannerTimer = 0;

export function initAirlineUi(h) {
  hooks = h || {};
  ensureStyles();
  root = el('div', { id: 'airlineUi', class: 'pa-ui pa-side', hidden: true });
  document.body.append(root);
  on('save:error', () => banner(t('save.error')));
}

export function isAirlineUiOpen() { return !!root && !root.hidden; }

/** tanca la pantalla actual (desa, E1) i obre la nova */
function mount(node, wide) {
  if (isAirlineUiOpen() && currentCareer()) saveAirline();
  root.className = 'pa-ui ' + (wide ? 'pa-wide' : 'pa-side');
  root.replaceChildren(node);
  root.hidden = false;
  root.scrollTop = 0;
  if (hooks.onShow) hooks.onShow();
}

export function hideAirlineUi() {
  if (!isAirlineUiOpen()) return;
  if (currentCareer()) saveAirline();
  root.hidden = true;
  root.replaceChildren();
}

function banner(text, good) {
  const b = el('div', { class: 'pa-banner' + (good ? ' pa-good' : ''), role: good ? 'status' : 'alert' }, text);
  document.body.append(b);
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.remove(), 6000);
}

export function showMainMenu() {
  mount(mainMenuScreen({
    onFreeFlight: () => { hideAirlineUi(); if (hooks.openFreeFlight) hooks.openFreeFlight(); },
    onAirline: enterAirline
  }));
}

export function enterAirline() {
  const r = openAirline();
  if (r.status === 'balanceMismatch') return balanceNotice();
  if (r.status === 'invalid') return invalidNotice(r.backupKey);
  if (r.status === 'migrated') {
    return mount(noticeScreen({ title: t('save.migrated.title'), text: t('save.migrated.text'),
      buttons: [{ label: t('save.continue'), primary: true, onClick: showAirlineHome }] }));
  }
  showAirlineHome();
}

function balanceNotice() {
  mount(noticeScreen({
    title: t('save.balanceMismatch.title'),
    text: t('save.balanceMismatch.text', { saved: pendingCareer().balanceVersion, current: BALANCE.version }),
    buttons: [
      { label: t('save.continue'), primary: true, onClick: () => { acceptBalanceMismatch(); showAirlineHome(); } },
      { label: t('save.startOver'), onClick: () => doStartOver() },
      { label: t('menu.back'), onClick: showMainMenu }
    ]
  }));
}

function invalidNotice(backupKey) {
  mount(noticeScreen({
    title: t('save.invalid.title'), tone: 'bad',
    text: backupKey ? t('save.invalid.text', { key: backupKey }) : t('save.invalid.noBackup'),
    buttons: [
      backupKey ? { label: t('save.startOver'), primary: true, onClick: () => doStartOver() } : null,
      { label: t('menu.back'), onClick: showMainMenu }
    ].filter(Boolean)
  }));
}

function doStartOver() {
  if (startOver()) return showName();
  mount(noticeScreen({ title: t('save.invalid.title'), tone: 'bad', text: t('save.startOverFailed'),
    buttons: [{ label: t('menu.back'), onClick: showMainMenu }] }));
}

export function showAirlineHome() {
  const state = currentCareer(), screen = entryScreen(state);
  if (screen === 'name') return showName();
  if (screen === 'graduation') return showGraduation();
  if (screen === 'ops') return showOps();
  showSchool();
}

function showName() {
  mount(nameScreen({
    onSubmit: name => {
      const r = createAirline(name);
      if (!r.ok) return t('airline.name.invalid', { max: NAME_MAX_LENGTH });
      showAirlineHome();
      return null;
    },
    onBack: showMainMenu
  }));
}

function saveActions() {
  return { onExport: exportSave, onImport: importSave };
}

function showSchool() {
  const state = currentCareer();
  mount(schoolScreen(state, {
    onFly: id => { hideAirlineUi(); hooks.launchLesson(id); },
    onOps: state.school.graduated ? showOps : null,
    onBack: showMainMenu,
    ...saveActions()
  }));
}

function showGraduation() {
  const result = graduateCareer();
  if (!result) return showAirlineHome();
  mount(graduationScreen(currentCareer(), result, { onOpen: showOps }));
}

function showOps() {
  const state = currentCareer();
  mount(opsScreen(state, topBarModel(state), { onSchool: showSchool, onBack: showMainMenu, ...saveActions() }), true);
}

function exportSave() {
  const text = exportCareer();
  if (text === null) return;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = el('a', { href: url, download: t('save.fileName') });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importSave() {
  const input = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    let text = null;
    try { text = await file.text(); } catch (e) { text = null; }
    const r = importCareer(text);
    if (!r.ok) {
      const back = currentCareer() ? showAirlineHome : showMainMenu;
      return mount(noticeScreen({ title: t('save.import'), tone: 'bad', text: t('save.importFailed'),
        buttons: [{ label: t('save.continue'), primary: true, onClick: back }] }));
    }
    banner(t('save.imported'), true);
    showAirlineHome();
  });
  document.body.append(input);
  input.click();
}
