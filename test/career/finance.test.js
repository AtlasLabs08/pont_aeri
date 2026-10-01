/* Proves de career/finance.js (tasca B5): entrada, quota per vol i
 * amortitzacio dels prestecs. Els valors esperats son literals calculats a
 * ma a partir de BALANCE.financing (downPct 0,30, ratePerFlight 0,004,
 * termFlights 340), amb el calcul al comentari. Les proves d amortitzacio
 * fan servir un termini explicit de 60 vols.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  downPayment, makeLoan, financeAircraft, payInstalment, BALANCE, createCareer, graduate, LESSONS, validate,
  refreshMarket, priceOf, instalmentsPerFlight, purchaseRule, buyAircraft, sellQuote, sellAircraft, STARTING_LOAN_ID
} from '../../src/career/index.js';

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
    assert.deepEqual(makeLoan(5600000, 0.004, 60), {
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
    // termini de BALANCE.financing: 5.600.000 * 0,004 / (1 - 1,004^-340) = 30.162,58 -> 30.163
    assert.equal(loan.termFlights, 340);
    assert.equal(loan.instalment, 30163);
  });
});

describe('payInstalment', () => {
  test('primera quota: interes 22.400 i el balanc baixa 82.767', () => {
    // interes = 5.600.000 * 0,004 = 22.400; balanc = 5.600.000 + 22.400 - 105.167
    const loan = makeLoan(5600000, 0.004, 60);
    const r = payInstalment(loan);
    assert.equal(r.interest, 22400);
    assert.equal(r.paid, 105167);
    assert.equal(r.loan.balance, 5517233);
    assert.equal(r.loan.flightsPaid, 1);
    assert.equal(loan.balance, 5600000, 'no modifica el prestec d entrada');
  });

  test('es torna exactament en termFlights vols, sense resta', () => {
    const { loan, flights, total } = payOff(makeLoan(5600000, 0.004, 60));
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

  test('a mig pagar, l ultima quota del termini salda un balanc mes gran que la quota', () => {
    // 10.000 a 10 vols i 0,01: quota 1.056. Despres de 5 quotes queda la
    // meitat, i el prestec arriba al vol 10 (flightsPaid 9) amb aquest saldo
    let loan = { id: 'L7', ...makeLoan(10000, 0.01, 10) };
    for (let i = 0; i < 5; i++) loan = payInstalment(loan).loan;
    loan = { ...loan, flightsPaid: 9 };
    assert.ok(loan.balance > loan.instalment, 'saldo ' + loan.balance + ' > quota ' + loan.instalment);
    const r = payInstalment(loan);
    assert.equal(r.interest, Math.round(loan.balance * 0.01));
    assert.equal(r.paid, loan.balance + r.interest);
    assert.ok(r.paid > loan.instalment);
    assert.equal(r.loan.balance, 0);
    assert.equal(r.loan.flightsPaid, 10);
    assert.equal(r.loan.id, 'L7', 'conserva l id');
  });

    test('un prestec tornat no cobra res', () => {
    const r = payInstalment({ ...makeLoan(1000, 0, 1), balance: 0, flightsPaid: 1 });
    assert.deepEqual([r.paid, r.interest, r.loan.balance], [0, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// D2+D5: compra i venda (docs/DECISIONS.md, 30/09/2026, G5-G9)

/** Partida acabada de graduar (startingCompany), amb el mercat generat. */
function graduated(seed = 314159) {
  const s = createCareer({ name: 'Compres', seed, createdAt: '' });
  return refreshMarket(graduate({ ...s, school: { ...s.school, lessonsPassed: LESSONS.map(l => l.id) } }));
}

/** Anunci fet a ma per a les proves de limit. */
function listing(extra) {
  return {
    reg: 'EC-TST', typeId: 'commuter', tier: 'premium', yearBuilt: 2015, hours: 13000, cycles: 16250,
    condition: { engines: 90, gear: 88, airframe: 91, avionics: 86 },
    maintenance: { nextAHours: 13100, nextCHours: 15000 }, price: 360000, ...extra
  };
}

