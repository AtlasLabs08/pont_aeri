/* Compra d avions a terminis i prestecs amb quota per vol (DESIGN.md,
 * "Escala economica"). NOU: tasca B5 d ENGINEERING.md. Funcions pures: cap
 * no modifica el prestec que rep, en retornen un de nou. Aplicar-les a la
 * partida (restar la quota del cash a cada vol) es feina d app/.
 *
 * Compra i venda d avions del mercat d ocasio: D2+D5 (docs/DECISIONS.md,
 * 30/09/2026, G5-G9). La regla de compra (purchaseRule) es la mateixa per al
 * joc i per a tools/balance.mjs, com graduate.
 *
 * EXPORTA: downPayment makeLoan financeAircraft payInstalment startingCompany
 *          STARTING_LOAN_ID instalmentsPerFlight purchaseRule
 *          buyAircraft sellQuote sellAircraft
 *
 * INTERFICIE (no la canviis, app/, tools/balance.mjs i els tests en depenen):
 *   downPayment(price) -> round(price * financing.downPct), en euros.
 *     Llanca un Error si price no es un enter >= 0.
 *   makeLoan(principal, ratePerFlight = financing.ratePerFlight,
 *            termFlights = financing.termFlights)
 *   -> { principal, balance, ratePerFlight, termFlights, instalment, flightsPaid }
 *     balance = principal i flightsPaid = 0. instalment es la quota constant
 *     que el torna en termFlights vols amb interes compost per vol:
 *     round(principal * r / (1 - (1 + r)^-n)), o round(principal / n) si r = 0.
 *     Llanca un Error si principal no es un enter >= 0, si ratePerFlight no
 *     es un numero finit >= 0 o si termFlights no es un enter >= 1.
 *   financeAircraft(price) -> { downPayment, loan }
 *     loan = makeLoan(price - downPayment(price)), amb els valors de
 *     BALANCE.financing.
 *   payInstalment(loan) -> { loan, paid, interest }
 *     Un vol: interest = round(balance * ratePerFlight); paid = min(instalment,
 *     balance + interest), o balance + interest sencer a l ultima quota del
 *     termini, perque l arrodoniment no deixi cap resta. balance nou =
 *     balance + interest - paid; flightsPaid + 1. Un prestec ja tornat
 *     (balance 0) retorna paid 0 i interest 0 i no canvia.
 *   startingCompany(company) -> Company nova, el punt de partida de la
 *     companyia en graduar-se (docs/DECISIONS.md, 30/09/2026): cash =
 *     BALANCE.startingCash (ja inclou el credit, DESIGN.md: 150 k propis +
 *     250 k de credit), loans = [{ id: STARTING_LOAN_ID, ...makeLoan(
 *     startingLoan.principal, startingLoan.ratePerFlight,
 *     startingLoan.termFlights) }], reputation = BALANCE.reputation.start,
 *     bases = [BALANCE.startingBase].
 *     La resta de camps no canvien. No modifica l entrada. La fan servir
 *     graduate (progression.js) i, a traves seu, tools/balance.mjs.
 *   PAYMENT_MODES = ['cash', 'financed']   (G5)
 *   instalmentsPerFlight(loans) -> suma de instalment dels prestecs amb
 *     balance > 0: el que la companyia paga per vol.
 *   purchaseRule({ cash, loans, price, mode }) -> { ok, reason, upfront,
 *     downPayment, loan, instalments, reserve, cashAfter }   (G5, G6)
 *     mode 'cash': upfront = price, loan null. mode 'financed': downPayment =
 *     downPayment(price), loan = makeLoan(price - downPayment) amb
 *     BALANCE.financing (sense id), upfront = downPayment.
 *     instalments (Q) = instalmentsPerFlight de loans mes la quota del loan
 *     nou; reserve = financing.reserveFlights * Q; cashAfter = cash - upfront.
 *     ok si cashAfter >= reserve. reason: null, 'cash' (cash < upfront) o
 *     'reserve' (hi ha per pagar pero no queda el coixi), en aquest ordre.
 *     No toca res. Llanca un Error si mode es desconegut, si price no es un
 *     enter >= 0 o si cash no es un numero finit.
 *   buyAircraft(state, listing, mode) -> { ok: true, state, airframe }
 *     o { ok: false, reason }. reason 'rating' si pilot.ratings no inclou
 *     fleetTypes[listing.typeId].rating (G7), 'base' si la companyia no te
 *     cap base, o el de purchaseRule, en aquest ordre. La partida nova (G8):
 *     cash - upfront; si es financat, el prestec a company.loans amb id
 *     'L-' + reg (unic); a fleet, un Airframe amb els camps de l anunci (reg,
 *     typeId, tier, yearBuilt, hours, cycles, condition, nextAHours,
 *     nextCHours) a company.bases[0], status 'ready', groundedUntilMinute 0,
 *     deferred [], finance { purchasePrice: price, loanId (o null), leaseId:
 *     null } i value = price; i l anunci surt de market.listings (si hi es).
 *     No modifica l entrada. Llanca un Error si el tipus no es a
 *     BALANCE.fleetTypes o en els casos de purchaseRule.
 *   sellQuote(state, reg) -> { ok, reason, quote, loanId, loanBalance, net }
 *     (G9, K2) quote = round(min(priceOf(typeId, tier, referenceYear -
 *     yearBuilt, condition), finance.purchasePrice) * (1 - market.sellFee)),
 *     amb tier = airframeTier (sense, standard). El min impedeix vendre per
 *     mes del que es va pagar menys la comissio: comprar una oferta per
 *     revendre-la no dona guany (docs/DECISIONS.md 01/10/2026). loanBalance = balance del prestec de l avio (0 si no en te
 *     o ja no hi es); net = quote - loanBalance. reason: null, 'unknown'
 *     (cap avio amb aquesta matricula; la resta de camps null), 'status'
 *     (status != 'ready') o 'cash' (cash + net < 0), en aquest ordre.
 *   sellAircraft(state, reg) -> { ok: true, state, quote, loanBalance, net }
 *     o { ok: false, reason } de sellQuote. La partida nova: cash + net,
 *     sense l avio ni el seu prestec. No modifica l entrada.
 */

