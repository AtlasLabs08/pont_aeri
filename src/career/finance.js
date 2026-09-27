/* Compra d avions a terminis i prestecs amb quota per vol (DESIGN.md,
 * "Escala economica"). NOU: tasca B5 d ENGINEERING.md. Funcions pures: cap
 * no modifica el prestec que rep, en retornen un de nou. Aplicar-les a la
 * partida (restar la quota del cash a cada vol) es feina d app/.
 *
 * EXPORTA: downPayment makeLoan financeAircraft payInstalment
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
 */

import { BALANCE } from './balance.js';

/** euros enters; converteix -0 en 0 */
const eur = x => Math.round(x) || 0;

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
