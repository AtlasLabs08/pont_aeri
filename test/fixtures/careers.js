/* Partides i plans sintetics per a les proves del D3+D4 (career/orders.js,
 * app/dispatch.js). No es una prova: nomes dades.
 */

import { createCareer, graduate, LESSONS, buyAircraft } from '../../src/career/index.js';

/** Partida graduada amb un Mi-9 a LEBL. */
export function careerWithCommuter(seed = 7) {
  const s0 = createCareer({ name: 'Proves', seed, createdAt: '' });
  const s1 = graduate({ ...s0, school: { ...s0.school, lessonsPassed: LESSONS.map(l => l.id) } });
  const listing = { reg: 'EC-TST', typeId: 'commuter', tier: 'standard', yearBuilt: 2015, hours: 100, cycles: 80,
    condition: { engines: 90, gear: 90, airframe: 90, avionics: 90 }, maintenance: { nextAHours: 500, nextCHours: 6000 }, price: 300000 };
  return buyAircraft(s1, listing, 'cash').state;
}

export const plan = extra => ({
  reg: 'EC-TST', typeId: 'commuter', from: 'LEBL', to: 'LERS', departMinute: 600, ticketPrice: 250,
  pax: 15, fuelKg: 350, tripFuelKg: 160, plannedArrivalMin: 629, arrivalRunway: '25', alternate: null,
  weather: { origin: { severity: 0.1, hard: false, turbulence: 0.1 }, dest: { severity: 0.1, hard: false, turbulence: 0.1 } },
  contract: false, ...extra
});

/** FlightRecord sintetic d un Mi-9 LEBL -> LERS amb el pla de plan(): 31 min de bloc, 2 de retard. */
export const record = extra => ({
  aircraftTypeId: 'commuter', from: 'LEBL', to: 'LERS', blockSeconds: 31 * 60, airborneSeconds: 24 * 60,
  fuelBurntKg: 150, fuelPlannedKg: 160, paxOnBoard: 15, maxAltFt: 6000, maxG: 1.3, maxBankDeg: 25, abruptInputs: 0,
  timeAccelMax: 1, usedCruiseSkip: false, skippedCruiseFuelKg: 0, arrivalDeltaMin: 2,
  touchdown: { fpm: -180, g: 1.2, bounces: 0, onRunway: true, rwy: 'LERS 25', tdzDist: 20, center: 1, crab: 0.5,
    remaining: 1800, ias: 100, pitch: 3, roll: 0, score: 92, pts: { sink: 35, g: 15, zone: 20, center: 18, attitude: 10 } },
  rolloutMetres: 700, tailStrike: false, crashCause: null, events: [], landedAt: 'LERS', ...extra
});
