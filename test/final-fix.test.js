/* Proves de finalFix (world/ils.js): punt d aproximacio final del ND (H14,
 * docs/DECISIONS.md, 2026-10-01). A 10 nm del llindar, sobre l eix allargat,
 * amb el nom FF + designacio, i la senda de 3 graus hi passa per sobre del
 * terreny a tots els caps dels aeroports nous (300 ft, el marge d H6), en
 * tota la conca del voltant del FF (terrain.corridor.basin): s hi pot girar
 * per enfilar la pista vingui d on vingui la ruta.
 *
 * Correr:  npm test
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { AIRPORTS, AIRPORT_ORDER, AIRPORT_DATA, World, ILS, setRunwayDifficulty, finalFix, FINAL_FIX_NM, thresholdDistNm } from '../src/world/index.js';
import { NM } from '../src/core/index.js';

const NEW = ['LEGE', 'LERS', 'LEIB', 'LEMH', 'LELL', 'LEDA', 'LESU'];
before(() => { setRunwayDifficulty('normal'); World.build(); });

describe('finalFix (H14)', () => {
  test('a 10 nm del llindar, sobre l eix allargat i abans del llindar, a tots els caps dels 9 aeroports', () => {
    assert.equal(FINAL_FIX_NM, 10);
    for (const id of AIRPORT_ORDER) for (const en of AIRPORTS[id].allEnds) {
      const A = AIRPORTS[id], F = finalFix(A, en), l = A.toLocal(F.e, F.n), dx = l[0] - en.thr[0], dy = l[1] - en.thr[1];
      assert.ok(Math.abs(thresholdDistNm(A, en, F.e, F.n) - 10) < 1e-9, `${id} ${en.id}: distancia`);
      assert.ok(Math.abs(-dx * en.dir[1] + dy * en.dir[0]) < 1e-6, `${id} ${en.id}: fora de l eix`);
      assert.ok(dx * en.dir[0] + dy * en.dir[1] < -10 * NM + 1e-6, `${id} ${en.id}: no es abans del llindar`);
      // el receptor hi veu el FF sobre l eix i la senda
      const g = ILS.geom(A, en, F.e, F.n, F.h);
      assert.ok(Math.abs(g.t) < 1e-6 && Math.abs(g.gsAng - ILS.GS) < 1e-9, `${id} ${en.id}: senda`);
    }
  });

  test('nom FF + designacio', () => {
    assert.equal(finalFix(AIRPORTS.LESU, AIRPORTS.LESU.allEnds[1]).name, 'FF21');
    assert.equal(finalFix(AIRPORTS.LERS, AIRPORTS.LERS.allEnds[1]).name, 'FF25');
    assert.equal(finalFix(AIRPORTS.LEBL, AIRPORTS.LEBL.allEnds[0]).name, 'FF07L');
  });

  for (const id of NEW) test(`${id}: la senda al FF passa 300 ft per sobre del terreny (al FF i a 500 m de cada costat)`, () => {
    const A = AIRPORTS[id];
    for (const en of A.allEnds) {
      const F = finalFix(A, en);
      for (const t of [-500, 0, 500]) {
        const w = A.toWorld(F.a - en.dir[1] * t, F.c + en.dir[0] * t), h = World.heightAt(w[0], w[1]);
        assert.ok(F.h - h >= 300 * 0.3048, `${id} ${en.id} (${t} m): senda ${F.h.toFixed(0)} m, terreny ${h.toFixed(0)} m`);
      }
    }
  });

  for (const id of NEW) test(`${id}: conca del FF: a menys del radi, el terreny queda 300 ft sota la senda al FF`, () => {
    const A = AIRPORTS[id], R = AIRPORT_DATA[id].terrain.corridor.basin;
    assert.ok(R >= 3000, 'radi de la conca');
    for (const en of A.allEnds) {
      const F = finalFix(A, en);
      for (let r = 0; r <= R; r += 500) for (let k = 0; k < 16; k++) {
        const w = A.toWorld(F.a + r * Math.cos(k * Math.PI / 8), F.c + r * Math.sin(k * Math.PI / 8)), h = World.heightAt(w[0], w[1]);
        assert.ok(F.h - h >= 300 * 0.3048, `${id} ${en.id} a ${r} m del FF: senda ${F.h.toFixed(0)} m, terreny ${h.toFixed(0)} m`);
      }
    }
  });
});
