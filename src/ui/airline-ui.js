/* Encaminador de les pantalles d Airline i del menu principal (E8): tria la
 * pantalla segons l estat de la partida (entryScreen, app/airline.js) i
 * lliga cada boto amb l operacio d app/. Desa la partida en tancar cada
 * pantalla (E1), mai per frame.
 * NOU: tasca C5+D1 d ENGINEERING.md (docs/DECISIONS.md, 30/09/2026).
 * No importa Game ni render/: el que toca el simulador arriba com a hooks.
 *
 * EXPORTA: initAirlineUi showMainMenu enterAirline showAirlineHome
 *          hideAirlineUi isAirlineUiOpen showGuide refreshAirlineUi
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
 *   refreshAirlineUi()   si el centre d operacions es obert, el torna a
 *     pintar amb la partida en memoria, a la mateixa pestanya (boto DEV
 *     "new market").
 *   showGuide(onClose)   guia de consulta (E5). Des de la pausa de Free
 *     Flight: no crida onShow ni desa, i onClose (qui l ha obert) decideix
 *     que es torna a veure. Des de l escola hi ha un boto.
 */

import { t, fmtMoney } from '../i18n/index.js';
import { BALANCE } from '../career/index.js';
import {
  on, openAirline, currentCareer, pendingCareer, entryScreen, createAirline,
  acceptBalanceMismatch, startOver, graduateCareer, exportCareer, importCareer,
  saveAirline, topBarModel, NAME_MAX_LENGTH, ensureMarket, marketModel, fleetModel,
  buyListing, sellAirframe
} from '../app/index.js';
import { el, ensureStyles } from './dom.js';
import { mainMenuScreen, nameScreen, schoolScreen, graduationScreen, opsScreen, noticeScreen } from './screens.js';
import { guideScreen } from './guide.js';
import { fleetPanel } from './fleet.js';
import { marketPanel } from './market.js';

let root = null, hooks = {}, bannerTimer = 0, screen = null, opsTab = null;

export function initAirlineUi(h) {
  hooks = h || {};
  ensureStyles();
  root = el('div', { id: 'airlineUi', class: 'pa-ui pa-side', hidden: true });
  document.body.append(root);
  on('save:error', () => banner(t('save.error')));
}

export function isAirlineUiOpen() { return !!root && !root.hidden; }

/** tanca la pantalla actual (desa, E1) i obre la nova. overlay: la guia
 *  oberta des de la pausa, que no toca ni la partida ni la resta de la UI */
function mount(node, wide, overlay, name = null) {
  if (!overlay && isAirlineUiOpen() && currentCareer()) saveAirline();
  screen = overlay ? screen : name;
  root.className = 'pa-ui ' + (wide ? 'pa-wide' : 'pa-side');
  root.replaceChildren(node);
  root.hidden = false;
  root.scrollTop = 0;
  if (!overlay && hooks.onShow) hooks.onShow();
}

export function showGuide(onClose) {
  mount(guideScreen({ onClose: () => { root.hidden = true; root.replaceChildren(); if (onClose) onClose(); } }), false, true);
}

export function hideAirlineUi() {
  if (!isAirlineUiOpen()) return;
  if (currentCareer()) saveAirline();
  root.hidden = true;
  root.replaceChildren();
  screen = null;
}

export function refreshAirlineUi() {
  if (isAirlineUiOpen() && screen === 'ops' && currentCareer()) showOps(opsTab);
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
      { label: t('save.continue'), primary: true, onClick: () => { if (acceptBalanceMismatch()) showAirlineHome(); else continueFailed(); } },
      { label: t('save.startOver'), onClick: () => doStartOver() },
      { label: t('menu.back'), onClick: showMainMenu }
    ]
  }));
}

function continueFailed() {
  mount(noticeScreen({ title: t('save.balanceMismatch.title'), tone: 'bad', text: t('save.continueFailed'),
    buttons: [{ label: t('menu.back'), onClick: showMainMenu }] }));
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
    onGuide: () => mount(guideScreen({ onClose: showSchool })),
    onOps: state.school.graduated ? () => showOps() : null,
    onBack: showMainMenu,
    ...saveActions()
  }));
}

function showGraduation() {
  const result = graduateCareer();
  if (!result) return showAirlineHome();
  mount(graduationScreen(currentCareer(), result, { onOpen: () => showOps() }));
}

/** centre d operacions a la pestanya tab. En tornar a pintar-lo (comprar,
 *  vendre), la barra superior s actualitza i la posicio de scroll es queda. */
function showOps(tab = null) {
  ensureMarket();
  const state = currentCareer();
  const again = screen === 'ops' && isAirlineUiOpen(), scroll = root.scrollTop;
  mount(opsScreen(state, topBarModel(state), {
    onSchool: showSchool, onBack: showMainMenu, ...saveActions(),
    tab: tab ?? opsTab, onTab: id => { opsTab = id; },
    panels: {
      fleet: () => fleetPanel(fleetModel(currentCareer()), { onSell: sell, onMarket: () => showOps('market') }),
      market: () => marketPanel(marketModel(currentCareer()), { onBuy: buy })
    }
  }), true, false, 'ops');
  if (again) root.scrollTop = scroll;
}

function buy(reg, mode) {
  const r = buyListing(reg, mode);
  if (r.ok) banner(t('market.bought', { reg, icao: r.airframe.location }), true);
  showOps('market');
}

function sell(reg) {
  const r = sellAirframe(reg);
  if (r.ok) banner(t('fleet.sold', { reg, net: fmtMoney(r.net) }), true);
  showOps('fleet');
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