const R = BALANCE.financing.reserveFlights;

describe('instalmentsPerFlight i purchaseRule (G5, G6)', () => {
  test('suma les quotes dels prestecs vius', () => {
    const loans = [{ ...makeLoan(100000), id: 'a' }, { ...makeLoan(200000), id: 'b' }, { ...makeLoan(50000), balance: 0, id: 'c' }];
    assert.equal(instalmentsPerFlight(loans), makeLoan(100000).instalment + makeLoan(200000).instalment);
    assert.equal(instalmentsPerFlight([]), 0);
  });

  test('al comptat: es paga el preu sencer, sense prestec', () => {
    const loans = [{ ...makeLoan(250000), id: 'L0' }];
    const r = purchaseRule({ cash: 400000, loans, price: 350000, mode: 'cash' });
    assert.equal(r.ok, true);
    assert.equal(r.upfront, 350000);
    assert.equal(r.downPayment, 0);
    assert.equal(r.loan, null);
    assert.equal(r.instalments, loans[0].instalment);
    assert.equal(r.reserve, R * loans[0].instalment);
    assert.equal(r.cashAfter, 50000);
  });

  test('financat: entrada i prestec amb BALANCE.financing, i la quota nova compta a Q', () => {
    const r = purchaseRule({ cash: 400000, loans: [], price: 350000, mode: 'financed' });
    const f = financeAircraft(350000);
    assert.equal(r.upfront, f.downPayment);
    assert.equal(r.downPayment, f.downPayment);
    assert.deepEqual(r.loan, f.loan);
    assert.equal(r.instalments, f.loan.instalment);
  });

  test('al limit exacte passa; amb 1 EUR menys, no (comptat i financat)', () => {
    const loans = [{ ...makeLoan(250000), id: 'L0' }];
    const q0 = loans[0].instalment;
    const price = 1800000;
    // comptat: cash - preu >= R * Q
    const cashLimit = price + R * q0;
    assert.equal(purchaseRule({ cash: cashLimit, loans, price, mode: 'cash' }).ok, true);
    assert.deepEqual([purchaseRule({ cash: cashLimit - 1, loans, price, mode: 'cash' }).ok,
      purchaseRule({ cash: cashLimit - 1, loans, price, mode: 'cash' }).reason], [false, 'reserve']);
    // financat: cash - entrada >= R * (Q + quota nova)
    const f = financeAircraft(price);
    const finLimit = f.downPayment + R * (q0 + f.loan.instalment);
    assert.equal(purchaseRule({ cash: finLimit, loans, price, mode: 'financed' }).ok, true);
    assert.deepEqual([purchaseRule({ cash: finLimit - 1, loans, price, mode: 'financed' }).ok,
      purchaseRule({ cash: finLimit - 1, loans, price, mode: 'financed' }).reason], [false, 'reserve']);
  });

  test('sense diners per pagar, el motiu es cash', () => {
    assert.equal(purchaseRule({ cash: 100, loans: [], price: 350000, mode: 'cash' }).reason, 'cash');
    assert.equal(purchaseRule({ cash: 100, loans: [], price: 350000, mode: 'financed' }).reason, 'cash');
  });

  test('llanca amb un mode desconegut o un preu que no es un enter', () => {
    assert.throws(() => purchaseRule({ cash: 1, loans: [], price: 1, mode: 'lease' }), /mode/);
    assert.throws(() => purchaseRule({ cash: 1, loans: [], price: 1.5, mode: 'cash' }), /price/);
  });
});

