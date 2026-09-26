/* Estat de la partida del mode Airline: crear-lo, validar-lo, migrar-lo i
 * passar-lo a JSON i de tornada. Funcions pures que no llancen mai.
 * NOU: tasca A5 d ENGINEERING.md (seccions 5 i 8).
 *
 * EXPORTA: SCHEMA_VERSION createCareer validate migrate needsBalanceUpdate
 *          exportJson importJson
 *
 * IMPORTA: BALANCE de ./balance.js. Res del navegador: qui crida passa la
 * data de creacio i la llavor.
 *
 * INTERFICIE (no la canviis, app/ i els tests en depenen):
 *   createCareer({ name, seed, createdAt }) -> CareerState nou, a l escola
 *   validate(state)          -> { ok, errors[] }   errors: textos per depurar,
 *                                                  no per mostrar al jugador
 *   migrate(raw)             -> CareerState o null (mai llanca, no modifica raw)
 *   needsBalanceUpdate(state) -> true si balanceVersion != BALANCE.version
 *   exportJson(state)        -> text, o null si no es serialitzable
 *   importJson(text)         -> CareerState o null (passa per migrate)
 *
 * Per afegir una versio d esquema: puja SCHEMA_VERSION i afegeix a MIGRATIONS
 * la funcio que passa de la versio anterior a la nova. migrate() les encadena.
 */

import { BALANCE } from './balance.js';

/** @typedef {import('./types.js').CareerState} CareerState */

export const SCHEMA_VERSION = 1;

/* Limits de l esquema. PENDENT B1: la reputacio inicial es una constant
 * economica i s ha de moure a BALANCE; aqui nomes fins que balance.js existeixi. */
const REPUTATION_MIN = 0;
const REPUTATION_MAX = 100;
const STARTING_REPUTATION = 50;
const STARTING_RANK = 'student';

const AIRFRAME_STATUS = ['ready', 'maintenance', 'dispatched', 'inFlight'];
const ICAO_RE = /^[A-Z0-9]{4}$/;
const ROUTE_RE = /^([A-Z0-9]{4})-([A-Z0-9]{4})$/;

/**
 * Migracions per versio d esquema: MIGRATIONS[n] rep un estat de la versio n
 * i en retorna un de la versio n + 1. Encara buit: nomes existeix la versio 1.
 * @type {Object<number, function(Object): Object>}
 */
const MIGRATIONS = {};

// ---------------------------------------------------------------------------
// Creacio

/**
 * Partida nova en fase d escola: sense diners, avions, bases ni aeroports.
 * @param {{name:string, seed:number, createdAt:string}} opts
 * @returns {CareerState}
 */
export function createCareer(opts) {
  const o = isObject(opts) ? opts : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    balanceVersion: BALANCE.version,
    rngSeed: typeof o.seed === 'number' && Number.isFinite(o.seed) ? o.seed >>> 0 : 0,
    rngCounter: 0,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : '',
    pilot: {
      name: typeof o.name === 'string' ? o.name : '',
      xp: 0, rank: STARTING_RANK, ratings: [], endorsements: [], logbook: []
    },
    company: {
      cash: 0, reputation: STARTING_REPUTATION, bases: [], loans: [],
      insurance: {}, flightsFlown: 0, lifetimeRevenue: 0
    },
    fleet: [],
    network: { airportsUnlocked: [], routesFlown: [] },
    dispatch: { queue: [] },
    clock: { minute: 0 },
    school: { lessonsPassed: [], attempts: {}, graduated: false }
  };
}

// ---------------------------------------------------------------------------
// Validacio

