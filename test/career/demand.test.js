/* Proves de career/demand.js (tasca B2): model de ruta, factors i
 * elasticitat. Cap valor esperat es calcula amb la mateixa formula: son
 * literals fets a ma, amb el calcul al comentari.
 *
 * Valors de BALANCE fets servir: pRef { base 90, perKm 0.6 }, dBase { scale 260,
 * distanceKm 3000 }, sizeWeight { hub 1, major 0.7, regional 0.35, small 0.15 },
 * elasticity { leisure 1.6, business 1.1 }, hourFactor { peak 1.15, off 0.7 },
 * hours peak [420,600) [1080,1260), off [0,360), weatherFactorMin 0.8,
 * reputation { base 0.6, span 0.8 }.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  routeKey, routeModel, routeFor, hourFactor, weatherFactor, demandPax, BALANCE
} from '../../src/career/index.js';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

describe('routeKey', () => {
  test('ordre alfabetic, sigui quin sigui l ordre d entrada', () => {
    assert.equal(routeKey('LEPA', 'LEBL'), 'LEBL-LEPA');
    assert.equal(routeKey('LEBL', 'LEPA'), 'LEBL-LEPA');
  });
});

describe('routeModel', () => {
  test('ruta inventada: 1500 km entre dos major', () => {
    // pRef = 90 + 0.6 * 1500 = 990
    // dBase = 260 * sqrt(0.7 * 0.7) * (1 + 1500 / 3000) = 260 * 0.7 * 1.5 = 273
    const m = routeModel({ distanceKm: 1500, sizeA: 'major', sizeB: 'major' });
    near(m.pRef, 990); near(m.dBase, 273); assert.equal(m.kind, 'leisure');
  });

  test('ruta inventada: 600 km entre hub i small', () => {
    // pRef = 90 + 0.6 * 600 = 450
    // dBase = 260 * sqrt(1 * 0.15) * 1.2 = 260 * 0.3872983 * 1.2 = 120.8371
    const m = routeModel({ distanceKm: 600, sizeA: 'hub', sizeB: 'small' });
    near(m.pRef, 450); near(m.dBase, 120.8371, 1e-4);
  });

  test('una excepcio que nomes porta kind substitueix nomes kind', () => {
    const m = routeModel({ distanceKm: 1500, sizeA: 'major', sizeB: 'major', exception: { kind: 'business' } });
    near(m.pRef, 990); near(m.dBase, 273); assert.equal(m.kind, 'business');
  });

  test('una excepcio que porta pRef substitueix nomes pRef', () => {
    const m = routeModel({ distanceKm: 1500, sizeA: 'major', sizeB: 'major', exception: { pRef: 150 } });
    assert.equal(m.pRef, 150); near(m.dBase, 273); assert.equal(m.kind, 'leisure');
  });

  test('excepcio real LEBL-LEMD (pont aeri): business', () => {
    // LEMD encara no es a world/: routeFor no la pot fer, es prova amb routeModel
    const m = routeModel({ distanceKm: 483, sizeA: 'hub', sizeB: 'hub', exception: BALANCE.routeExceptions['LEBL-LEMD'] });
    assert.equal(m.kind, 'business');
    // pRef = 90 + 0.6 * 483 = 379.8; dBase = 260 * 1 * (1 + 483 / 3000) = 301.86
    near(m.pRef, 379.8); near(m.dBase, 301.86);
  });

  test('mida desconeguda: error clar', () => {
    assert.throws(() => routeModel({ distanceKm: 100, sizeA: 'mega', sizeB: 'hub' }), /mida d aeroport desconeguda: mega/);
  });
});

describe('routeFor', () => {
  test('LEBL-LEPA: hub i major, ~202 km, leisure', () => {
    // distancia 201.966 km (test/geo.test.js)
    // pRef = 90 + 0.6 * 201.966 = 211.18
    // dBase = 260 * sqrt(1 * 0.7) * (1 + 201.966 / 3000) = 260 * 0.83666 * 1.067322 = 232.18
    const m = routeFor('LEBL', 'LEPA');
    near(m.pRef, 211.18, 1e-2); near(m.dBase, 232.18, 1e-2); assert.equal(m.kind, 'leisure');
  });

  test('es simetrica', () => {
    assert.deepEqual(routeFor('LEBL', 'LEPA'), routeFor('LEPA', 'LEBL'));
  });

  test('un ICAO que no es a world/ dona null', () => {
    assert.equal(routeFor('LEBL', 'ZZZZ'), null);
    assert.equal(routeFor('ZZZZ', 'LEPA'), null);
    assert.equal(routeFor('toString', 'LEBL'), null);
  });
});

describe('hourFactor', () => {
  test('punta del mati [420, 600)', () => {
    assert.equal(hourFactor(419), 1);
    assert.equal(hourFactor(420), 1.15);
    assert.equal(hourFactor(599), 1.15);
    assert.equal(hourFactor(600), 1);
  });

  test('punta del vespre [1080, 1260)', () => {
    assert.equal(hourFactor(1079), 1);
    assert.equal(hourFactor(1080), 1.15);
    assert.equal(hourFactor(1259), 1.15);
    assert.equal(hourFactor(1260), 1);
  });

  test('minuts fora de 0..1439: modul 1440, tambe negatius', () => {
    assert.equal(hourFactor(1440), 0.7);    // 1440 -> 0, matinada
    assert.equal(hourFactor(1860), 1.15);   // 1860 -> 420, punta del mati
    assert.equal(hourFactor(-60), 1);       // -60 -> 1380, fora de punta i de matinada
  });

  test('matinada [0, 360)', () => {
    assert.equal(hourFactor(0), 0.7);
    assert.equal(hourFactor(359), 0.7);
    assert.equal(hourFactor(360), 1);
  });
});

describe('weatherFactor', () => {
  test('de 1 a 0.8, lineal', () => {
    assert.equal(weatherFactor(0), 1);
    near(weatherFactor(0.5), 0.9);   // 1 - 0.2 * 0.5
    near(weatherFactor(1), 0.8);
  });

  test('es retalla a [0, 1]; no finit compta com 0', () => {
    near(weatherFactor(3), 0.8);
    assert.equal(weatherFactor(-1), 1);
    assert.equal(weatherFactor(NaN), 1);
    assert.equal(weatherFactor(undefined), 1);
  });
});

describe('demandPax', () => {
  const LEISURE = { pRef: 200, dBase: 150, kind: 'leisure' };
  const BUSINESS = { pRef: 200, dBase: 150, kind: 'business' };
  const NOON = 720;   // fora de punta i de matinada

  test('P = pRef, factors neutres: dBase', () => {
    // reputacio 50: 0.6 + 0.8 * 0.5 = 1
    assert.equal(demandPax({ route: LEISURE, price: 200, seats: 300, minuteOfDay: NOON, weatherSeverity: 0, reputation: 50 }), 150);
  });

  test('P = pRef: dBase * factors', () => {
    // 150 * 1.15 (punta) * 0.8 (meteo 1) * 1.4 (rep 100: 0.6 + 0.8) = 193.2 -> 193
    assert.equal(demandPax({ route: LEISURE, price: 200, seats: 300, minuteOfDay: 420, weatherSeverity: 1, reputation: 100 }), 193);
    // 150 * 0.7 (matinada) * 0.6 (rep 0) = 63
    assert.equal(demandPax({ route: LEISURE, price: 200, seats: 300, minuteOfDay: 0, weatherSeverity: 0, reputation: 0 }), 63);
  });

  test('doblar el preu en leisure divideix per 2^1.6', () => {
    // 150 / 2^1.6 = 150 / 3.031433 = 49.48 -> 49
    assert.equal(demandPax({ route: LEISURE, price: 400, seats: 300, minuteOfDay: NOON, reputation: 50 }), 49);
  });

  test('doblar el preu en business divideix per 2^1.1', () => {
    // 150 / 2^1.1 = 150 / 2.143547 = 69.98 -> 69
    assert.equal(demandPax({ route: BUSINESS, price: 400, seats: 300, minuteOfDay: NOON, reputation: 50 }), 69);
  });

  test('preu regalat: la demanda puja fins als seients', () => {
    // 150 * 2^1.6 = 454.7 -> tope de 180 seients
    assert.equal(demandPax({ route: LEISURE, price: 100, seats: 180, minuteOfDay: NOON, reputation: 50 }), 180);
  });

  test('limit de seients', () => {
    assert.equal(demandPax({ route: LEISURE, price: 200, seats: 100, minuteOfDay: NOON, reputation: 50 }), 100);
  });

  test('floor, no round', () => {
    // 100.9 * 1 -> 100
    assert.equal(demandPax({ route: { pRef: 200, dBase: 100.9, kind: 'leisure' }, price: 200, seats: 300, minuteOfDay: NOON, reputation: 50 }), 100);
  });

  test('sense meteo ni reputacio: severitat 0 i reputacio inicial (50)', () => {
    assert.equal(demandPax({ route: LEISURE, price: 200, seats: 300, minuteOfDay: NOON }), 150);
  });

  test('preu 0, negatiu o no finit: 0', () => {
    for (const price of [0, -10, NaN, Infinity, undefined]) {
      assert.equal(demandPax({ route: LEISURE, price, seats: 300, minuteOfDay: NOON, reputation: 50 }), 0, String(price));
    }
  });

  test('funciona amb el que retorna routeFor', () => {
    // LEBL-LEPA a P = pRef: dBase = 232.18 -> 232
    const route = routeFor('LEBL', 'LEPA');
    assert.equal(demandPax({ route, price: route.pRef, seats: 300, minuteOfDay: NOON, reputation: 50 }), 232);
  });

  test('errors: seients que falten i tipus de ruta desconegut', () => {
    assert.throws(() => demandPax({ route: LEISURE, price: 200 }), /seats/);
    assert.throws(() => demandPax({ route: { pRef: 1, dBase: 1, kind: 'cargo' }, price: 1, seats: 1 }), /cargo/);
  });
});
