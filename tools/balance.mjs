/* Harness economic del mode Airline (seccio 10 d ENGINEERING.md, tasca B5).
 * Simula una partida d un jugador mitja amb les funcions reals de career/ i
 * imprimeix la corba de diners, el vol de cada compra, els vols fins a cada
 * rang, el % de vols en negatiu i els ingressos per hora de joc de cada acte.
 * No forma part de npm test: dona informacio, no un si o un no.
 *
 * Correr:  npm run balance            (llavor i vols per defecte)
 *          node tools/balance.mjs [llavor] [vols]
 *
 * EXPORTA: runBalance formatReport HARNESS
 *
 * Tot l atzar surt de draw(state): la mateixa llavor dona sempre el mateix
 * resultat. Cap Math.random().
 *
 * Els numeros de HARNESS no son economia del joc (aquesta es tota a
 * BALANCE): descriuen el jugador simulat i els FlightRecords sintetics que
 * substitueixen el model de vol. El joc real treu el consum, les hores de
 * bloc i el contacte del FlightRecorder.
 */

import { pathToFileURL } from 'node:url';
import {
  BALANCE, createCareer, draw, routeFor, routeModel, routeKey, demandPax,
  computeFlightResult, applyFlightWear, checksDue, performCheck, failureChance, assessDamage,
  rankForXp, flightXp, applyXp, purchaseRating, financeAircraft, makeLoan, payInstalment,
  maxCrew, hireCrew, validate
} from '../src/career/index.js';
import { distanceKm } from '../src/world/index.js';

const SECONDS_PER_HOUR = 3600;
const MINUTES_PER_HOUR = 60;

export const HARNESS = Object.freeze({
  seed: 20260927,
  flights: 200,

  // Nota d aterratge: normal(72, 14) retallada a [0, 100]; un 3 % de vols,
  // uniforme a [0, 25) (la cua de mals aterratges)
  score: { mean: 72, sd: 14, tailPct: 0.03, tailMax: 25 },

  // Escala de flota del jugador: cada salt es la seguent classe
  ladder: ['commuter', 'tp', 'nb', 'wb', 'jumbo'],

  // Rotacio de cada tipus: una volta d aeroports, que torna a comencar. El
  // tram i va de cycle[i] a cycle[i + 1]. Acte 1: LEBL, LEPA, LEGE i LERS
  // (DESIGN.md, "Arc de la partida")
  routes: {
    commuter: ['LEBL', 'LEPA', 'LEGE', 'LEBL', 'LEPA', 'LERS'],
    tp:       ['LEBL', 'LEPA', 'LEBL', 'LEIB', 'LEBL', 'LEMH', 'LEBL', 'LEVC'],
    nb:       ['LEBL', 'LEMD', 'LEBL', 'LFPO', 'LEBL', 'LEMG', 'LEBL', 'LIRF', 'LEBL', 'LFMN'],
    wb:       ['LEBL', 'KJFK', 'LEBL', 'EGLL', 'LEBL', 'SBGR', 'LEBL', 'EDDF'],
    jumbo:    ['LEBL', 'KJFK', 'LEBL', 'SBGR']
  },
  base: 'LEBL',

  // Coordenades dels aeroports que world/ encara no te (F1)
  coords: {
    LEBL: [41.297, 2.078], LEPA: [39.552, 2.739], LEGE: [41.901, 2.760], LERS: [41.147, 1.167],
    LEIB: [38.873, 1.373], LEMH: [39.863, 4.219], LEVC: [39.489, -0.482], LEMD: [40.472, -3.561],
    LEMG: [36.675, -4.499], LFPO: [48.723, 2.379], LIRF: [41.800, 12.239], LFMN: [43.658, 7.216],
    EGLL: [51.470, -0.454], EDDF: [50.033, 8.570], KJFK: [40.640, -73.779], SBGR: [-23.432, -46.469]
  },

  // FlightRecord sintetic per tipus: velocitat de bloc (km/h), temps fix de
  // rodatge, pujada i baixada (h), consum mitja de bloc (kg/h), altitud de
  // creuer (ft). Ordres de magnitud dels avions reals de referencia.
  perf: {
    commuter: { kmh: 380, fixedH: 0.35, kgPerH: 300,   altFt: 12000 },
    tp:       { kmh: 470, fixedH: 0.40, kgPerH: 750,   altFt: 21000 },
    nb:       { kmh: 780, fixedH: 0.50, kgPerH: 2600,  altFt: 36000 },
    wb:       { kmh: 850, fixedH: 0.60, kgPerH: 6200,  altFt: 39000 },
    jumbo:    { kmh: 870, fixedH: 0.60, kgPerH: 11000, altFt: 37000 }
  },
  fuelSd: 0.03,              // desviacio del consum real respecte del pla
  arrivalSd: 8,              // minuts de retard o d avancament (desviacio)
  departMinutes: [360, 1320],// hora de sortida, uniforme (dia)
  pTurbulence: 0.20,         // un vol de cada cinc amb vent apreciable (DESIGN.md)
  pHardWeather: 1 / 15,      // un de cada quinze amb condicions dures
  weatherSeverityMax: 0.6,   // severitat per a demandPax quan hi ha meteo dura
  pTailStrike: 0.004,

  // Reserva que el jugador guarda en contractar tripulacio: el cash que li
  // queda despres de pagar-la ha de valer almenys crewReserve contractacions
  crewReserve: 1.2,

  // Contacte a partir de la nota: fpm = fpmAt0 - fpmPerPoint * nota + soroll
  touchdown: { fpmAt0: 900, fpmPerPoint: 8.5, fpmSd: 40, fpmMin: 40, gPerFpm: 1 / 650, gSd: 0.05 },

  // Durada real d un cicle de joc: de 12 a 25 minuts segons la ruta (DESIGN.md,
  // "El bucle de joc"), interpolat en escala logaritmica de la distancia
  realMinutes: { min: 12, max: 25, kmMin: 80, kmMax: 8500 },

  // Corba objectiu de DESIGN.md (net per vol sol i amb tripulacio completa):
  // nomes per comparar, no entra a la simulacio
  targets: {
    commuter: [8500, 22000], tp: [28000, 75000], nb: [80000, 215000],
    wb: [230000, 420000], jumbo: [350000, 600000]
  },

  // Actes de DESIGN.md segons la classe de l avio que vola el jugador
  acts: { commuter: 1, turboprop: 2, narrowbody: 3, widebody: 4 }
});

