/* Totes les constants economiques del mode Airline, en un sol objecte.
 * NOU: tasca B1 d ENGINEERING.md (seccio 6). Congelat en profunditat: cap
 * codi no el pot modificar mentre el joc corre.
 *
 * EXPORTA: BALANCE
 *
 * INTERFICIE (no la canviis, state.js i els tests en depenen):
 *   BALANCE.version   es queda a 1 fins que el mode Airline arribi a main;
 *                     a partir d aleshores, cada canvi de valor la puja i
 *                     porta la seva migracio a state.js, que ho detecta amb
 *                     needsBalanceUpdate() (seccio 6 d ENGINEERING.md i
 *                     docs/DECISIONS.md, 26/09/2026)
 *   BALANCE.reputation.start   reputacio de la companyia en crear la partida
 *   La resta de claus, tal com les descriu la seccio 6.
 */

/** Congela obj i tots els objectes i llistes de dins. Retorna obj. */
function deepFreeze(obj) {
  for (const v of Object.values(obj)) {
    if (v !== null && typeof v === 'object') deepFreeze(v);
  }
  return Object.freeze(obj);
}

export const BALANCE = deepFreeze({
  version: 1,
  K: 2.6,                                   // factor global: l unica palanca de ritme

  startingCash: 400000,
  startingLoan: { principal: 250000, ratePerFlight: 0.004 },
  reputation: { start: 50 },                // els limits 0..100 son de l esquema (state.js)

  fuelPricePerKg: 0.90,
  fees: { perTonneMTOW: 12, perPax: 1.8, airportsPerLeg: 2 },   // es paga a l origen i al desti
  crewRatePerBlockHour: { commuter: 250, turboprop: 450, narrowbody: 900, widebody: 1800 },
  maintAccrualPerHour:  { commuter: 180, turboprop: 300, narrowbody: 700, widebody: 1600 },

  fleetTypes: {                             // clau = aircraftTypeId del FlightRecord
    tp:    { cls: 'turboprop',  seats: 70  },
    nb:    { cls: 'narrowbody', seats: 180 },
    wb:    { cls: 'widebody',   seats: 300 },
    jumbo: { cls: 'widebody',   seats: 400 }
  },
  contractFeePerLeg: { commuter: 3000, turboprop: 6000, narrowbody: 18000, widebody: 40000 },

  landingBands: [                           // de dalt a baix; guanya el primer amb score >= min
    { min: 99, mult: 1.35, xp: 55,  key: 'landing.textbook' },
    { min: 95, mult: 1.20, xp: 40,  key: 'landing.flawless' },
    { min: 90, mult: 1.08, xp: 30,  key: 'landing.excellent' },
    { min: 82, mult: 1.00, xp: 20,  key: 'landing.solid' },
    { min: 72, mult: 0.85, xp: 12,  key: 'landing.safe' },
    { min: 60, mult: 0.60, xp: 4,   key: 'landing.firm' },
    { min: 45, mult: 0.35, xp: 0,   key: 'landing.rough' },
    { min: 30, mult: 0.15, xp: -8,  key: 'landing.veryHard' },
    { min: 15, mult: 0.00, xp: -20, key: 'landing.incident' },
    { min: 0,  mult: 0.00, xp: -35, key: 'landing.inspection' }
  ],

  bonuses: { minScore: 82, punctualityPct: 0.04, punctualityWindowMin: 10,
             fuelSavingShare: 0.35, fuelSavingThreshold: 0.03 },

  damage: [                                 // pctOfValue sobre Airframe.value
    { id: 'hardLanding',   fpm: 600, g: 2.2, pctOfValue: 0.0015, groundedDays: 1 },
    { id: 'veryHard',      fpm: 800, g: 2.6, pctOfValue: 0.012,  groundedDays: 3 },
    { id: 'tailStrike',                       pctOfValue: 0.025,  groundedDays: 5 },
    { id: 'offRunway',                        pctOfValue: 0.005,  groundedDays: 1 },
    { id: 'excursion',                        pctOfValue: 0.03,   groundedDays: 7 }
  ],
  // Sense perdua total: BACKLOG.md la descarta. Un accident es car i llarg, mai definitiu.
  crash: { minPct: 0.15, maxPct: 0.60, groundedDays: [14, 45], xpLoss: [200, 1500] },

  // B3 (wear.js): valors provisionals, es calibren a B5
  operations: { dayHours: { commuter: 8, turboprop: 9, narrowbody: 11, widebody: 14 },
                minLegHours: { commuter: 0.5, turboprop: 0.6, narrowbody: 0.75, widebody: 1.5 } },
  wear: {                                   // punts de condicio (0..100) que es perden
    enginesPerHour: 0.0075, avionicsPerHour: 0.05,
    airframePerCycle: 0.005, gearPerCycle: 0.02,
    gearFreeFpm: 300, gearPerExtraFpm: 0.01,  // desgast extra de l aterratge del jugador
    gearFreeG: 1.6, gearPerExtraG: 5
  },
  maintCostPerCycle: { commuter: 40, turboprop: 60, narrowbody: 120, widebody: 300 },
  checks: {
    A:      { intervalHours: 500,  pctOfValue: 0.008, groundedDays: 1,
              restore: { avionics: 100 }, boost: { gear: 20 } },
    C:      { intervalHours: 6000, pctOfValue: 0.04,  groundedDays: 10,
              restore: { airframe: 100, gear: 100, avionics: 100 } },
    engine: {                     pctOfValue: 0.03,  groundedDays: 5,
              restore: { engines: 100 } }
  },
  failure: { threshold: 70, pAtThreshold: 0.002, refCondition: 20, pAtRef: 0.08 },

  insurance: { premiumPctPerFlight: 0.0012, excessOptions: [0.05, 0.10, 0.25] },

  ranks: [
    { key: 'student',    xp: 0,     payMult: 1.00, slots: 0, dispatchPct: 0    },
    { key: 'private',    xp: 500,   payMult: 1.25, slots: 2, dispatchPct: 0.20 },
    { key: 'commercial', xp: 2000,  payMult: 1.55, slots: 3, dispatchPct: 0.30 },
    { key: 'atpl',       xp: 6000,  payMult: 1.85, slots: 5, dispatchPct: 0.40 },
    { key: 'captain',    xp: 15000, payMult: 2.20, slots: 7, dispatchPct: 0.50 },
    { key: 'instructor', xp: 35000, payMult: 2.50, slots: 9, dispatchPct: 0.60 }
  ],

  rotation: { perCrew: 0.5, cap: { commuter: 2.6, turboprop: 2.6, narrowbody: 2.7, widebody: 1.8 } },

  demand: { elasticity: { leisure: 1.6, business: 1.1 },
            hourFactor: { peak: 1.15, off: 0.70 }, weatherFactorMin: 0.8,
            reputation: { base: 0.6, span: 0.8 },
            hours: { peak: [[420, 600], [1080, 1260]], off: [[0, 360]] },  // minuts del dia, [inici, fi)
            pRef: { base: 90, perKm: 0.6 },              // LEBL-LEPA 201,97 km -> 211,18 EUR
            dBase: { scale: 260, distanceKm: 3000 },
            sizeWeight: { hub: 1.0, major: 0.7, regional: 0.35, small: 0.15 },
            defaultKind: 'leisure',               // tipus de les rutes sense excepcio
            defaultSize: 'small' },               // mida dels aeroports que no son a airportSize

  airportSize: {                            // ICAO -> categoria; si no hi es, demand.defaultSize
    LEBL: 'hub', LEMD: 'hub', LIRF: 'hub', EGLL: 'hub', EDDF: 'hub', KJFK: 'hub', SBGR: 'hub',
    LEPA: 'major', LEIB: 'major', LEVC: 'major', LEAL: 'major', LEZL: 'major',
    LEMG: 'major', LFMN: 'major', LFPO: 'major', GCLP: 'major',
    LEGE: 'regional', LERS: 'regional', LEMH: 'regional', LFMP: 'regional',
    LELL: 'small', LEDA: 'small', LESU: 'small', LECH: 'small'
  },
  routeExceptions: {                        // clau 'AAAA-BBBB' en ordre alfabetic; camps opcionals
    'LEBL-LEMD': { kind: 'business' }       // el pont aeri
  },
  airportDifficulty: { LESU: 0.50, LELL: 0.30, LEMH: 0.10 },   // la resta, 0
  exclusivityBonus: 0.25,

  cruiseSkipFuelPenalty: 0.08,
  xpMultipliers: { turbulence: 1.3, hardWeather: 1.4 },
  school: { passScore: 45, mercyScore: 30, mercyAttempt: 3, graduationXp: 250 }
});
