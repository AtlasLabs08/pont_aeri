/* Proves de world/taxi.js: xarxa de calles de rodatge i cami mes curt, per a
 * la linia de la llico 3 (docs/DECISIONS.md, 29/09/2026). La xarxa surt de la
 * geometria de taxiways que ja hi ha a airports.js, sense redibuixar-la.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AIRPORTS, setRunwayDifficulty, airportPavedAt, makeAirport,
  buildTaxiGraph, taxiRoute, nearestOnPolyline } from '../src/world/index.js';

setRunwayDifficulty('normal');

const length = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/** trossos connexos del graf */
function components(G) {
  const seen = new Array(G.nodes.length).fill(-1); let n = 0;
  for (let s = 0; s < G.nodes.length; s++) {
    if (seen[s] >= 0) continue;
    const st = [s]; seen[s] = n;
    while (st.length) for (const { to } of G.adj[st.pop()]) if (seen[to] < 0) { seen[to] = n; st.push(to); }
    n++;
  }
  return n;
}

/** aeroport minim a (0,0), eix 90: nomes els trams de taxiway que es passen */
const toy = taxiways => makeAirport({ icao: 'TEST', lat: 41, lon: 2, elev: 0, axis: 90,
  bounds: [-5000, 5000, -5000, 5000], runways: [], taxiways, aprons: [] });

describe('buildTaxiGraph: LEBL tal com es', () => {
  const A = AIRPORTS.LEBL, G = buildTaxiGraph(A);

  test('tota la xarxa es un sol tros connectat', () => {
    assert.ok(G.nodes.length > 0);
    assert.equal(components(G), 1);
  });

  test('cada aresta va per paviment (mostrejada cada 5 m)', () => {
    G.adj.forEach((edges, i) => {
      for (const { to } of edges) {
        const a = G.nodes[i], b = G.nodes[to], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5);
        for (let k = 0; k <= n; k++) {
          const p = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n];
          assert.ok(airportPavedAt(A, p[0], p[1]), `fora del paviment: ${p}`);
        }
      }
    });
  });

  test('es calcula un sol cop per aeroport', () => {
    assert.equal(buildTaxiGraph(A), G);
  });
});

describe('taxiRoute: LEBL, de la porta de la llico 3 a cada capcal connectat', () => {
  const A = AIRPORTS.LEBL, gate = A.gates.find(g => g.size === 'M'), from = [gate.a, gate.c];

  for (const en of A.allEnds.filter(e => e.id !== '20')) {
    test(en.id + ': tot el cami va per paviment i acaba al llindar', () => {
      const r = taxiRoute(A, from, en.thr);
      assert.ok(r);
      assert.deepEqual(r[0], from);
      assert.deepEqual(r[r.length - 1], en.thr);
      for (let i = 0; i + 1 < r.length; i++) {
        const n = Math.ceil(Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]) / 5);
        for (let k = 0; k <= n; k++) {
          const p = [r[i][0] + (r[i + 1][0] - r[i][0]) * k / n, r[i][1] + (r[i + 1][1] - r[i][1]) * k / n];
          assert.ok(airportPavedAt(A, p[0], p[1]), `${en.id}: fora del paviment a ${p.map(Math.round)}`);
        }
      }
    });
  }

  test('07L: per la paral lela i l entrada del capcal, no en recta', () => {
    const en = A.allEnds[0], r = taxiRoute(A, from, en.thr);
    assert.equal(en.id, '07L');
    const straight = Math.hypot(en.thr[0] - from[0], en.thr[1] - from[1]);
    assert.ok(r.length > 2);
    assert.ok(length(r) > straight);
    // porta -> calle paral lela (c = 560) -> entrada a -1645 -> llindar
    assert.deepEqual(r.map(p => p.map(Math.round)), [
      [-470, 105], [-470, 560], [-900, 560], [-1050, 560], [-1645, 560], [-1645, 750], [-1675, 750]]);
  });
});

describe('taxiRoute: el cami mes curt', () => {
  test('entre dues rutes tria la curta', () => {
    // quadrat 0..1000 partit pel mig: dues rutes possibles
    const A = toy([
      { pts: [[0, 0], [1000, 0]] }, { pts: [[1000, 0], [1000, 1000]] },
      { pts: [[0, 0], [0, 1000]] }, { pts: [[0, 1000], [1000, 1000]] },
      { pts: [[0, 500], [1000, 500]] }
    ]);
    const r = taxiRoute(A, [0, 900], [1000, 550]);   // per dalt 1550 m, pel mig 1450 m
    assert.deepEqual(r.map(p => p.map(Math.round)), [[0, 900], [0, 500], [1000, 500], [1000, 550]]);
  });

  test('cruilla en T: l extrem sobre el paviment d un altre tram connecta', () => {
    const A = toy([{ pts: [[0, 0], [1000, 0]] }, { pts: [[500, 10], [500, 800]] }]);
    const G = buildTaxiGraph(A);
    assert.equal(components(G), 1);
    const r = taxiRoute(A, [0, 0], [500, 800]);
    assert.ok(Math.abs(length(r) - (500 + 800)) < 1, String(length(r)));
  });

  test('dos trams que es creuen connecten a la creu', () => {
    const A = toy([{ pts: [[0, 0], [1000, 0]] }, { pts: [[500, -500], [500, 500]] }]);
    const r = taxiRoute(A, [0, 0], [500, 500]);
    assert.deepEqual(r.map(p => p.map(Math.round)), [[0, 0], [500, 0], [500, 500]]);
  });

  test('trossos separats: null', () => {
    const A = toy([{ pts: [[0, 0], [1000, 0]] }, { pts: [[0, 500], [1000, 500]] }]);
    assert.equal(taxiRoute(A, [0, 0], [1000, 500]), null);
  });

  test('sense taxiways: null', () => {
    assert.equal(taxiRoute(toy([]), [0, 0], [10, 10]), null);
  });
});

describe('nearestOnPolyline', () => {
  const pts = [[0, 0], [100, 0], [100, 100]];
  test('punt, tram i distancia', () => {
    assert.deepEqual(nearestOnPolyline(pts, [50, 10]), { dist: 10, seg: 0, point: [50, 0] });
    assert.deepEqual(nearestOnPolyline(pts, [110, 60]), { dist: 10, seg: 1, point: [100, 60] });
  });
  test('fromSeg no mira enrere', () => {
    assert.equal(nearestOnPolyline(pts, [50, 10], 1).seg, 1);
  });
  test('sense trams: Infinity', () => {
    assert.equal(nearestOnPolyline([[0, 0]], [1, 1]).dist, Infinity);
  });
});