/**
 * Comprova els tipus de la seccio 5 i les invariants. No s atura al primer
 * error: els retorna tots, amb el cami del camp (p. ex. 'fleet[2].reg').
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validate(state) {
  const errors = [];
  try {
    checkState(state, errors);
  } catch (e) {
    errors.push('validate: ' + String(e && e.message));
  }
  return { ok: errors.length === 0, errors };
}

function checkState(s, err) {
  if (!isObject(s)) { err.push('state: no es un objecte'); return; }

  if (s.schemaVersion !== SCHEMA_VERSION) err.push('schemaVersion: ha de ser ' + SCHEMA_VERSION);
  need(err, 'balanceVersion', s.balanceVersion, isNatural);
  need(err, 'rngSeed', s.rngSeed, isUint32);
  need(err, 'rngCounter', s.rngCounter, isNatural);
  need(err, 'createdAt', s.createdAt, isString);

  const p = s.pilot;
  if (!isObject(p)) err.push('pilot: no es un objecte');
  else {
    need(err, 'pilot.name', p.name, isString);
    need(err, 'pilot.xp', p.xp, isFiniteNumber);
    need(err, 'pilot.rank', p.rank, isNonEmptyString);
    need(err, 'pilot.ratings', p.ratings, isStringArray);
    need(err, 'pilot.endorsements', p.endorsements, isStringArray);
    need(err, 'pilot.logbook', p.logbook, isObjectArray);
  }

  const c = s.company;
  if (!isObject(c)) err.push('company: no es un objecte');
  else {
    need(err, 'company.cash', c.cash, Number.isInteger, 'ha de ser un enter d euros');
    if (!isFiniteNumber(c.reputation) || c.reputation < REPUTATION_MIN || c.reputation > REPUTATION_MAX) {
      err.push('company.reputation: ha de ser un numero entre ' + REPUTATION_MIN + ' i ' + REPUTATION_MAX);
    }
    need(err, 'company.bases', c.bases, isIcaoArray);
    need(err, 'company.loans', c.loans, isObjectArray);
    need(err, 'company.insurance', c.insurance, v => isObject(v) && Object.values(v).every(isObject));
    need(err, 'company.flightsFlown', c.flightsFlown, isNatural);
    need(err, 'company.lifetimeRevenue', c.lifetimeRevenue, Number.isInteger, 'ha de ser un enter d euros');
  }

  if (!Array.isArray(s.fleet)) err.push('fleet: no es una llista');
  else {
    const seen = new Set();
    s.fleet.forEach((a, i) => {
      checkAirframe(a, 'fleet[' + i + ']', err);
      if (isObject(a) && isNonEmptyString(a.reg)) {
        if (seen.has(a.reg)) err.push('fleet[' + i + '].reg: matricula repetida ' + a.reg);
        seen.add(a.reg);
      }
    });
  }

  const n = s.network;
  if (!isObject(n)) err.push('network: no es un objecte');
  else {
    need(err, 'network.airportsUnlocked', n.airportsUnlocked, isIcaoArray);
    if (!Array.isArray(n.routesFlown)) err.push('network.routesFlown: no es una llista');
    else n.routesFlown.forEach((r, i) => {
      if (!isRouteKey(r)) err.push('network.routesFlown[' + i + ']: ha de ser AAAA-BBBB amb els ICAO en ordre alfabetic');
    });
  }

  const d = s.dispatch;
  if (!isObject(d)) err.push('dispatch: no es un objecte');
  else if (!Array.isArray(d.queue)) err.push('dispatch.queue: no es una llista');
  else d.queue.forEach((o, i) => checkOrder(o, 'dispatch.queue[' + i + ']', err));

  if (!isObject(s.clock)) err.push('clock: no es un objecte');
  else need(err, 'clock.minute', s.clock.minute, isNatural);

  const sc = s.school;
  if (!isObject(sc)) err.push('school: no es un objecte');
  else {
    need(err, 'school.lessonsPassed', sc.lessonsPassed, isStringArray);
    need(err, 'school.attempts', sc.attempts, v => isObject(v) && Object.values(v).every(isNatural));
    need(err, 'school.graduated', sc.graduated, isBoolean);
  }
}

function checkAirframe(a, at, err) {
  if (!isObject(a)) { err.push(at + ': no es un objecte'); return; }
  need(err, at + '.reg', a.reg, isNonEmptyString);
  need(err, at + '.typeId', a.typeId, isNonEmptyString);
  need(err, at + '.yearBuilt', a.yearBuilt, Number.isInteger);
  need(err, at + '.hours', a.hours, isNonNegative);
  need(err, at + '.cycles', a.cycles, isNatural);
  need(err, at + '.condition', a.condition, v => isObject(v) &&
    ['engines', 'gear', 'airframe', 'avionics'].every(k => isFiniteNumber(v[k])));
  need(err, at + '.location', a.location, isIcao);
  need(err, at + '.status', a.status, v => AIRFRAME_STATUS.includes(v));
  need(err, at + '.groundedUntilMinute', a.groundedUntilMinute, isNatural);
  need(err, at + '.maintenance', a.maintenance, v => isObject(v) &&
    isNonNegative(v.nextAHours) && isNonNegative(v.nextCHours) && isStringArray(v.deferred));
  need(err, at + '.finance', a.finance, v => isObject(v) &&
    Number.isInteger(v.purchasePrice) && isStringOrNull(v.loanId) && isStringOrNull(v.leaseId));
  need(err, at + '.value', a.value, Number.isInteger, 'ha de ser un enter d euros');
}

function checkOrder(o, at, err) {
  if (!isObject(o)) { err.push(at + ': no es un objecte'); return; }
  need(err, at + '.id', o.id, isNonEmptyString);
  need(err, at + '.reg', o.reg, isNonEmptyString);
  need(err, at + '.from', o.from, isIcao);
  need(err, at + '.to', o.to, isIcao);
  need(err, at + '.crewId', o.crewId, isString);
  need(err, at + '.departMinute', o.departMinute, isNatural);
  need(err, at + '.ticketPrice', o.ticketPrice, Number.isInteger, 'ha de ser un enter d euros');
  need(err, at + '.rngCounter', o.rngCounter, isNatural);
}

function need(err, at, value, ok, why) {
  if (!ok(value)) err.push(at + ': ' + (why || 'tipus o valor invalid'));
}

function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function isString(v) { return typeof v === 'string'; }
function isNonEmptyString(v) { return typeof v === 'string' && v.length > 0; }
function isStringOrNull(v) { return v === null || typeof v === 'string'; }
function isBoolean(v) { return typeof v === 'boolean'; }
function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }
function isNonNegative(v) { return isFiniteNumber(v) && v >= 0; }
function isNatural(v) { return Number.isInteger(v) && v >= 0; }
function isUint32(v) { return Number.isInteger(v) && v >>> 0 === v; }
function isStringArray(v) { return Array.isArray(v) && v.every(isString); }
function isObjectArray(v) { return Array.isArray(v) && v.every(isObject); }
function isIcao(v) { return typeof v === 'string' && ICAO_RE.test(v); }
function isIcaoArray(v) { return Array.isArray(v) && v.every(isIcao); }

/** 'AAAA-BBBB' amb A <= B. Mateix aeroport als dos costats es valid (circuit). */
function isRouteKey(v) {
  const m = typeof v === 'string' && ROUTE_RE.exec(v);
  return !!m && m[1] <= m[2];
}