import { BALANCE } from './balance.js';
import { eur } from './util.js';
import { priceOf, airframeTier } from './market.js';

function checkEuros(x, name, fn) {
  if (!Number.isInteger(x) || x < 0) throw new Error(fn + ': ' + name + ' ha de ser un enter no negatiu (euros)');
}

/** Entrada d una compra a terminis. */
export function downPayment(price) {
  checkEuros(price, 'price', 'downPayment');
  return eur(price * BALANCE.financing.downPct);
}

/** Prestec nou amb quota constant per vol. Vegeu la capcalera. */
export function makeLoan(principal, ratePerFlight = BALANCE.financing.ratePerFlight,
                         termFlights = BALANCE.financing.termFlights) {
  checkEuros(principal, 'principal', 'makeLoan');
  if (!Number.isFinite(ratePerFlight) || ratePerFlight < 0) {
    throw new Error('makeLoan: ratePerFlight ha de ser un numero finit no negatiu');
  }
  if (!Number.isInteger(termFlights) || termFlights < 1) {
    throw new Error('makeLoan: termFlights ha de ser un enter >= 1');
  }
  const r = ratePerFlight, n = termFlights;
  const instalment = r === 0 ? principal / n : principal * r / (1 - (1 + r) ** -n);
  return { principal, balance: principal, ratePerFlight, termFlights, instalment: eur(instalment), flightsPaid: 0 };
}

/** Entrada i prestec per comprar un avio a aquest preu. */
export function financeAircraft(price) {
  const down = downPayment(price);
  return { downPayment: down, loan: makeLoan(price - down) };
}

/** La quota d un vol. Vegeu la capcalera. */
export function payInstalment(loan) {
  if (loan.balance <= 0) return { loan: { ...loan }, paid: 0, interest: 0 };
  const interest = eur(loan.balance * loan.ratePerFlight);
  const due = loan.balance + interest;
  const last = loan.flightsPaid + 1 >= loan.termFlights;
  const paid = last ? due : Math.min(loan.instalment, due);
  return {
    loan: { ...loan, balance: due - paid, flightsPaid: loan.flightsPaid + 1 },
    paid, interest
  };
}

/** Id del credit inicial, el primer prestec de la partida. */
export const STARTING_LOAN_ID = 'L0';

/** Punt de partida de la companyia en graduar-se. Vegeu la capcalera. */
export function startingCompany(company) {
  const L = BALANCE.startingLoan;
  return {
    ...company,
    cash: BALANCE.startingCash,
    reputation: BALANCE.reputation.start,
    bases: [BALANCE.startingBase],
    loans: [{ id: STARTING_LOAN_ID, ...makeLoan(L.principal, L.ratePerFlight, L.termFlights) }]
  };
}

/** Maneres de pagar un avio (G5). */
const PAYMENT_MODES = Object.freeze(['cash', 'financed']);

/** Quotes per vol de tots els prestecs vius. */
export function instalmentsPerFlight(loans) {
  return loans.reduce((sum, l) => sum + (l.balance > 0 ? l.instalment : 0), 0);
}

