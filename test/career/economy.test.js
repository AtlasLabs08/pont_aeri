/* Proves de career/economy.js (tasca B2): compte de resultats d un tram.
 * Cap valor esperat es calcula amb la mateixa formula: son literals fets a
 * ma, amb el calcul al comentari.
 *
 * Valors de BALANCE i d AIRCRAFT fets servir: K 2.6; fuelPricePerKg 0.90;
 * fees 12 EUR/t MTOW + 1.8 EUR/pax per aeroport; nb: narrowbody, MTOW 78.000 kg,
 * tripulacio 900 EUR/h, manteniment 700 EUR/h, rotation.cap 2.7, contracte
 * 18.000 EUR; wb: widebody, cap 1.8; rotation.perCrew 0.5; exclusivityBonus
 * 0.25; bonuses minScore 82, puntualitat 4 % dins de +-10 min, 35 % de
 * l estalvi a partir del 3 %; cruiseSkipFuelPenalty 0.08; LEPA sense dificultat.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { computeFlightResult } from '../../src/career/index.js';

const TOUCHDOWN = { fpm: 180, g: 1.2, bounces: 0, onRunway: true, rwy: '24', tdzDist: 400,
  center: 1.5, crab: 0.5, ias: 135, pitch: 3, roll: 0.5, score: 92,
  pts: { sink: 30, g: 20, zone: 20, center: 12, attitude: 10 } };

/** vol nb LEBL-LEPA de 45 min, 2400 kg cremats de 2600 previstos, 4 min tard */
function record(over = {}) {
  return { aircraftTypeId: 'nb', from: 'LEBL', to: 'LEPA', blockSeconds: 2700,
    airborneSeconds: 2100, fuelBurntKg: 2400, fuelPlannedKg: 2600, paxOnBoard: 150,
    maxAltFt: 24000, maxG: 1.3, maxBankDeg: 25, abruptInputs: 0, timeAccelMax: 4,
    usedCruiseSkip: false, skippedCruiseFuelKg: 0, arrivalDeltaMin: 4,
    touchdown: { ...TOUCHDOWN }, rolloutMetres: 1200, tailStrike: false, crashCause: null,
    events: [], ...over };
}

function own(recOver = {}, over = {}) {
  return computeFlightResult({ record: record(recOver), mode: 'own', ticketPrice: 210,
    paxOnBoard: 150, crewCount: 1, rankPayMult: 1, weatherBonus: 0.10, exclusive: true,
    financePerFlight: 1000, ...over });
}

const withScore = score => ({ touchdown: { ...TOUCHDOWN, score } });

/* Costos del vol de referencia, iguals a totes les proves que no toquen el combustible:
 *   combustible  2400 * 0.9                        = 2160
 *   taxes        2 * (12 * 78 + 1.8 * 150) = 2 * 1206 = 2412
 *   tripulacio   0.75 h * 900                       = 675
 *   manteniment  0.75 h * 700                       = 525
 *   financament                                    = 1000
 *   C                                              = 6772
 * r = min(1 + 0.5 * 1, 2.7) = 1.5;  K * r = 3.9
 * m_ruta = 1 + 0 (LEPA) + 0.10 (meteo) + 0.25 (exclusiva) = 1.35
 * P * pax * m_ruta = 210 * 150 * 1.35 = 42525 */
const COSTS = { fuel: 2160, fees: 2412, crew: 675, maintenance: 525, finance: 1000 };

