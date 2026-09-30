/* Pantalla de la guia de consulta (docs/DECISIONS.md, 30/09/2026, E5).
 * Nomes pinta guideSections() (app/guide.js): les tecles surten de
 * CONTROL_KEYS i els textos d i18n.
 * NOU: tasca C5 d ENGINEERING.md.
 *
 * EXPORTA: guideScreen
 *
 * INTERFICIE (no la canviis, airline-ui.js en depen):
 *   guideScreen({ onClose }) -> Element
 */

import { t } from '../i18n/index.js';
import { guideSections } from '../app/index.js';
import { el } from './dom.js';

export function guideScreen({ onClose }) {
  const close = el('button', { type: 'button', class: 'pa-primary', onclick: onClose }, t('guide.close'));
  return el('section', { class: 'pa-guide', 'aria-labelledby': 'paGuideTitle' },
    el('h2', { id: 'paGuideTitle' }, t('guide.title')),
    el('p', { class: 'pa-dim' }, t('guide.intro')),
    guideSections().map(sec => el('div', {},
      el('h3', {}, t(sec.titleKey)),
      el('div', { class: 'pa-board' }, sec.rows.map(r =>
        el('div', { class: 'pa-row' }, el('span', { class: 'pa-code' }, r.term), el('span', {}, t(r.textKey))))))),
    el('div', { class: 'pa-btns' }, close));
}