// ---------------------------------------------------------------------------
// Migracio i versions

/**
 * Porta qualsevol cosa llegida del disc a un CareerState valid de la versio
 * actual, o null. No modifica raw: treballa sobre una copia.
 * null si raw no es un objecte, si no te versio, si la versio es mes nova que
 * SCHEMA_VERSION, si falta una migracio o si el resultat no valida.
 * @returns {CareerState|null}
 */
export function migrate(raw) {
  try {
    if (!isObject(raw)) return null;
    const v0 = raw.schemaVersion;
    if (!Number.isInteger(v0) || v0 < 1 || v0 > SCHEMA_VERSION) return null;
    let s = JSON.parse(JSON.stringify(raw));
    for (let v = v0; v < SCHEMA_VERSION; v++) {
      const step = MIGRATIONS[v];
      if (typeof step !== 'function') return null;
      s = step(s);
      if (!isObject(s)) return null;
      s.schemaVersion = v + 1;
    }
    return validate(s).ok ? s : null;
  } catch (e) {
    return null;
  }
}

/** true si la partida es va desar amb un altre BALANCE: cal avisar el jugador. */
export function needsBalanceUpdate(state) {
  return !isObject(state) || state.balanceVersion !== BALANCE.version;
}

// ---------------------------------------------------------------------------
// JSON

/**
 * No valida: exportar una partida trencada es justament el que cal per
 * reproduir un bug. null nomes si no es pot serialitzar.
 * @returns {string|null}
 */
export function exportJson(state) {
  try {
    const text = JSON.stringify(state);
    return typeof text === 'string' ? text : null;
  } catch (e) {
    return null;
  }
}

/** @returns {CareerState|null} */
export function importJson(text) {
  if (typeof text !== 'string') return null;
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return null;
  }
  return migrate(raw);
}