describe('buyAircraft (G5, G7, G8)', () => {
  test('al comptat: cash, sense prestec, Airframe amb els camps de l anunci i tier; l anunci surt', () => {
    const s = graduated(), before = structuredClone(s);
    const l = s.market.listings.find(x => x.typeId === 'commuter' && x.tier === 'basic');
    const r = buyAircraft(s, l, 'cash');
    assert.equal(r.ok, true);
    assert.deepEqual(s, before, 'no modifica l entrada');
    const n = r.state;
    assert.equal(n.company.cash, s.company.cash - l.price);
    assert.deepEqual(n.company.loans, s.company.loans);
    assert.deepEqual(n.fleet, [{
      reg: l.reg, typeId: 'commuter', tier: 'basic', yearBuilt: l.yearBuilt, hours: l.hours, cycles: l.cycles,
      condition: l.condition, location: BALANCE.startingBase, status: 'ready', groundedUntilMinute: 0,
      maintenance: { nextAHours: l.maintenance.nextAHours, nextCHours: l.maintenance.nextCHours, deferred: [] },
      finance: { purchasePrice: l.price, loanId: null, leaseId: null }, value: l.price
    }]);
    assert.deepEqual(r.airframe, n.fleet[0]);
    assert.ok(!n.market.listings.some(x => x.reg === l.reg));
    assert.equal(n.market.listings.length, s.market.listings.length - 1);
    assert.deepEqual(validate(n), { ok: true, errors: [] });
  });

  test('financat: entrada, prestec L-<reg> amb makeLoan, i loanId a l Airframe', () => {
    const s = graduated();
    const l = s.market.listings.find(x => x.typeId === 'commuter' && x.tier === 'standard');
    const r = buyAircraft(s, l, 'financed');
    assert.equal(r.ok, true);
    const f = financeAircraft(l.price);
    assert.equal(r.state.company.cash, s.company.cash - f.downPayment);
    assert.deepEqual(r.state.company.loans, [...s.company.loans, { id: 'L-' + l.reg, ...f.loan }]);
    assert.equal(r.airframe.finance.loanId, 'L-' + l.reg);
    assert.equal(r.airframe.tier, 'standard');
    assert.equal(r.airframe.value, l.price);
    assert.deepEqual(validate(r.state), { ok: true, errors: [] });
  });

  test('en graduar-se, un Mi-9 basic es pot comprar al comptat i financat', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = graduated(seed);
      const l = s.market.listings.find(x => x.typeId === 'commuter' && x.tier === 'basic');
      assert.ok(l, 'hi ha un Mi-9 basic, llavor ' + seed);
      assert.equal(buyAircraft(s, l, 'cash').ok, true, 'comptat, llavor ' + seed);
      assert.equal(buyAircraft(s, l, 'financed').ok, true, 'financat, llavor ' + seed);
      assert.equal(s.company.loans[0].id, STARTING_LOAN_ID);
    }
  });

  test('sense l habilitacio del tipus no es pot comprar (G7)', () => {
    const s = graduated();
    const l = listing({ typeId: 'tp', price: 1000 });
    assert.deepEqual(buyAircraft(s, l, 'cash'), { ok: false, reason: 'rating' });
    assert.deepEqual(buyAircraft(s, l, 'financed'), { ok: false, reason: 'rating' });
    s.pilot.ratings = [...s.pilot.ratings, 'turboprop'];
    assert.equal(buyAircraft(s, l, 'cash').ok, true);
  });

  test('regla de G6 al limit exacte i amb 1 EUR menys, a les dues modalitats', () => {
    const s = graduated(), l = listing();
    const q0 = instalmentsPerFlight(s.company.loans);
    const at = cash => ({ ...s, company: { ...s.company, cash } });
    const cashLimit = l.price + R * q0;
    assert.equal(buyAircraft(at(cashLimit), l, 'cash').ok, true);
    assert.equal(buyAircraft(at(cashLimit), l, 'cash').state.company.cash, R * q0);
    assert.deepEqual(buyAircraft(at(cashLimit - 1), l, 'cash'), { ok: false, reason: 'reserve' });
    const f = financeAircraft(l.price);
    const finLimit = f.downPayment + R * (q0 + f.loan.instalment);
    assert.equal(buyAircraft(at(finLimit), l, 'financed').ok, true);
    assert.deepEqual(buyAircraft(at(finLimit - 1), l, 'financed'), { ok: false, reason: 'reserve' });
  });

  test('sense base no es pot comprar; sense mercat, la partida continua sense', () => {
    const s = graduated();
    assert.deepEqual(buyAircraft({ ...s, company: { ...s.company, bases: [] } }, listing(), 'cash'), { ok: false, reason: 'base' });
    const noMarket = { ...s };
    delete noMarket.market;
    const r = buyAircraft(noMarket, listing(), 'cash');
    assert.equal(r.ok, true);
    assert.equal(r.state.market, undefined);
  });
});