/** Regla de compra (G6): el que es paga ara i el coixi que ha de quedar. Vegeu la capcalera. */
export function purchaseRule({ cash, loans, price, mode }) {
  if (!PAYMENT_MODES.includes(mode)) throw new Error('purchaseRule: mode desconegut: ' + mode);
  checkEuros(price, 'price', 'purchaseRule');
  if (!Number.isFinite(cash)) throw new Error('purchaseRule: cash ha de ser un numero finit');
  const financed = mode === 'financed';
  const down = financed ? downPayment(price) : price;
  const loan = financed ? makeLoan(price - down) : null;
  const instalments = instalmentsPerFlight(loans) + (loan ? loan.instalment : 0);
  const reserve = BALANCE.financing.reserveFlights * instalments;
  const cashAfter = cash - down;
  const reason = cash < down ? 'cash' : cashAfter < reserve ? 'reserve' : null;
  return { ok: reason === null, reason, upfront: down, downPayment: financed ? down : 0, loan,
    instalments, reserve, cashAfter };
}

/** Id del prestec d un avio: 'L-' + reg, unic dins de loans. */
function aircraftLoanId(reg, loans) {
  const ids = new Set(loans.map(l => l.id));
  let id = 'L-' + reg;
  for (let n = 2; ids.has(id); n++) id = 'L-' + reg + '-' + n;
  return id;
}

/** Compra un anunci del mercat (G5-G8). Vegeu la capcalera. */
export function buyAircraft(state, listing, mode) {
  const ft = Object.hasOwn(BALANCE.fleetTypes, listing.typeId) ? BALANCE.fleetTypes[listing.typeId] : null;
  if (!ft) throw new Error('buyAircraft: typeId desconegut a BALANCE.fleetTypes: ' + listing.typeId);
  if (!state.pilot.ratings.includes(ft.rating)) return { ok: false, reason: 'rating' };
  const co = state.company;
  if (co.bases.length === 0) return { ok: false, reason: 'base' };
  const rule = purchaseRule({ cash: co.cash, loans: co.loans, price: listing.price, mode });
  if (!rule.ok) return { ok: false, reason: rule.reason };

  const loanId = rule.loan ? aircraftLoanId(listing.reg, co.loans) : null;
  const airframe = {
    reg: listing.reg, typeId: listing.typeId, tier: listing.tier, yearBuilt: listing.yearBuilt,
    hours: listing.hours, cycles: listing.cycles, condition: { ...listing.condition },
    location: co.bases[0], status: 'ready', groundedUntilMinute: 0,
    maintenance: { nextAHours: listing.maintenance.nextAHours, nextCHours: listing.maintenance.nextCHours, deferred: [] },
    finance: { purchasePrice: listing.price, loanId, leaseId: null },
    value: listing.price
  };
  const next = {
    ...state,
    company: { ...co, cash: co.cash - rule.upfront, loans: rule.loan ? [...co.loans, { id: loanId, ...rule.loan }] : co.loans },
    fleet: [...state.fleet, airframe]
  };
  if (state.market) next.market = { ...state.market, listings: state.market.listings.filter(l => l.reg !== listing.reg) };
  return { ok: true, state: next, airframe };
}

/** Cotitzacio de venda d un avio de la flota (G9). Vegeu la capcalera. */
export function sellQuote(state, reg) {
  const a = state.fleet.find(x => x.reg === reg);
  if (!a) return { ok: false, reason: 'unknown', quote: null, loanId: null, loanBalance: null, net: null };
  const M = BALANCE.market;
  const worth = priceOf(a.typeId, airframeTier(a), M.referenceYear - a.yearBuilt, a.condition);
  const quote = eur(Math.min(worth, a.finance.purchasePrice) * (1 - M.sellFee));   // K2
  const loanId = a.finance.loanId;
  const loan = loanId === null ? null : state.company.loans.find(l => l.id === loanId) ?? null;
  const loanBalance = loan ? loan.balance : 0;
  const net = quote - loanBalance;
  const reason = a.status !== 'ready' ? 'status' : state.company.cash + net < 0 ? 'cash' : null;
  return { ok: reason === null, reason, quote, loanId: loan ? loanId : null, loanBalance, net };
}

/** Ven un avio de la flota (G9). Vegeu la capcalera. */
export function sellAircraft(state, reg) {
  const q = sellQuote(state, reg);
  if (!q.ok) return { ok: false, reason: q.reason };
  const co = state.company;
  return {
    ok: true, quote: q.quote, loanBalance: q.loanBalance, net: q.net,
    state: {
      ...state,
      company: { ...co, cash: co.cash + q.net, loans: q.loanId === null ? co.loans : co.loans.filter(l => l.id !== q.loanId) },
      fleet: state.fleet.filter(a => a.reg !== reg)
    }
  };
}
