/* Coherencia dels models 3D propis (F6: Mi-9 i X-90) amb les dades de l avio.
 * Contracte del #18: el model reposa sobre el tren (el contacte surt de gear.zStatic + staticDefl, no de la
 * geometria visual) i cap peca no travessa el terra.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AIRCRAFT } from '../src/core/aircraft-data.js';
import { modelGeom, groundClearances, legLength, legTopY } from '../src/core/model-geom.js';

for (const id of ['commuter', 'rj']) {
  const cfg = AIRCRAFT[id], G = modelGeom(cfg);

  test(`${id}: les mides principals surten de les dades de l avio`, () => {
    assert.ok(G, 'te geometria propia');
    // l estabilitzador, la deriva i les gondoles escalen amb envergadura, llargada i radi
    assert.ok(G.hSpan < cfg.geom.b * 0.5 && G.hSpan > cfg.geom.b * 0.2, 'estabilitzador proporcionat a l envergadura');
    assert.ok(G.finH < cfg.model.length * 0.25 && G.finH > cfg.model.length * 0.08, 'deriva proporcionada a la llargada');
    assert.ok(G.nacR < cfg.model.fuseR && G.nacR > cfg.model.fuseR * 0.3, 'gondola proporcionada al fuselatge');
    // si l avio creix, el dibuix creix amb ell
    const big = { ...cfg, geom: { ...cfg.geom, b: cfg.geom.b * 2 }, model: { ...cfg.model, length: cfg.model.length * 2, fuseR: cfg.model.fuseR * 2 } };
    const Gb = modelGeom(big);
    assert.ok(Math.abs(Gb.hSpan / G.hSpan - 2) < 1e-9 && Math.abs(Gb.finH / G.finH - 2) < 1e-9 && Math.abs(Gb.wheelR / G.wheelR - 2) < 1e-9);
  });

  test(`${id}: reposa sobre el tren (contracte del #18)`, () => {
    const c = groundClearances(cfg, G);
    assert.equal(c.gz, cfg.gear.zStatic + cfg.gear.staticDefl);
    // el fons de la roda (pivot - pota - radi) coincideix amb el terra, tant al morro com als principals
    for (const isNose of [true, false]) {
      const wr = isNose ? G.noseWheelR : G.wheelR, bottom = legTopY(cfg, G, isNose) - legLength(cfg, G, isNose) - wr;
      assert.ok(Math.abs(bottom + c.gz) < 1e-9, 'la roda toca el terra');
      assert.ok(legLength(cfg, G, isNose) > 0.2, 'pota amb longitud positiva');
    }
  });

  test(`${id}: cap peca no travessa el terra`, () => {
    const c = groundClearances(cfg, G);
    assert.ok(c.wingtip > 1.0, `punta d ala a ${c.wingtip.toFixed(2)} m`);
    assert.ok(c.nacelle > 0.5, `gondola a ${c.nacelle.toFixed(2)} m`);
    assert.ok(c.prop > 0.4, `helix a ${c.prop.toFixed(2)} m`);
  });
}