describe('sellQuote i sellAircraft (G9)', () => {
  /** Partida amb un avio comprat d aquest anunci i aquesta modalitat. */
  function owning(mode, extra) {
    const r = buyAircraft(graduated(), listing(extra), mode);
    assert.equal(r.ok, true);
    return r.state;
  }
  const quoteOf = a => Math.round(priceOf(a.typeId, a.tier ?? 'standard', BALANCE.market.referenceYear - a.yearBuilt, a.condition) *
    (1 - BALANCE.market.sellFee));

  test('cotitzacio: priceOf amb l estat actual menys sellFee; sense prestec, net = cotitzacio', () => {
    const s = owning('cash');
    s.fleet[0].condition = { engines: 70, gear: 60, airframe: 80, avionics: 75 };
    const q = sellQuote(s, 'EC-TST');
    assert.equal(q.ok, true);
    assert.equal(q.quote, quoteOf(s.fleet[0]));
    assert.deepEqual([q.loanId, q.loanBalance, q.net], [null, 0, q.quote]);
    const r = sellAircraft(s, 'EC-TST');
    assert.equal(r.ok, true);
    assert.equal(r.state.company.cash, s.company.cash + q.quote);
    assert.deepEqual(r.state.fleet, []);
    assert.deepEqual(validate(r.state), { ok: true, errors: [] });
  });

  test('un avio sense tier cotitza com a standard', () => {
    const s = owning('cash');
    delete s.fleet[0].tier;
    const std = owning('cash', { tier: 'standard' });
    assert.equal(sellQuote(s, 'EC-TST').quote, sellQuote(std, 'EC-TST').quote);
  });

  test('es cancel.la el capital pendent del prestec de l avio: net = cotitzacio - pendent', () => {
    const s = owning('financed');
    const loan = s.company.loans.find(l => l.id === 'L-EC-TST');
    const q = sellQuote(s, 'EC-TST');
    assert.deepEqual([q.loanId, q.loanBalance, q.net], ['L-EC-TST', loan.balance, q.quote - loan.balance]);
    const r = sellAircraft(s, 'EC-TST');
    assert.equal(r.state.company.cash, s.company.cash + q.net);
    assert.deepEqual(r.state.company.loans.map(l => l.id), [STARTING_LOAN_ID]);
    assert.deepEqual(r.state.fleet, []);
  });

  test('bloquejada si cash + net < 0', () => {
    // un basic comprat car i gastat del tot: cotitza 0,6 * 350.000 * 0,9 = 189.000, i en deu 196.000
    const s = owning('financed', { tier: 'basic', price: 280000 });
    s.fleet[0].condition = { engines: 0, gear: 0, airframe: 0, avionics: 0 };
    s.fleet[0].yearBuilt = 1990;
    const q = sellQuote(s, 'EC-TST');
    assert.equal(q.quote, 189000);
    assert.equal(q.loanBalance, 196000);
    assert.equal(q.net, -7000);
    const at = cash => ({ ...s, company: { ...s.company, cash } });
    assert.equal(sellQuote(at(-q.net), 'EC-TST').ok, true);
    assert.equal(sellQuote(at(-q.net - 1), 'EC-TST').reason, 'cash');
    assert.deepEqual(sellAircraft(at(-q.net - 1), 'EC-TST'), { ok: false, reason: 'cash' });
  });

  test('bloquejada si status no es ready; matricula desconeguda', () => {
    for (const status of ['maintenance', 'dispatched', 'inFlight']) {
      const s = owning('cash');
      s.fleet[0].status = status;
      assert.deepEqual(sellAircraft(s, 'EC-TST'), { ok: false, reason: 'status' }, status);
    }
    assert.equal(sellQuote(owning('cash'), 'EC-ZZZ').reason, 'unknown');
  });
});