const H = HARNESS;

/** Criteris de la seccio 10 d ENGINEERING.md, amb el canvi del B5 (docs/DECISIONS.md). */
const CRITERIA = { jumpMin: 40, jumpMax: 50, firstJumpMax: 55, negativeMax: 0.12, actHoursMax: 16 };

// ---------------------------------------------------------------------------
// Atzar

/** Normal(0, 1) amb Box-Muller: dues tirades de draw. */
function gauss(state) {
  const u = Math.max(draw(state), Number.MIN_VALUE);
  const v = draw(state);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clampTo = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Nota d aterratge del jugador mitja. */
function landingScore(state) {
  const S = H.score;
  if (draw(state) < S.tailPct) return draw(state) * S.tailMax;
  return clampTo(S.mean + S.sd * gauss(state), 0, 100);
}

// ---------------------------------------------------------------------------
// Rutes

const sizeOf = icao => Object.hasOwn(BALANCE.airportSize, icao) ? BALANCE.airportSize[icao] : BALANCE.demand.defaultSize;

/** Distancia i model de demanda d una ruta. world/ si hi es; si no, les coordenades de HARNESS. */
function route(from, to) {
  const [a, b] = [H.coords[from], H.coords[to]];
  const km = distanceKm(a[0], a[1], b[0], b[1]);
  const key = routeKey(from, to);
  const model = routeFor(from, to) ?? routeModel({
    distanceKm: km, sizeA: sizeOf(from), sizeB: sizeOf(to),
    exception: Object.hasOwn(BALANCE.routeExceptions, key) ? BALANCE.routeExceptions[key] : null
  });
  return { km, model };
}

/** Minuts reals que el jugador passa en aquest vol. */
function realMinutes(km) {
  const R = H.realMinutes;
  const t = clampTo(Math.log(km / R.kmMin) / Math.log(R.kmMax / R.kmMin), 0, 1);
  return R.min + (R.max - R.min) * t;
}

// ---------------------------------------------------------------------------
// FlightRecord sintetic

function syntheticRecord(state, typeId, from, to, km, pax) {
  const P = H.perf[typeId], T = H.touchdown;
  const blockH = P.fixedH + km / P.kmh;
  const plannedKg = Math.round(blockH * P.kgPerH);
  const burntKg = Math.round(plannedKg * (1 + H.fuelSd * gauss(state)));
  const score = landingScore(state);
  const fpm = Math.max(T.fpmMin, T.fpmAt0 - T.fpmPerPoint * score + T.fpmSd * gauss(state));
  const g = 1 + fpm * T.gPerFpm + T.gSd * gauss(state);
  const tailStrike = draw(state) < H.pTailStrike;
  const turbulence = draw(state) < H.pTurbulence;
  const hardWeather = draw(state) < H.pHardWeather;
  const remaining = 1800;
  const record = {
    aircraftTypeId: typeId, from, to,
    blockSeconds: Math.round(blockH * SECONDS_PER_HOUR),
    airborneSeconds: Math.round((blockH - 0.2) * SECONDS_PER_HOUR),
    fuelBurntKg: burntKg, fuelPlannedKg: plannedKg, paxOnBoard: pax,
    maxAltFt: P.altFt, maxG: Math.max(1.3, g), maxBankDeg: 25, abruptInputs: 0,
    timeAccelMax: 16, usedCruiseSkip: false, skippedCruiseFuelKg: 0,
    arrivalDeltaMin: Math.round(H.arrivalSd * gauss(state)),
    touchdown: {
      fpm: -Math.round(fpm), g: Math.round(g * 100) / 100, bounces: 0,
      onRunway: true, rwy: '24R', tdzDist: 400, center: 2, crab: 1, remaining,
      ias: 130, pitch: 4, roll: 0, score: Math.round(score), pts: null
    },
    rolloutMetres: 1100, tailStrike, crashCause: null, events: []
  };
  return { record, turbulence, hardWeather };
}

// ---------------------------------------------------------------------------
// Partida

function newAirframe(typeId, n, price, loanId) {
  return {
    reg: 'EC-B' + String.fromCharCode(65 + Math.floor(n / 26)) + String.fromCharCode(65 + n % 26),
    typeId, yearBuilt: 2010, hours: 0, cycles: 0,
    condition: { engines: 100, gear: 100, airframe: 100, avionics: 100 },
    location: H.base, status: 'ready', groundedUntilMinute: 0,
    maintenance: { nextAHours: BALANCE.checks.A.intervalHours, nextCHours: BALANCE.checks.C.intervalHours, deferred: [] },
    finance: { purchasePrice: price, loanId, leaseId: null },
    value: price
  };
}

/** Graduacio de l escola (DESIGN.md): habilitacio commuter, XP i capital inicial amb el credit. */
function graduate(state) {
  const xp = BALANCE.school.graduationXp;
  const bought = purchaseRating({ ...state.pilot, xp, rank: rankForXp(xp) }, 0, 'commuter');
  state.pilot = bought.pilot;
  state.school.graduated = true;
  state.company.cash = BALANCE.startingCash;
  state.company.bases = [H.base];
  state.company.loans = [{ id: 'L0', ...makeLoan(BALANCE.startingLoan.principal,
    BALANCE.startingLoan.ratePerFlight, BALANCE.startingLoan.termFlights) }];
}

/**
 * Simula la partida. Retorna les dades en brut; formatReport les imprimeix.
 * @param {{seed?:number, flights?:number}} opts
 */
export function runBalance({ seed = H.seed, flights = H.flights } = {}) {
  const state = createCareer({ name: 'Harness', seed, createdAt: '' });
  graduate(state);
  const co = state.company;

  const log = [], purchases = [], crews = [], ranks = [{ key: state.pilot.rank, flight: 0 }], checks = [];
  const affordableAt = {};   // primer vol en que hi havia diners per al seguent salt
  let rung = 0, legIndex = 0, crewCount = 0, loanSeq = 1;

  /** Compra el tipus del graó `i` de l escala. Retorna true si l ha comprat. */
  function tryBuy(i, flight) {
    const typeId = H.ladder[i];
    const price = BALANCE.usedPrice[typeId];
    const rating = BALANCE.fleetTypes[typeId].rating;
    const needsRating = !state.pilot.ratings.includes(rating);
    const ratingCost = needsRating ? BALANCE.ratings[rating].cost : 0;
    const outright = state.fleet.length === 0;           // el primer avio es paga sencer
    const fin = outright ? null : financeAircraft(price);
    const upfront = (outright ? price : fin.downPayment) + ratingCost;
    if (co.cash < upfront) return false;
    affordableAt[typeId] ??= flight;
    if (needsRating) {
      const r = purchaseRating(state.pilot, co.cash, rating);
      if (!r.ok) return false;                           // normalment 'rank'
      state.pilot = r.pilot;
    }
    let loanId = null;
    if (fin) {
      loanId = 'L' + loanSeq++;
      co.loans.push({ id: loanId, ...fin.loan });
    }
    co.cash -= upfront;
    state.fleet.push(newAirframe(typeId, state.fleet.length, price, loanId));
    purchases.push({ typeId, flight, price, downPayment: outright ? price : fin.downPayment, ratingCost });
    crewCount = 0;                                       // tripulacio nova per a la classe nova
    legIndex = 0;
    return true;
  }

  tryBuy(0, 0);

  for (let f = 1; f <= flights; f++) {
    const airframe = state.fleet[state.fleet.length - 1];
    const typeId = airframe.typeId;
    const cls = BALANCE.fleetTypes[typeId].cls;

    // Tram seguent de la rotacio del tipus
    const cycle = H.routes[typeId];
    const from = cycle[legIndex % cycle.length], to = cycle[(legIndex + 1) % cycle.length];
    legIndex++;
    const { km, model } = route(from, to);

    const minute = H.departMinutes[0] + draw(state) * (H.departMinutes[1] - H.departMinutes[0]);
    const seats = BALANCE.fleetTypes[typeId].seats;
    const hardWeatherDemand = draw(state) < H.pHardWeather;
    const pax = demandPax({ route: model, price: model.pRef, seats, minute,
      weatherSeverity: hardWeatherDemand ? H.weatherSeverityMax : 0, reputation: co.reputation });

    const { record, turbulence, hardWeather } = syntheticRecord(state, typeId, from, to, km, pax);
    const input = { record, mode: 'own', ticketPrice: model.pRef, paxOnBoard: pax };
    const res = computeFlightResult({ ...input, crewCount });
    // El mateix vol sense tripulacio i amb la tripulacio completa, per a la Corba objectiu
    const netSolo = computeFlightResult({ ...input, crewCount: 0 }).net;
    const netFull = computeFlightResult({ ...input, crewCount: maxCrew(cls) }).net;

    // Desgast, manteniment i danys: euros reals, fora de K
    const worn = applyFlightWear(airframe, record);
    let af = worn.airframe;
    const dmg = assessDamage({ record, airframeValue: af.value, mode: 'own' });
    let maint = worn.cycleCost;
    for (const kind of checksDue(af)) {
      const c = performCheck(af, kind);
      af = c.airframe; maint += c.cost;
      checks.push({ flight: f, typeId, kind, cost: c.cost });
    }
    if (failureChance(af.condition.engines) > 0) {
      const c = performCheck(af, 'engine');
      af = c.airframe; maint += c.cost;
      checks.push({ flight: f, typeId, kind: 'engine', cost: c.cost });
    }
    state.fleet[state.fleet.length - 1] = af;

    // Quotes: totes les dels prestecs vius, una per vol
    let instalments = 0;
    co.loans = co.loans.map(l => {
      const p = payInstalment(l);
      instalments += p.paid;
      return { ...p.loan, id: l.id };
    }).filter(l => l.balance > 0);

    const flightResult = res.net - maint - dmg.playerCost;
    co.cash += flightResult - instalments;
    co.flightsFlown++;
    co.lifetimeRevenue += res.revenue.tickets + res.revenue.punctuality + res.revenue.fuelSaving;

    // XP i rang
    const xp = flightXp({ landingXp: res.landing.xp, turbulence, hardWeather, destination: to });
    const up = applyXp(state.pilot, xp);
    state.pilot = up.pilot;
    if (!ranks.some(k => k.key === up.rankAfter)) ranks.push({ key: up.rankAfter, flight: f });

    log.push({
      flight: f, typeId, cls, act: H.acts[cls], from, to, km: Math.round(km), pax,
      score: record.touchdown.score, net: res.net, netSolo, netFull, crewCount, xpGain: xp,
      maint, damage: dmg.playerCost, flightResult,
      instalments, cash: co.cash, debt: co.loans.reduce((s, l) => s + l.balance, 0),
      xp: state.pilot.xp, rank: state.pilot.rank, realMin: realMinutes(km)
    });

    // Compres obvies: primer la classe seguent; si no, una tripulacio mes,
    // si en pagar-la queda la reserva
    if (rung + 1 < H.ladder.length && tryBuy(rung + 1, f)) rung++;
    else {
      const reserve = H.crewReserve * BALANCE.crewHireCost[cls];
      const h = hireCrew({ cls, crewCount, cash: co.cash - reserve });
      if (h.ok) {
        co.cash -= h.cost;
        crewCount = h.crewCount;
        crews.push({ flight: f, typeId, crewCount, cost: h.cost });
      }
    }
  }

  return { seed, flights, log, purchases, crews, ranks, checks, affordableAt, valid: validate(state), state };
}

// ---------------------------------------------------------------------------
// Informe

const fmt = n => Math.round(n).toLocaleString('en-US');
const pad = (s, n) => String(s).padStart(n);

/** Text de l informe de runBalance. */
export function formatReport(r) {
  const out = [];
  const p = s => out.push(s);
  p('Harness economic de Pont Aeri — llavor ' + r.seed + ', ' + r.flights + ' vols, K = ' + BALANCE.K +
    ', termini ' + BALANCE.financing.termFlights + ' vols');
  p('');

  p('Corba de cash (cada 10 vols; deute = prestecs vius)');
  p('   vol  tipus         cash          deute     XP  rang');
  for (const e of r.log) {
    if (e.flight % 10 === 0 || e.flight === 1) {
      p(pad(e.flight, 6) + '  ' + e.typeId.padEnd(8) + pad(fmt(e.cash), 13) + pad(fmt(e.debt), 15) +
        pad(e.xp, 7) + '  ' + e.rank);
    }
  }
  const minCash = r.log.reduce((m, e) => Math.min(m, e.cash), Infinity);
  p('  cash minim: ' + fmt(minCash));
  p('');

  p('Compres (vol 0 = en sortir de l escola)');
  let prev = null;
  for (const c of r.purchases) {
    const gap = prev === null ? '' : '  (+' + (c.flight - prev) + ' vols)';
    const aff = r.affordableAt[c.typeId];
    const waited = aff !== undefined && aff < c.flight ? '  diners des del vol ' + aff + ', esperant rang' : '';
    p('  vol ' + pad(c.flight, 3) + '  ' + c.typeId.padEnd(8) + ' preu ' + pad(fmt(c.price), 11) +
      '  entrada ' + pad(fmt(c.downPayment), 11) + '  habilitacio ' + pad(fmt(c.ratingCost), 8) + gap + waited);
    prev = c.flight;
  }
  const bought = new Set(r.purchases.map(c => c.typeId));
  for (const t of H.ladder) {
    if (!bought.has(t)) {
      const aff = r.affordableAt[t];
      p('  no comprat: ' + t + (aff !== undefined ? ' (diners des del vol ' + aff + ', sense el rang)' : ''));
      break;
    }
  }
  p('');

  p('Tripulacions contractades');
  for (const t of H.ladder) {
    const c = r.crews.filter(x => x.typeId === t);
    if (c.length) p('  ' + t.padEnd(8) + ' ' + c.map(x => 'vol ' + x.flight + ' (' + fmt(x.cost) + ')').join(', '));
  }
  p('');

  p('Corba objectiu (net mitja per vol del mateix vol sol i amb tripulacio completa; objectiu de DESIGN.md)');
  p('  tipus     vols        sol   objectiu    desv.       complet   objectiu    desv.');
  for (const t of H.ladder) {
    const rows = r.log.filter(e => e.typeId === t);
    if (!rows.length) continue;
    const avg = k => rows.reduce((s, e) => s + e[k], 0) / rows.length;
    const [ts, tf] = H.targets[t];
    const dev = (v, tgt) => ((v / tgt - 1) * 100).toFixed(0).padStart(5) + ' %';
    p('  ' + t.padEnd(8) + pad(rows.length, 5) + pad(fmt(avg('netSolo')), 11) + pad(fmt(ts), 11) + '  ' + dev(avg('netSolo'), ts) +
      pad(fmt(avg('netFull')), 14) + pad(fmt(tf), 11) + '  ' + dev(avg('netFull'), tf));
  }
  const xpAvg = r.log.reduce((s, e) => s + e.xpGain, 0) / r.log.length;
  p('  XP mitjana per vol: ' + xpAvg.toFixed(1));
  p('');

  p('Rangs');
  for (const k of r.ranks) p('  ' + k.key.padEnd(11) + ' vol ' + k.flight);
  const reached = new Set(r.ranks.map(k => k.key));
  const next = BALANCE.ranks.find(k => !reached.has(k.key));
  if (next) {
    const last = r.log[r.log.length - 1];
    p('  ' + next.key.padEnd(11) + ' no arriba (' + last.xp + ' de ' + next.xp + ' XP)');
  }
  p('');

  const neg = r.log.filter(e => e.flightResult < 0).length;
  p('Vols en negatiu (resultat del vol - manteniment - danys, sense quotes): ' + neg + ' de ' + r.log.length +
    ' (' + (100 * neg / r.log.length).toFixed(1) + ' %)');
  const negCash = r.log.filter(e => e.flightResult - e.instalments < 0).length;
  p('Vols en negatiu comptant les quotes: ' + negCash + ' (' + (100 * negCash / r.log.length).toFixed(1) + ' %)');
  p('');

  p('Actes (hores de joc = minuts reals de cada vol, 12-25 segons la ruta)');
  p('  acte  vols   hores   resultat/h   net/vol   net mitja per tipus');
  const acts = [...new Set(r.log.map(e => e.act))];
  const actHours = {};
  for (const act of acts) {
    const rows = r.log.filter(e => e.act === act);
    const hours = rows.reduce((s, e) => s + e.realMin, 0) / MINUTES_PER_HOUR;
    actHours[act] = hours;
    const sum = rows.reduce((s, e) => s + e.flightResult, 0);
    const types = [...new Set(rows.map(e => e.typeId))]
      .map(t => { const x = rows.filter(e => e.typeId === t); return t + ' ' + fmt(x.reduce((s, e) => s + e.net, 0) / x.length); });
    const open = act === acts[acts.length - 1] ? '  (obert: la simulacio acaba aqui)' : '';
    p(pad(act, 6) + pad(rows.length, 6) + pad(hours.toFixed(1), 8) + pad(fmt(sum / hours), 13) +
      pad(fmt(sum / rows.length), 10) + '   ' + types.join(', ') + open);
  }
  p('');

  // Criteris de la seccio 10
  const gaps = r.purchases.slice(1).map((c, i) => c.flight - r.purchases[i].flight);
  const allJumps = r.purchases.length === H.ladder.length;
  const jumpsOk = allJumps && gaps.every((g, i) =>
    g >= CRITERIA.jumpMin && g <= (i === 0 ? CRITERIA.firstJumpMax : CRITERIA.jumpMax));
  const negOk = neg / r.log.length < CRITERIA.negativeMax;
  const closed = acts.slice(0, -1);
  const actsOk = closed.every(a => actHours[a] <= CRITERIA.actHoursMax);
  const yes = ok => ok ? 'compleix' : 'NO compleix';
  p('Criteris (seccio 10)');
  p('  salts de classe entre ' + CRITERIA.jumpMin + ' i ' + CRITERIA.jumpMax + ' vols (el primer fins a ' +
    CRITERIA.firstJumpMax + '): ' + (gaps.join(', ') || '-') +
    (allJumps ? '' : ' (falten ' + (H.ladder.length - r.purchases.length) + ' salts)') + ' -> ' + yes(jumpsOk));
  p('  vols en negatiu < ' + 100 * CRITERIA.negativeMax + ' %: ' + (100 * neg / r.log.length).toFixed(1) + ' % -> ' + yes(negOk));
  p('  actes tancats de ' + CRITERIA.actHoursMax + ' h o menys: ' +
    (closed.map(a => a + ': ' + actHours[a].toFixed(1) + ' h').join(', ') || '-') + ' -> ' + yes(actsOk));
  p('');

  const bills = r.checks.map(c => c.kind + '@' + c.flight + ' ' + fmt(c.cost));
  p('Revisions: ' + (bills.length ? bills.join(', ') : 'cap'));
  p('Estat final valid: ' + (r.valid.ok ? 'si' : 'NO — ' + r.valid.errors.join('; ')));
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const seed = process.argv[2] !== undefined ? Number(process.argv[2]) : H.seed;
  const flights = process.argv[3] !== undefined ? Number(process.argv[3]) : H.flights;
  console.log(formatReport(runBalance({ seed, flights })));
}