describe('computeFlightResult: mode own', () => {
  test('vol nb LEBL-LEPA complet, calculat a ma', () => {
    // nota 92 -> excellent, m_aterratge 1.08, xp 30
    // bitllets     42525 * 1.08                   = 45927
    // puntualitat  |4| <= 10:  0.04 * 45927       = 1837.08
    // eficiencia   estalvi 200 kg = 7.7 % >= 3 %:  0.35 * 200 * 0.9 = 63
    // net = 3.9 * (45927 + 1837.08 + 63 - 6772) = 3.9 * 41055.08 = 160114.812 -> 160115
    assert.deepEqual(own(), {
      mode: 'own',
      landing: { key: 'landing.excellent', mult: 1.08, xp: 30 },
      revenue: { tickets: 45927, contract: 0, punctuality: 1837, fuelSaving: 63 },
      costs: COSTS,
      rotation: 1.5, K: 2.6, net: 160115
    });
  });

  test('la mateixa entrada amb nota 30 tanca en perdues', () => {
    // veryHard, m_aterratge 0.15: bitllets 42525 * 0.15 = 6378.75, sense bonus
    // net = 3.9 * (6378.75 - 6772) = 3.9 * -393.25 = -1533.675 -> -1534
    const r = own(withScore(30));
    assert.deepEqual(r.landing, { key: 'landing.veryHard', mult: 0.15, xp: -8 });
    assert.deepEqual(r.revenue, { tickets: 6379, contract: 0, punctuality: 0, fuelSaving: 0 });
    assert.deepEqual(r.costs, COSTS);
    assert.equal(r.net, -1534);
    assert.ok(r.net < 0);
  });

  test('per sota de 82 no hi ha bonus; a 82 si', () => {
    // 81.99 -> safe 0.85: bitllets 42525 * 0.85 = 36146.25; net = 3.9 * (36146.25 - 6772) = 114559.575 -> 114560
    const low = own(withScore(81.99));
    assert.deepEqual(low.revenue, { tickets: 36146, contract: 0, punctuality: 0, fuelSaving: 0 });
    assert.equal(low.net, 114560);
    // 82 -> solid 1.00: bitllets 42525; puntualitat 0.04 * 42525 = 1701; eficiencia 63
    // net = 3.9 * (42525 + 1701 + 63 - 6772) = 3.9 * 37517 = 146316.3 -> 146316
    const at = own(withScore(82));
    assert.deepEqual(at.revenue, { tickets: 42525, contract: 0, punctuality: 1701, fuelSaving: 63 });
    assert.equal(at.net, 146316);
  });

  test('puntualitat: nomes dins de la finestra de 10 min, tard o d hora', () => {
    assert.equal(own({ arrivalDeltaMin: -10 }).revenue.punctuality, 1837);
    assert.equal(own({ arrivalDeltaMin: 10 }).revenue.punctuality, 1837);
    assert.equal(own({ arrivalDeltaMin: 10.5 }).revenue.punctuality, 0);
    assert.equal(own({ arrivalDeltaMin: -11 }).revenue.punctuality, 0);
  });

  test('eficiencia: nomes a partir del 3 % d estalvi', () => {
    // 2600 * 0.97 = 2522 kg: estalvi 78 kg = 3 % -> 0.35 * 78 * 0.9 = 24.57 -> 25
    assert.equal(own({ fuelBurntKg: 2522 }).revenue.fuelSaving, 25);
    // 2530 kg: estalvi 70 kg = 2.7 % -> 0
    assert.equal(own({ fuelBurntKg: 2530 }).revenue.fuelSaving, 0);
    // mes combustible que el previst -> 0
    assert.equal(own({ fuelBurntKg: 2800 }).revenue.fuelSaving, 0);
  });

  test('combustible saltat: s hi suma el 8 %', () => {
    // usat = 1800 + 500 * 1.08 = 2340 kg -> 2340 * 0.9 = 2106
    // estalvi 260 kg = 10 % -> 0.35 * 260 * 0.9 = 81.9 -> 82
    const r = own({ fuelBurntKg: 1800, skippedCruiseFuelKg: 500, usedCruiseSkip: true });
    assert.equal(r.costs.fuel, 2106);
    assert.equal(r.revenue.fuelSaving, 82);
    // net = 3.9 * (45927 + 1837.08 + 81.9 - (2106 + 2412 + 675 + 525 + 1000))
    //     = 3.9 * (47845.98 - 6718) = 3.9 * 41127.98 = 160399.122 -> 160399
    assert.equal(r.net, 160399);
  });

  test('record sense skippedCruiseFuelKg: val 0', () => {
    // usat = 1800 kg -> 1620; estalvi 800 kg -> 0.35 * 800 * 0.9 = 252
    const rec = record({ fuelBurntKg: 1800 });
    delete rec.skippedCruiseFuelKg;
    const r = computeFlightResult({ record: rec, mode: 'own', ticketPrice: 210, paxOnBoard: 150,
      crewCount: 1, weatherBonus: 0.10, exclusive: true, financePerFlight: 1000 });
    assert.equal(r.costs.fuel, 1620);
    assert.equal(r.revenue.fuelSaving, 252);
  });

  test('rotacio: tope per classe', () => {
    // nb amb 5 tripulacions: 1 + 2.5 = 3.5 -> tope 2.7
    assert.equal(own({}, { crewCount: 5 }).rotation, 2.7);
    // nb sense tripulacions: 1
    assert.equal(own({}, { crewCount: 0 }).rotation, 1);
    // wb amb 2 tripulacions: 1 + 1 = 2 -> tope 1.8
    assert.equal(own({ aircraftTypeId: 'wb' }, { crewCount: 2 }).rotation, 1.8);
  });

  test('valors per defecte: sense tripulacio, meteo, exclusivitat ni financament', () => {
    // r = 1, m_ruta = 1: bitllets 210 * 150 * 1.08 = 34020; puntualitat 1360.8; eficiencia 63
    // C = 2160 + 2412 + 675 + 525 = 5772
    // net = 2.6 * (34020 + 1360.8 + 63 - 5772) = 2.6 * 29671.8 = 77146.68 -> 77147
    const r = computeFlightResult({ record: record(), mode: 'own', ticketPrice: 210, paxOnBoard: 150 });
    assert.equal(r.rotation, 1);
    assert.deepEqual(r.revenue, { tickets: 34020, contract: 0, punctuality: 1361, fuelSaving: 63 });
    assert.equal(r.costs.finance, 0);
    assert.equal(r.net, 77147);
  });

  test('dificultat de l aeroport de desti', () => {
    // LEMH +0.10: m_ruta = 1 + 0.10 = 1.10; bitllets 210 * 150 * 1.10 * 1.08 = 37422
    const r = computeFlightResult({ record: record({ to: 'LEMH' }), mode: 'own', ticketPrice: 210, paxOnBoard: 150 });
    assert.equal(r.revenue.tickets, 37422);
  });

  test('accident: ingressos 0, els costos es paguen i tram de nota 0', () => {
    // net = 3.9 * -6772 = -26410.8 -> -26411
    // nota 95 (flawless, +40 XP) pero accident: tram de nota 0, inspection, -35 XP
    const r = own({ crashCause: 'terrain', ...withScore(95) });
    assert.deepEqual(r.revenue, { tickets: 0, contract: 0, punctuality: 0, fuelSaving: 0 });
    assert.deepEqual(r.costs, COSTS);
    assert.equal(r.net, -26411);
    assert.equal(r.landing.key, 'landing.inspection');
    assert.equal(r.landing.xp, -35);
  });

  test('sense aterratge: ingressos 0, costos pagats i tram de nota 0', () => {
    const r = own({ touchdown: null });
    assert.equal(r.revenue.tickets, 0);
    assert.equal(r.net, -26411);
    assert.equal(r.landing.key, 'landing.inspection');
  });

  test('net sempre enter, i mai -0', () => {
    for (const score of [0, 17.3, 44.44, 71.7, 88.8, 99.99]) {
      for (const price of [1, 99.99, 212.37]) {
        const r = own({ ...withScore(score), blockSeconds: 3333.3, fuelBurntKg: 2222.2 }, { ticketPrice: price, paxOnBoard: 137 });
        assert.ok(Number.isInteger(r.net), `${score} ${price}: ${r.net}`);
        for (const v of [...Object.values(r.revenue), ...Object.values(r.costs)]) assert.ok(Number.isInteger(v));
      }
    }
    // financament que compensa exactament: net = 3.9 * (x - x) = 0
    const zero = own({ crashCause: 'water' }, { financePerFlight: -5772, crewCount: 0 });
    assert.ok(Object.is(zero.net, 0));
  });

  test('no modifica el record', () => {
    const rec = record(), before = JSON.stringify(rec);
    computeFlightResult({ record: rec, mode: 'own', ticketPrice: 210, paxOnBoard: 150 });
    assert.equal(JSON.stringify(rec), before);
  });
});

