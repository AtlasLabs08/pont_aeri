/* Proves de thresholdDistNm i destinationEnd (world/ils.js): la distancia a
 * l aeroport que mostren totes les vistes es fins al capcal de la pista de
 * destinacio (docs/DECISIONS.md, 29/09/2026). Abans la cabina (PFD i HUD)
 * mostrava el DME, a l antena del localitzador, i la vista exterior la
 * distancia al llindar: uns 2 nm de diferencia a la 07L de LEBL.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRPORTS, ILS, setRunwayDifficulty, thresholdDistNm, destinationEnd } from '../src/world/index.js';
import { NM } from '../src/core/index.js';

setRunwayDifficulty('normal');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} != ${b}`);

/** posicio a dNm abans del llindar d en, sobre l eix, i un fdm minim per a ILS.nav */
function onFinal(A, en, dNm, latM = 0) {
  const d = dNm * NM, p = A.toWorld(en.thr[0] - en.dir[0] * d - en.dir[1] * latM, en.thr[1] - en.dir[1] * d + en.dir[0] * latM);
  return { e: p[0], n: p[1], h: 800, wow: false, out: { hdg: en.hdg }, cfg: { gear: { zStatic: 1 } } };
}

describe('thresholdDistNm', () => {
  test('al llindar: 0', () => {
    const A = AIRPORTS.LEBL, en = A.allEnds[0], p = A.toWorld(en.thr[0], en.thr[1]);
    near(thresholdDistNm(A, en, p[0], p[1]), 0, 1e-9);
  });

  test('a 8 nm en final, sobre l eix: 8 nm, igual que distThr de l ILS', () => {
    for (const id of ['LEBL', 'LEPA']) for (const en of AIRPORTS[id].allEnds) {
      const A = AIRPORTS[id], f = onFinal(A, en, 8);
      near(thresholdDistNm(A, en, f.e, f.n), 8, 1e-9, id + ' ' + en.id);
      near(thresholdDistNm(A, en, f.e, f.n), ILS.nav(A, en, f).distThr, 1e-9, id + ' ' + en.id);
    }
  });

  test('fora de l eix: linia recta fins al llindar', () => {
    const A = AIRPORTS.LEBL, en = A.allEnds[0], f = onFinal(A, en, 3, 1000);
    near(thresholdDistNm(A, en, f.e, f.n), Math.hypot(3 * NM, 1000) / NM, 1e-9);
  });

  test('el bug: el DME de la cabina anava uns 2 nm per davant, el centre de l aeroport gairebe 1 nm', () => {
    const A = AIRPORTS.LEBL, en = A.allEnds.find(x => x.id === '07L'), f = onFinal(A, en, 8), g = ILS.nav(A, en, f);
    near(g.dme - thresholdDistNm(A, en, f.e, f.n), (en.rw.len + ILS.LOC_BEYOND) / NM, 1e-9);
    assert.ok(g.dme - thresholdDistNm(A, en, f.e, f.n) > 1.9);
    assert.ok(Math.hypot(A.e - f.e, A.n - f.n) / NM - thresholdDistNm(A, en, f.e, f.n) > 0.8);
  });
});

describe('destinationEnd', () => {
  const A = AIRPORTS.LEBL, B = AIRPORTS.LEPA;

  test('el primer candidat que es d aquest aeroport: el sintonitzat abans que l assignat', () => {
    assert.equal(destinationEnd(A, A.allEnds[2], A.allEnds[0]), A.allEnds[2]);
    assert.equal(destinationEnd(A, null, A.allEnds[1]), A.allEnds[1]);
  });

  test('un cap de pista d un altre aeroport no compta', () => {
    assert.equal(destinationEnd(B, A.allEnds[0], B.allEnds[3]), B.allEnds[3]);
    assert.equal(destinationEnd(B, A.allEnds[0], A.allEnds[1]), B.allEnds[0]);
  });

  test('sense candidats: el primer cap de pista de l aeroport', () => {
    assert.equal(destinationEnd(B), B.allEnds[0]);
    assert.equal(destinationEnd(B, undefined, null), B.allEnds[0]);
  });
});
