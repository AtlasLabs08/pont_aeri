/* Siluetes d avio de costat, en SVG inline, per a les targetes del Market quan
 * un tipus no te imatge (docs/DECISIONS.md 01/10/2026, K5). Disseny propi i
 * sobri: formes simples amb els colors del tema (classes .pa-sil-* a dom.js).
 * Una per classe: commuter, turbohelix, jet regional, narrowbody, widebody i
 * jumbo. Totes miren a la dreta i comparteixen escala, de manera que la mida
 * relativa de la classe es veu.
 * NOU: tasca "Market en targetes".
 *
 * EXPORTA: silhouette padlock
 *
 * INTERFICIE (no la canviis, ui/market.js en depen):
 *   silhouette(key) -> SVGElement   key de SILHOUETTES (app/aircraft-images.js).
 *     Una clau desconeguda dona la de narrowbody. Decoratiu (aria-hidden).
 *   padlock() -> SVGElement   cadenat per a les targetes bloquejades.
 */

const NS = 'http://www.w3.org/2000/svg';

/* x1 = morro; len = llargada; hh = mig alt del fuselatge; nose = llargada del
 * con del morro; fin = alcada de la deriva; wing = [x del naixement respecte de
 * la cua en fraccio de len, corda, envergadura aparent, alcada de l arrel
 * respecte de l eix en fraccio de hh]; engines = tipus i quants. */
const SPECS = {
  commuter:    { len: 112, hh: 9,  nose: 16, fin: 17, wing: [0.40, 30, 11, -0.85], engines: 'prop', hump: 0 },
  turboprop:   { len: 136, hh: 10, nose: 18, fin: 21, wing: [0.40, 34, 12, -0.7],  engines: 'prop', hump: 0 },
  regionalJet: { len: 158, hh: 11, nose: 24, fin: 25, wing: [0.46, 38, 13, 0.55],  engines: 'rear', hump: 0 },
  narrowbody:  { len: 188, hh: 12, nose: 28, fin: 28, wing: [0.44, 46, 16, 0.55],  engines: 'under', hump: 0 },
  widebody:    { len: 214, hh: 15, nose: 32, fin: 33, wing: [0.42, 58, 20, 0.55],  engines: 'under', hump: 0 },
  jumbo:       { len: 232, hh: 16, nose: 34, fin: 36, wing: [0.40, 64, 22, 0.55],  engines: 'quad', hump: 7 }
};

const X1 = 236, CY = 52, MID = 125;   // morro, eix del fuselatge i centre del viewBox (250 d ample)

function node(tag, attrs, children = []) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  n.append(...children);
  return n;
}

const pathOf = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L') + ' Z';

function fuselage(s) {
  const x0 = X1 - s.len, top = CY - s.hh, bot = CY + s.hh, nx = X1 - s.nose;
  const body = 'M' + x0 + ',' + (CY - s.hh * 0.8) +
    ' L' + (nx - (s.hump ? s.nose * 1.4 : 0)) + ',' + top +
    (s.hump ? ' Q' + (nx - s.nose * 0.9) + ',' + (top - s.hump) + ' ' + (nx - s.nose * 0.2) + ',' + (top + 1) : '') +
    ' Q' + (X1 + 1) + ',' + (top + 1) + ' ' + X1 + ',' + (CY + s.hh * 0.25) +
    ' Q' + (X1 - 4) + ',' + bot + ' ' + (nx - 6) + ',' + bot +
    ' L' + (x0 + s.len * 0.3) + ',' + bot +
    ' Q' + (x0 + 2) + ',' + (CY + s.hh * 0.55) + ' ' + x0 + ',' + (CY - s.hh * 0.8) + ' Z';
  return body;
}

