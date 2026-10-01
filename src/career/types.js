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
 * @property {Market} [market]       opcional: si falta, refreshMarket (market.js) el genera
 */

/**
 * Mercat d ocasio (D2+D5). epoch = floor(clock.minute / market.regenMinutes)
 * de quan es va generar la llista.
 * @typedef {{epoch:number, listings:Listing[]}} Market
 */

/**
 * Un anunci del mercat: un avio concret amb historial. En comprar-lo es
 * converteix en un Airframe amb els mateixos camps.
 * @typedef {Object} Listing
 * @property {string} reg            'EC-XXX', unica entre la flota i la llista
 * @property {string} typeId
 * @property {'basic'|'standard'|'premium'|'deluxe'} tier
 * @property {number} yearBuilt
 * @property {number} hours
 * @property {number} cycles
 * @property {{engines:number, gear:number, airframe:number, avionics:number}} condition
 * @property {{nextAHours:number, nextCHours:number}} maintenance   hores absolutes, com l Airframe
 * @property {number} price          euros enters: el que es paga, listPrice menys l oferta
 * @property {number} [listPrice]    K1. Opcional: el preu de priceOf, sense la rebaixa; sense, price
 * @property {number} [offerPct]     K1. Opcional: rebaixa 0..1 (0 = sense oferta); price = round(listPrice * (1 - offerPct))
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
 * @property {'basic'|'standard'|'premium'|'deluxe'} [tier]   opcional: sense, 'standard'
 */

/** @typedef {{id:string, reg:string, from:string, to:string, crewId:string,
 *             departMinute:number, ticketPrice:number, rngCounter:number}} DispatchOrder */

/* La seccio 5 encara no defineix aquests tres. Els tancaran les tasques
 * que els facin servir (B2 economia, B4 progressio). Fins llavors validate()
 * nomes exigeix que siguin objectes. */

/** @typedef {Object} LogEntry   una linia del quadern de vol, append-only */
/** @typedef {{id:string, principal:number, balance:number, ratePerFlight:number,
 *             termFlights:number, instalment:number, flightsPaid:number}} Loan
 *   prestec de la companyia o d un avio; es crea amb makeLoan (finance.js, B5),
 *   que no posa id: l id (unic dins de company.loans) el posa qui el desa, i
 *   Airframe.finance.loanId hi apunta */
/** @typedef {Object} Insurance  polissa d un avio, per matricula */