describe('computeFlightResult: mode contract', () => {
  test('pagament = tarifa * rang * m_aterratge, sense costos', () => {
    // 18000 * 1.55 * 1.08 = 30132
    const r = computeFlightResult({ record: record(), mode: 'contract', rankPayMult: 1.55 });
    assert.deepEqual(r, {
      mode: 'contract',
      landing: { key: 'landing.excellent', mult: 1.08, xp: 30 },
      revenue: { tickets: 0, contract: 30132, punctuality: 0, fuelSaving: 0 },
      costs: { fuel: 0, fees: 0, crew: 0, maintenance: 0, finance: 0 },
      rotation: 1, K: 1, net: 30132
    });
  });

  test('turbohelix, rang d estudiant per defecte', () => {
    // 6000 * 1.00 * 0.85 (nota 75) = 5100
    const r = computeFlightResult({ record: record({ aircraftTypeId: 'tp', ...withScore(75) }), mode: 'contract' });
    assert.equal(r.net, 5100);
  });

  test('amb accident o sense aterratge: 0', () => {
    assert.equal(computeFlightResult({ record: record({ crashCause: 'hardImpact' }), mode: 'contract', rankPayMult: 2.2 }).net, 0);
    assert.equal(computeFlightResult({ record: record({ touchdown: null }), mode: 'contract', rankPayMult: 2.2 }).net, 0);
  });
});

describe('computeFlightResult: errors', () => {
  test('avio que no es a fleetTypes', () => {
    assert.throws(() => computeFlightResult({ record: record({ aircraftTypeId: 'x99' }), mode: 'own', ticketPrice: 1 }),
      /aircraftTypeId desconegut a BALANCE\.fleetTypes: x99/);
    assert.throws(() => computeFlightResult({ record: record({ aircraftTypeId: 'toString' }), mode: 'contract' }),
      /fleetTypes/);
  });

  test('mode desconegut', () => {
    assert.throws(() => computeFlightResult({ record: record(), mode: 'charter' }), /mode desconegut: charter/);
  });

  test('mode own sense preu', () => {
    assert.throws(() => computeFlightResult({ record: record(), mode: 'own' }), /ticketPrice/);
  });
});
