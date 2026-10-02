/* Proves del terreny real (fase A, docs/DECISIONS.md, 2026-10-02, TA-1 a
 * TA-9). Proves de propietats, sense fixture d alcades:
 *
 * - El fitxer (public/terrain/terrain-250.bin) es descodifica amb
 *   DecompressionStream, igual al navegador i a Node, i quadra amb World.G.
 * - Aeroports (TA-4): pistes, taxiways i plataformes planes a A.elev a tots
 *   els aeroports i a les tres dificultats; a la transicio de 700 m, el
 *   terreny sempre queda entre l elevacio de l aeroport i el relleu real (res
 *   de valls ni excavacions).
 * - Mar i terra on toca, tambe als deltes del Llobregat i de l Ebre.
 * - Cims coneguts: la graella de 250 m es la mitjana de la cel.la, que retalla
 *   els cims esmolats. Marges: Montserrat (agulles) 1.236 m -150/+30;
 *   Puigmal 2.913 m i Turo de l Home 1.706 m, -80/+30. El maxim es busca a
 *   1,5 km del cim.
 * - Zones URBAN (TA-5): rebaixa com a molt URBAN_SMOOTH.maxCutM; Montjuic
 *   continua sent un turo.
 * - Normals (TA-6): slopeAt es continu a traves de les cel.les.
 * - Photo (TA-7): on el seu pes es 1, mana la seva alcada.
 * - Aproximacions (TA-9): glidePathMargin fins a 10 km i fins a 10 nm + 500 m
 *   a tots els caps amb aproximacio directa; els que en son sense, no la
 *   compleixen (la llista d APPROACH_DATA no queda vella).
 *
 * Correr:  npm test
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { World, AIRPORTS, AIRPORT_ORDER, APPROACH_DATA, URBAN_SMOOTH, TERRAIN_FILE, decodeTerrain, packTerrain, unpackTerrain,
  glidePathMargin, setRunwayDifficulty, setPhoto, airportPavedAt, ll } from '../src/world/index.js';
import { NM, SURF } from '../src/core/index.js';
import { loadWorld } from './helpers/terrain.js';

const FILE = new URL('../public/' + TERRAIN_FILE, import.meta.url);
before(async () => { setRunwayDifficulty('normal'); await loadWorld(); });
after(() => setRunwayDifficulty('normal'));

describe('TA-1: el fitxer de dades', () => {
  test('es descodifica igual d un Uint8Array i d un ArrayBuffer (fetch al navegador) i quadra amb World.G', async () => {
    const buf = readFileSync(FILE), u8 = new Uint8Array(buf), ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    const a = await decodeTerrain(u8), b = await decodeTerrain(ab), G = World.G;
    for (const k of ['nx', 'ny', 'cell', 'e0', 'n0']) { assert.equal(a[k], G[k], k); assert.equal(b[k], G[k], k); }
    assert.deepEqual(a.h, b.h); assert.deepEqual(a.sd, b.sd);
    assert.ok(buf.length < 4 * 1048576, `${(buf.length / 1048576).toFixed(2)} MB`);
  });
  test('pack i unpack son inversos (Int16 amb signe, diferencies per fila)', () => {
    const nx = 5, ny = 3, h = Int16Array.from([0, 1, -1, 32767, -32768, 7, 7, 7, 0, 3000, -400, 12, 13, 14, 15]), sd = h.map(v => -v);
    const { header, body } = packTerrain({ nx, ny, cell: 250, e0: -10, n0: 20, hScale: 1, sdScale: 2, h, sd: Int16Array.from(sd) });
    const T = unpackTerrain(header, body);
    assert.deepEqual([T.nx, T.ny, T.cell, T.e0, T.n0], [nx, ny, 250, -10, 20]);
    assert.deepEqual(Array.from(T.h), Array.from(h)); assert.deepEqual(Array.from(T.sd), Array.from(sd, v => v * 2));
  });
  test('sense dades no hi ha mon: build sense fitxer llenca', () => {
    assert.throws(() => World.build(null));
    assert.throws(() => World.build({ nx: 10, ny: 10, cell: 250, e0: 0, n0: 0, h: new Float32Array(100), sd: new Float32Array(100) }));
  });
});

describe('TA-4: aeroports plans a A.elev, transicio suau i sense excavacions', () => {
  for (const level of ['easy', 'normal', 'hard']) test(`pistes, taxiways i plataformes a A.elev (${level})`, () => {
    setRunwayDifficulty(level);
    try { for (const id of AIRPORT_ORDER) {
      const A = AIRPORTS[id];
      for (const s of A.paved) for (let t = 1; t < s.L; t += 25) for (const k of [-1, 0, 1]) {
        const a = s.a1 + s.ux * t - s.uy * k * s.hw * 0.95, c = s.c1 + s.uy * t + s.ux * k * s.hw * 0.95, w = A.toWorld(a, c);
        assert.equal(World.heightAt(w[0], w[1]), A.elev, `${id} ${s.kind} a ${a.toFixed(0)},${c.toFixed(0)}`);
        assert.equal(World.surfaceAt(w[0], w[1]), airportPavedAt(A, a, c) ? SURF.PAVED : SURF.GRASS, `${id} ${s.kind} superficie a ${a.toFixed(0)},${c.toFixed(0)}`);
      }
      for (const g of A.gates) { const w = A.toWorld(g.a, g.c); assert.equal(World.heightAt(w[0], w[1]), A.elev, `${id} porta`); assert.equal(World.urbanAt(w[0], w[1], A.elev), 0, `${id}: ciutat a la porta`); }
    } } finally { setRunwayDifficulty('normal'); }
  });
  test('a la transicio de 700 m, entre l elevacio i el relleu real, i continua', () => {
    for (const id of AIRPORT_ORDER) {
      const A = AIRPORTS[id], b = A.bounds;
      for (const [a0, c0, da, dc] of [[b[1], 0, 1, 0], [b[0], 0, -1, 0], [(b[0] + b[1]) / 2, b[3], 0, 1], [(b[0] + b[1]) / 2, b[2], 0, -1]]) {
        let prev = A.elev;
        for (let d = 0; d <= 800; d += 10) {
          const w = A.toWorld(a0 + da * d, c0 + dc * d); if (World.sd(w[0], w[1]) <= 0) break;
          const h = World.heightAt(w[0], w[1]), dem = Math.max(World.demAt(w[0], w[1]), 0.6);
          assert.ok(h >= Math.min(A.elev, dem) - 1e-6 && h <= Math.max(A.elev, dem) + 1e-6, `${id} a ${d} m: ${h.toFixed(1)} fora de [${A.elev}, ${dem.toFixed(1)}]`);
          assert.ok(Math.abs(h - prev) <= 4, `${id} a ${d} m: salt de ${(h - prev).toFixed(1)} m en 10 m`);
          prev = h;
        }
      }
    }
  });
});

describe('TA-2: mar i terra on toca', () => {
  const SEA = [[2.30, 41.25, 'davant de Barcelona'], [2.00, 40.50, 'mar obert'], [2.62, 39.50, 'badia de Palma'], [3.70, 39.95, 'canal de Menorca'],
    [0.95, 40.85, 'davant del delta de l Ebre'], [0.85, 40.62, 'port dels Alfacs'], [2.12, 41.29, 'davant del Prat'], [1.15, 39.05, 'davant d Eivissa']];
  const LAND = [[1.83, 41.60, 'Montserrat'], [0.62, 41.62, 'Lleida'], [2.90, 39.62, 'pla de Mallorca'], [4.10, 39.97, 'Menorca'], [1.43, 39.00, 'Eivissa'],
    [0.75, 40.72, 'delta de l Ebre'], [2.06, 41.31, 'delta del Llobregat'], [2.17, 41.39, 'Barcelona'], [2.80, 41.98, 'Girona']];
  test('mar: distancia negativa, sota el nivell del mar i aigua per a la fisica', () => {
    for (const [lon, lat, name] of SEA) { const p = ll(lon, lat);
      assert.ok(World.sd(p[0], p[1]) < 0, name); assert.ok(World.heightAt(p[0], p[1]) < 0, name); assert.equal(World.surfaceAt(p[0], p[1]), SURF.WATER, name); }
  });
  test('terra: distancia positiva i per sobre del nivell del mar', () => {
    for (const [lon, lat, name] of LAND) { const p = ll(lon, lat);
      assert.ok(World.sd(p[0], p[1]) > 0, name); assert.ok(World.heightAt(p[0], p[1]) > 0, name); assert.notEqual(World.surfaceAt(p[0], p[1]), SURF.WATER, name); }
  });
});

describe('TA-1: cims coneguts dins del marge de la resolucio de 250 m', () => {
  const top = (lon, lat) => { const c = ll(lon, lat); let m = -Infinity; for (let x = -1500; x <= 1500; x += 25) for (let y = -1500; y <= 1500; y += 25) m = Math.max(m, World.heightAt(c[0] + x, c[1] + y)); return m; };
  for (const [name, lon, lat, real, below] of [['Montserrat (Sant Jeroni)', 1.8106, 41.6033, 1236, 150], ['Puigmal', 2.1167, 42.3833, 2913, 80], ['Montseny (Turo de l Home)', 2.4347, 41.7744, 1706, 80]]) {
    test(`${name}: ${real} m`, () => { const h = top(lon, lat); assert.ok(h >= real - below && h <= real + 30, `${name}: ${h.toFixed(0)} m`); });
  }
});

describe('TA-5: zones URBAN', () => {
  test('nomes rebaixa, com a molt maxCutM, i Montjuic continua sent un turo', async () => {
    const G = World.G, raw = (await decodeTerrain(readFileSync(FILE))).h;
    let n = 0;
    for (let k = 0; k < raw.length; k++) { const d = raw[k] - G.h[k]; assert.ok(d >= 0 && d <= URBAN_SMOOTH.maxCutM + 1e-3, `cel.la ${k}: ${d}`); if (d > 0) n++; }
    assert.ok(n > 1000, `cel.les suavitzades: ${n}`);
    const c = ll(2.1586, 41.3639); let m = 0; for (let x = -800; x <= 800; x += 25) for (let y = -800; y <= 800; y += 25) m = Math.max(m, World.heightAt(c[0] + x, c[1] + y));
    assert.ok(m > 120, `Montjuic: ${m.toFixed(0)} m`);
  });
});

describe('TA-6: normals sense facetes', () => {
  test('slopeAt canvia poc a poc a traves de les cel.les (la derivada bilineal salta)', () => {
    const c = ll(1.85, 41.58);          // vessant de Montserrat
    let maxJump = 0, rawJump = 0, prev = null, prevRaw = null;
    for (let x = 0; x <= 1500; x += 5) {
      const e = c[0] + x, s = World.slopeAt(e, c[1]), r = (World.heightAt(e + 1, c[1]) - World.heightAt(e - 1, c[1])) / 2;
      if (prev) { maxJump = Math.max(maxJump, Math.abs(s[0] - prev[0]), Math.abs(s[1] - prev[1])); rawJump = Math.max(rawJump, Math.abs(r - prevRaw)); }
      prev = s; prevRaw = r;
    }
    assert.ok(maxJump < 0.03, `salt maxim del pendent en 5 m: ${maxJump.toFixed(3)}`);
    assert.ok(rawJump > 3 * maxJump, `la derivada bilineal hauria de saltar mes (${rawJump.toFixed(3)})`);
  });
});

describe('TA-7: Photo mana on hi ha el seu DEM', () => {
  test('pes 1: la seva alcada; pes 0: el terreny real; entremig, la barreja', () => {
    const p = ll(2.0, 41.4), real = World.heightAt(p[0], p[1]);
    try {
      setPhoto({ on: true, weight: e => e < p[0] ? 1 : e > p[0] + 1000 ? 0 : 0.5, height: () => 123.4, isWater: () => false });
      assert.equal(World.heightAt(p[0] - 10, p[1]), 123.4);
      assert.equal(World.heightAt(p[0] + 2000, p[1]), World.heightDem(p[0] + 2000, p[1]));
      assert.ok(Math.abs(World.heightAt(p[0] + 500, p[1]) - (World.heightDem(p[0] + 500, p[1]) + 123.4) / 2) < 1e-9);
    } finally { setPhoto({ on: false }); }
    assert.equal(World.heightAt(p[0], p[1]), real);
  });
});

describe('TA-9: aproximacions sobre el terreny real', () => {
  for (const id of AIRPORT_ORDER) test(`${id}: senda amb 300 ft de marge fins a 10 km i fins a 10 nm a tots els caps amb aproximacio directa`, () => {
    for (const en of AIRPORTS[id].allEnds.filter(x => x.direct)) for (const sMax of [10000, 10 * NM + 500]) {
      const r = glidePathMargin(AIRPORTS[id], en, sMax);
      assert.ok(r.marginM >= 0, `${id} ${en.id} fins a ${sMax} m: ${r.marginM.toFixed(1)} m a ${r.s} m`);
    }
  });
  test('els caps sense aproximacio directa (APPROACH_DATA) no la compleixen, i cap aeroport no es queda sense cap', () => {
    for (const id of Object.keys(APPROACH_DATA)) {
      const A = AIRPORTS[id];
      for (const endId of APPROACH_DATA[id].noDirect || []) {
        const en = A.allEnds.find(x => x.id === endId); assert.ok(en, `${id} ${endId}`); assert.equal(en.direct, false);
        assert.ok(glidePathMargin(A, en, 10 * NM + 500).marginM < 0, `${id} ${endId} ja compleix la senda: treu-lo d APPROACH_DATA`);
      }
      assert.ok(A.allEnds.some(x => x.direct), `${id} sense cap cap utilitzable`);
    }
  });
});
