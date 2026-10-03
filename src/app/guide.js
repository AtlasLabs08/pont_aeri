/* Guia de consulta (docs/DECISIONS.md, 30/09/2026, E5): les tecles, els
 * parametres del HUD i els simbols, amb una frase curta per a cadascun.
 * Nomes consulta: no es practica i no te criteris. Les tecles surten sempre
 * de CONTROL_KEYS (career/lessons.js), mai escrites al text; els textos son
 * a i18n (guide.*). ui/guide.js la pinta.
 * NOU: tasca C5 d ENGINEERING.md. Inventari del HUD fet a les seccions 18b
 * (HUD i caixa d aproximacio) i 20 (franja inferior, UI.frame) d index.html.
 *
 * EXPORTA: GUIDE guideSections
 *
 * INTERFICIE (no la canviis, ui/ i els tests en depenen):
 *   GUIDE: [{ id, kind, items }]   kind 'keys' (items = noms de
 *     CONTROL_KEYS) o 'text' (items = ids; textos guide.<seccio>.<id>.term i
 *     .text).
 *   guideSections() -> [{ id, titleKey, rows: [{ term, textKey }] }]
 *     A les files de tecles, term = les etiquetes de keyLabel dels codis del
 *     comandament, sense repetir, separades per ' / ', i textKey =
 *     'guide.key.' + comandament. A les altres, term = t('guide.<seccio>.<id>.term').
 *     Les files amb valors porten params per a t(textKey, params): la Vref
 *     (hud.vref, D2+D5 X2) es la de l avio de la llico 7 (el Mi-9), de
 *     aircraftSpeeds, la mateixa font que el PFD.
 */

import { CONTROL_KEYS } from '../career/index.js';
import { t } from '../i18n/index.js';
import { keyLabel, aircraftSpeeds } from './lesson-run.js';
import { LESSONS } from '../career/index.js';
import { TAXI_LIMIT_KT } from '../core/index.js';

/** valors de les files de text que en tenen: mai escrits al text i18n */
const TEXT_PARAMS = {
  'hud.vref': () => ({ vref: aircraftSpeeds(LESSONS.find(l => l.id === 'landing').aircraftTypeId).vref })
};

/** valors de les files de tecles que en tenen */
const KEY_PARAMS = {
  taxiLimiter: () => ({ kt: TAXI_LIMIT_KT })
};

export const GUIDE = [
  { id: 'flying', kind: 'keys', items: ['pitchDown', 'pitchUp', 'rollLeft', 'rollRight', 'steerLeft', 'steerRight',
    'throttleUp', 'throttleDown', 'trimDown', 'trimUp', 'autoTrim', 'mouseYoke'] },
  { id: 'configuration', kind: 'keys', items: ['flapsDown', 'flapsUp', 'gear', 'spoiler', 'brake', 'parkBrake',
    'reverse', 'taxiLimiter', 'landingLights'] },
  { id: 'automation', kind: 'keys', items: ['autopilot', 'autothrottle', 'approach', 'timeAccel'] },
  { id: 'views', kind: 'keys', items: ['camera', 'cameraReset', 'hudToggle', 'sound', 'brightnessDown', 'brightnessUp',
    'help', 'debug', 'pause', 'replayExit'] },
  { id: 'mouse', kind: 'text', items: ['rightDrag', 'rightDouble', 'wheel', 'leftClick'] },
  { id: 'strip', kind: 'text', items: ['ias', 'alt', 'vs', 'hdg', 'thrust', 'flaps', 'gear', 'splr', 'brake', 'apAthr', 'warnings', 'clock'] },
  { id: 'hud', kind: 'text', items: ['speed', 'target', 'groundSpeed', 'altitude', 'verticalSpeed', 'radioAlt', 'heading',
    'modes', 'ilsIdent', 'flareCue', 'vref'] },
  { id: 'symbols', kind: 'text', items: ['horizon', 'pitchLadder', 'boresight', 'pathVector', 'glidepathRef', 'guidanceCue',
    'syntheticRunway', 'bankScale', 'speedTrend', 'ilsScales', 'approachBox', 'papi', 'taxiTarget'] }
];

function keysTerm(control) {
  return [...new Set(CONTROL_KEYS[control].map(keyLabel))].join(' / ');
}

export function guideSections() {
  return GUIDE.map(({ id, kind, items }) => ({
    id,
    titleKey: 'guide.section.' + id,
    rows: items.map(item => kind === 'keys'
      ? { term: keysTerm(item), textKey: 'guide.key.' + item, ...(KEY_PARAMS[item] ? { params: KEY_PARAMS[item]() } : {}) }
      : { term: t('guide.' + id + '.' + item + '.term'), textKey: 'guide.' + id + '.' + item + '.text',
          ...(TEXT_PARAMS[id + '.' + item] ? { params: TEXT_PARAMS[id + '.' + item]() } : {}) })
  }));
}
