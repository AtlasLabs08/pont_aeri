/* Tipus del mode Airline: l estructura CareerState de la seccio 5
 * d ENGINEERING.md, en JSDoc. Nomes documentacio, sense codi executable.
 * NOU: tasca A5.
 *
 * EXPORTA: res. Els editors i tsc el llegeixen amb
 *   @typedef {import('./types.js').CareerState} CareerState
 *
 * Una sola estructura serialitzable a JSON: res de classes, Map, Set ni
 * objectes de temps. Tots els imports son euros enters.
 */

/**
 * @typedef {Object} CareerState
 * @property {number} schemaVersion
 * @property {number} balanceVersion
 * @property {number} rngSeed
 * @property {number} rngCounter
 * @property {string} createdAt      ISO, nomes informatiu
 * @property {Pilot}  pilot
 * @property {Company} company
 * @property {Airframe[]} fleet
 * @property {{airportsUnlocked:string[], routesFlown:string[]}} network
 * @property {{queue:DispatchOrder[]}} dispatch
 * @property {{minute:number}} clock
 * @property {{lessonsPassed:string[], attempts:Object<string,number>, graduated:boolean}} school
 */

/** @typedef {{name:string, xp:number, rank:string, ratings:string[],
 *             endorsements:string[], logbook:LogEntry[]}} Pilot */

/** @typedef {{cash:number, reputation:number, bases:string[], loans:Loan[],
 *             insurance:Object<string,Insurance>, flightsFlown:number,
 *             lifetimeRevenue:number}} Company */

/**
 * @typedef {Object} Airframe
 * @property {string} reg            clau primaria, 'EC-XXX'
 * @property {string} typeId
 * @property {number} yearBuilt
 * @property {number} hours
 * @property {number} cycles
 * @property {{engines:number, gear:number, airframe:number, avionics:number}} condition
 * @property {string} location       ICAO
 * @property {'ready'|'maintenance'|'dispatched'|'inFlight'} status
 * @property {number} groundedUntilMinute
 * @property {{nextAHours:number, nextCHours:number, deferred:string[]}} maintenance
 * @property {{purchasePrice:number, loanId:string|null, leaseId:string|null}} finance
 * @property {number} value
 */

/** @typedef {{id:string, reg:string, from:string, to:string, crewId:string,
 *             departMinute:number, ticketPrice:number, rngCounter:number}} DispatchOrder */

/* La seccio 5 encara no defineix aquests tres. Els tancaran les tasques
 * que els facin servir (B2 economia, B4 progressio). Fins llavors validate()
 * nomes exigeix que siguin objectes. */

/** @typedef {Object} LogEntry   una linia del quadern de vol, append-only */
/** @typedef {Object} Loan       prestec de la companyia */
/** @typedef {Object} Insurance  polissa d un avio, per matricula */
