/* Proves de world/airport-data.js, generat per tools/airports-ourairports.mjs
 * a partir d OurAirports (F1, docs/DECISIONS.md, 2026-10-01, H2). Cap peticio
 * de xarxa: es llegeix el fitxer comitejat.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRPORT_DATA, GATES_BY_LAYOUT, World, ll } from '../src/world/index.js';
import { BALANCE } from '../src/career/index.js';

const NEW = ['LEGE', 'LERS', 'LEIB', 'LEMH', 'LELL', 'LEDA', 'LESU'];
const G = World.G;
const inGrid = (lat, lon) => { const [e, n] = ll(lon, lat); return e > G.e0 && e < G.e0 + (G.nx - 1) * G.cell && n > G.n0 && n < G.n0 + (G.ny - 1) * G.cell; };

describe('airport-data.js: aeroports de les fases 1 i 2', () => {
  test('hi son els set, i cap mes', () => {
    assert.deepEqual(Object.keys(AIRPORT_DATA).sort(), [...NEW].sort());
  });

  for (const id of NEW) {
    const D = AIRPORT_DATA[id];
    test(`${id}: pistes, caps amb id i rumb, elevacio i coordenades dins de la graella`, () => {
      assert.equal(D.icao, id);
      assert.ok(D.name && D.city, 'nom i ciutat');
      assert.ok(Number.isFinite(D.elev) && D.elev >= 0 && D.elev < 3000, 'elevacio en m');
      assert.ok(inGrid(D.ref[0], D.ref[1]), 'punt de referencia dins de la graella');
      assert.ok(D.runways.length >= 1, 'com a minim una pista');
      for (const r of D.runways) {
        assert.equal(r.ids.length, 2);
        for (const s of r.ids) assert.match(s, /^(0[1-9]|[12][0-9]|3[0-6])[LRC]?$/, 'id de cap');
        assert.ok(r.hdg >= 0 && r.hdg < 360, 'rumb veritable');
        // el rumb i el numero del primer cap coincideixen a +-15 graus (declinacio i arrodoniment)
        const k = Number(r.ids[0].slice(0, 2)) * 10, diff = Math.abs(((r.hdg - k + 540) % 360) - 180);
        assert.ok(diff <= 15, `rumb ${r.hdg} vs ${r.ids[0]}`);
        assert.ok(r.len > 800 && r.len < 4500 && r.wid >= 15 && r.wid <= 80, 'llargada i amplada en m');
        assert.ok(inGrid(r.le[0], r.le[1]) && inGrid(r.he[0], r.he[1]), 'llindars dins de la graella');
      }
    });

    test(`${id}: mida de BALANCE.airportSize i portes per mida`, () => {
      assert.equal(D.size, BALANCE.airportSize[id]);
      assert.equal(D.gates, GATES_BY_LAYOUT[D.layout]);
      assert.ok(D.gates >= 1);
    });
  }

  test('portes per mida: petit 3, mitja 6, gran 10', () => {
    assert.deepEqual(GATES_BY_LAYOUT, { small: 3, medium: 6, large: 10 });
  });

  test('ILS (H3): LEGE 19 (el 20 d en Marc: OurAirports la numera 01/19), LERS 25, LEIB 24, LEMH 01, LEDA 31; LELL i LESU cap', () => {
    const ils = Object.fromEntries(NEW.map(id => [id, AIRPORT_DATA[id].ils]));
    assert.deepEqual(ils, { LEGE: ['19'], LERS: ['25'], LEIB: ['24'], LEMH: ['01'], LELL: [], LEDA: ['31'], LESU: [] });
    for (const id of NEW) for (const e of AIRPORT_DATA[id].ils) assert.ok(AIRPORT_DATA[id].runways.some(r => r.ids.includes(e)), `${id} ${e}`);
  });

  test('LESU i LELL: pistes curtes (1.267 m i 1.049 m)', () => {
    assert.equal(AIRPORT_DATA.LESU.runways[0].len, 1267);
    assert.equal(AIRPORT_DATA.LELL.runways[0].len, 1049);
  });
});
