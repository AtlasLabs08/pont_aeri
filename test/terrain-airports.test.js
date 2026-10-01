/* Proves del terreny dels aeroports (F1, docs/DECISIONS.md, 2026-10-01, H6).
 *
 * - Senda: per a cada cap de pista dels aeroports nous, des del llindar fins a
 *   10 km i a 0 i +-150 m de l eix, el terreny es com a molt 300 ft per sota de
 *   la senda de 3 graus (ILS.GS, ILS.GS_S). Com que a menys d 1,3 km la senda
 *   es a menys de 300 ft sobre la pista, alla el terreny no pot passar de
 *   l elevacio de l aeroport.
 * - Inici en final de Free Flight (10 nm): fins a 10 nm + 500 m, el mateix
 *   marge de 300 ft sota la senda.
 * - Pendent: graella de 50 m fins a 12 km i de 200 m fins a 32 km de cada
 *   aeroport nou, sobre terra ferma (el fons del mar no compta). Una parella de punts veins on el terreny
 *   es el modificat per l aeroport (difereix del relleu natural, heightRaw) als
 *   dos punts es la transicio: com a molt un 25 %. A la vora (un punt
 *   modificat i l altre natural), la transicio no pot ser mes abrupta que el
 *   relleu natural de la mateixa parella.
 * - LEBL i LEPA: alcades identiques a test/fixtures/terrain-lebl-lepa.json,
 *   preses del codi de dev (90f61db) abans de F1+F2. No es regenera.
 *
 * Correr:  npm test
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { World, AIRPORTS, ILS, setRunwayDifficulty } from '../src/world/index.js';
import { NM } from '../src/core/index.js';

const NEW = ['LEGE', 'LERS', 'LEIB', 'LEMH', 'LELL', 'LEDA', 'LESU'];
const FT300 = 300 * 0.3048, MAX_SLOPE = 0.25;

before(() => { setRunwayDifficulty('normal'); World.build(); });

/** comprova la senda de cada cap de l aeroport id des del llindar fins a sMax m */
function checkPath(id, sMax) {
    const A = AIRPORTS[id], E = A.elev, tg = Math.tan(ILS.GS);
    for (const en of A.allEnds) for (let s = 0; s <= sMax; s += 25) for (const t of [-150, 0, 150]) {
      const w = A.toWorld(en.thr[0] - en.dir[0] * s - en.dir[1] * t, en.thr[1] - en.dir[1] * s + en.dir[0] * t);
      const h = World.heightAt(w[0], w[1]), path = E + (s + ILS.GS_S) * tg;
      assert.ok(h <= Math.max(E, path - FT300) + 1e-6, `${id} ${en.id} a ${s} m (${t} m de l eix): terreny ${h.toFixed(1)} m, senda ${path.toFixed(1)} m`);
    }
}

describe('H6: la senda de 3 graus passa 300 ft per sobre del terreny fins a 10 km', () => {
  for (const id of NEW) test(id, () => checkPath(id, 10000));
});

describe('inici en final de Free Flight: el mateix marge fins a 10 nm', () => {
  for (const id of NEW) test(id, () => checkPath(id, 10 * NM + 500));
});

describe('H6: pendent de la transicio de l aeroport al relleu', () => {
  for (const id of NEW) test(`${id}: com a molt un 25 %`, () => {
    const A = AIRPORTS[id];
    const H = (e, n) => { const sd = World.sd(e, n); return sd <= 0 ? null : [World.heightProc(e, n), World.heightRaw(e, n, sd)]; };
    let inside = 0;
    for (const [st, R] of [[50, 12000], [200, 32000]]) for (let j = -R; j <= R; j += st) {
      let prev = null;
      for (let i = -R; i <= R; i += st) {
        const p = H(A.e + i, A.n + j), up = H(A.e + i, A.n + j + st);
        for (const q of [prev, up]) {
          if (!p || !q) continue;
          const mp = Math.abs(p[0] - p[1]) > 0.01, mq = Math.abs(q[0] - q[1]) > 0.01;
          if (!mp && !mq) continue;
          const dh = Math.abs(p[0] - q[0]);
          if (mp && mq) { inside++; assert.ok(dh / st <= MAX_SLOPE, `${id} a ${i},${j}: ${(dh / st * 100).toFixed(1)} %`); }
          else assert.ok(dh / st <= MAX_SLOPE || dh <= Math.abs(p[1] - q[1]) + 1e-6, `${id} a ${i},${j}: vora mes abrupta que el relleu natural`);
        }
        prev = p;
      }
    }
    assert.ok(inside > 100, `${id}: l aeroport hauria de modificar el relleu`);
  });
});

describe('H6: LEBL i LEPA, el mateix terreny que abans', () => {
  test('alcada identica a les mostres de test/fixtures/terrain-lebl-lepa.json', () => {
    const F = JSON.parse(readFileSync(new URL('./fixtures/terrain-lebl-lepa.json', import.meta.url), 'utf8'));
    for (const id of ['LEBL', 'LEPA']) {
      const P = F.airports[id], A = AIRPORTS[id], half = F.half / F.step;
      assert.equal(P.e, A.e); assert.equal(P.n, A.n);
      let k = 0;
      for (let j = -half; j <= half; j++) for (let i = -half; i <= half; i++) {
        const e = P.e + i * F.step, n = P.n + j * F.step;
        assert.equal(World.heightAt(e, n), P.h[k++], `${id} a ${i * F.step},${j * F.step}`);
      }
      assert.equal(k, P.h.length);
    }
  });
});

describe('aeroports nous: el terreny i la ciutat', () => {
  test('dins del rectangle, a l elevacio de l aeroport i sense ciutat (LELL es a Sabadell)', () => {
    for (const id of NEW) {
      const A = AIRPORTS[id], b = A.bounds;
      for (const [a, c] of [[0, 0], [b[0] + 1, b[2] + 1], [b[1] - 1, b[3] - 1], ...A.gates.map(g => [g.a, g.c])]) {
        const w = A.toWorld(a, c);
        assert.equal(World.heightAt(w[0], w[1]), A.elev, `${id} a ${a},${c}`);
        assert.equal(World.urbanAt(w[0], w[1], A.elev), 0, `${id}: ciutat dins de l aeroport`);
      }
    }
  });
});