function build(s) {
  const x0 = X1 - s.len, top = CY - s.hh, bot = CY + s.hh;
  const parts = [];
  const [wf, chord, span, rootK] = s.wing;
  const wx = x0 + s.len * wf, wy = CY + s.hh * rootK;
  const sweep = s.engines === 'prop' ? 4 : 14;

  // ala llunyana (a darrere del fuselatge) en quatre motors i jets: dona fondaria
  const wing = pathOf([[wx + sweep, wy], [wx + sweep + chord, wy], [wx + chord * 0.85, wy + span], [wx, wy + span]]);
  const nacelle = (cx, cy, w, h, cls) => node('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: h / 2, class: cls });

  if (s.engines === 'quad') {
    parts.push(nacelle(wx + chord * 0.62, wy + span * 0.5, 22, 8, 'pa-sil-engine pa-sil-far'));
  }
  // deriva i estabilitzador
  parts.push(node('path', { d: pathOf([[x0 + s.len * 0.13, top + s.hh * 0.45], [x0 + s.len * 0.015, top - s.fin],
    [x0 + s.len * 0.085, top - s.fin], [x0 + s.len * 0.22, top + s.hh * 0.2]]), class: 'pa-sil-fin' }));
  if (s.engines === 'rear') {
    parts.push(node('path', { d: pathOf([[x0 + s.len * 0.015, top - s.fin], [x0 + s.len * 0.085, top - s.fin],
      [x0 + s.len * 0.11, top - s.fin + 4], [x0 - 4, top - s.fin + 4]]), class: 'pa-sil-fin' }));
  }
  parts.push(node('path', { d: fuselage(s), class: 'pa-sil-body' }));
  // finestres
  parts.push(node('line', { x1: x0 + s.len * 0.24, x2: X1 - s.nose * 1.15, y1: CY - s.hh * 0.32, y2: CY - s.hh * 0.32, class: 'pa-sil-windows' }));
  parts.push(node('path', { d: pathOf([[X1 - s.nose * 0.95, CY - s.hh * 0.78], [X1 - s.nose * 0.35, CY - s.hh * 0.62],
    [X1 - s.nose * 0.3, CY - s.hh * 0.2], [X1 - s.nose * 0.95, CY - s.hh * 0.2]]), class: 'pa-sil-cockpit' }));
  parts.push(node('path', { d: wing, class: 'pa-sil-wing' }));

  if (s.engines === 'prop') {
    const nx = wx + sweep + chord * 0.55, ny = wy + span * 0.72;
    parts.push(nacelle(nx, ny, 26, 8, 'pa-sil-engine'));
    parts.push(node('ellipse', { cx: nx + 14, cy: ny, rx: 1.6, ry: 11, class: 'pa-sil-prop' }));
  } else if (s.engines === 'rear') {
    parts.push(nacelle(x0 + s.len * 0.2, CY - s.hh * 0.05, 24, 8, 'pa-sil-engine'));
  } else if (s.engines === 'under') {
    parts.push(nacelle(wx + chord * 0.5, wy + span * 0.8 + 3, 24, 9, 'pa-sil-engine'));
  } else {
    parts.push(nacelle(wx + chord * 0.42, wy + span * 0.95 + 3, 24, 9, 'pa-sil-engine'));
    parts.push(nacelle(wx + chord * 0.8, wy + span * 0.55 + 3, 20, 8, 'pa-sil-engine'));
  }
  // tren d aterratge
  for (const gx of [x0 + s.len * 0.36, x0 + s.len * 0.66, X1 - s.nose * 0.9]) {
    parts.push(node('circle', { cx: gx, cy: bot + 4, r: 3.4, class: 'pa-sil-wheel' }));
  }
  return parts;
}

export function silhouette(key) {
  const k = Object.hasOwn(SPECS, key) ? key : 'narrowbody';
  // mateixa escala per a totes les classes, centrades al viewBox
  const dx = MID - (X1 - SPECS[k].len / 2);
  return node('svg', { class: 'pa-sil pa-sil-' + k, viewBox: '0 0 250 84', 'aria-hidden': 'true', focusable: 'false',
    preserveAspectRatio: 'xMidYMid meet' }, [node('g', { transform: 'translate(' + dx + ' 0)' }, build(SPECS[k]))]);
}

export function padlock() {
  return node('svg', { class: 'pa-lock', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' }, [
    node('path', { d: 'M4.5 7V5a3.5 3.5 0 0 1 7 0v2', class: 'pa-lock-arc' }),
    node('rect', { x: 3, y: 7, width: 10, height: 7.5, rx: 1.2, class: 'pa-lock-body' })
  ]);
}
