/* Proves de career/finance.js (tasca B5): entrada, quota per vol i
 * amortitzacio dels prestecs. Els valors esperats son literals calculats a
 * ma a partir de BALANCE.financing (downPct 0,30, ratePerFlight 0,004,
 * termFlights 60), amb el calcul al comentari.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { downPayment, makeLoan, financeAircraft, payInstalment } from '../../src/career/index.js';

/** Paga quotes fins que el prestec queda tornat; retorna { loan, total, flights }. */
function payOff(loan) {
  let total = 0, flights = 0;
  while (loan.balance > 0) {
    const r = payInstalment(loan);
    loan = r.loan; total += r.paid; flights++;
    assert.ok(flights <= loan.termFlights, 'no s acaba dins del termini');
  }
  return { loan, total, flights };
}

describe('downPayment', () => {
  test('30 % del preu, en euros enters', () => {
    // 8.000.000 * 0,30 = 2.400.000; 350.000 * 0,30 = 105.000
    assert.equal(downPayment(8000000), 2400000);
    assert.equal(downPayment(350000), 105000);
    // 1.000.001 * 0,30 = 300.000,3 -> 300.000
    assert.equal(downPayment(1000001), 300000);
    assert.equal(downPayment(0), 0);
  });

  test('preu no enter, negatiu o no numeric llanca', () => {
    for (const p of [-1, 1.5, NaN, Infinity, undefined, '100']) {
      assert.throws(() => downPayment(p), /downPayment: price/, String(p));
    }
  });
});

describe('makeLoan', () => {
  test('quota constant: 5.600.000 a 60 vols al 0,4 % -> 105.167', () => {
    // 5.600.000 * 0,004 / (1 - 1,004^-60) = 105.166,55 -> 105.167
    assert.deepEqual(makeLoan(5600000), {
      principal: 5600000, balance: 5600000, ratePerFlight: 0.004, termFlights: 60,
      instalment: 105167, flightsPaid: 0
    });
  });

  test('taxa i termini propis: el credit inicial de 250.000 a 60 vols -> 4.695', () => {
    // 250.000 * 0,004 / (1 - 1,004^-60) = 4.694,94 -> 4.695
    assert.equal(makeLoan(250000, 0.004, 60).instalment, 4695);
  });

  test('sense interes: principal / termini', () => {
    // 1.000 / 3 = 333,33 -> 333
    assert.equal(makeLoan(1000, 0, 3).instalment, 333);
  });

  test('entrades invalides llancen', () => {
    assert.throws(() => makeLoan(-1), /principal/);
    assert.throws(() => makeLoan(100.5), /principal/);
    assert.throws(() => makeLoan(1000, -0.1, 10), /ratePerFlight/);
    assert.throws(() => makeLoan(1000, NaN, 10), /ratePerFlight/);
    assert.throws(() => makeLoan(1000, 0.004, 0), /termFlights/);
    assert.throws(() => makeLoan(1000, 0.004, 2.5), /termFlights/);
  });
});

describe('financeAircraft', () => {
  test('un M-200 de 8.000.000: 2.400.000 d entrada i 5.600.000 a terminis', () => {
    const { downPayment: down, loan } = financeAircraft(8000000);
    assert.equal(down, 2400000);
    assert.equal(loan.principal, 5600000);
    assert.equal(loan.instalment, 105167);
  });
});

describe('payInstalment', () => {
  test('primera quota: interes 22.400 i el balanc baixa 82.767', () => {
    // interes = 5.600.000 * 0,004 = 22.400; balanc = 5.600.000 + 22.400 - 105.167
    const loan = makeLoan(5600000);
    const r = payInstalment(loan);
    assert.equal(r.interest, 22400);
    assert.equal(r.paid, 105167);
    assert.equal(r.loan.balance, 5517233);
    assert.equal(r.loan.flightsPaid, 1);
    assert.equal(loan.balance, 5600000, 'no modifica el prestec d entrada');
  });

  test('es torna exactament en termFlights vols, sense resta', () => {
    const { loan, flights, total } = payOff(makeLoan(5600000));
    assert.equal(flights, 60);
    assert.equal(loan.balance, 0);
    // 60 quotes de ~105.167: el total es principal + interessos, en euros enters
    assert.ok(Number.isInteger(total) && Math.abs(total - 60 * 105167) < 60);
  });

  test('sense interes: 333 + 333 + 334', () => {
    let loan = makeLoan(1000, 0, 3);
    const paid = [];
    for (let i = 0; i < 3; i++) { const r = payInstalment(loan); paid.push(r.paid); loan = r.loan; }
    assert.deepEqual(paid, [333, 333, 334]);
    assert.equal(loan.balance, 0);
  });

  test('un prestec tornat no cobra res', () => {
    const r = payInstalment({ ...makeLoan(1000, 0, 1), balance: 0, flightsPaid: 1 });
    assert.deepEqual([r.paid, r.interest, r.loan.balance], [0, 0, 0]);
  });
});
