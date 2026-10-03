/* Palanca de gas a terra (src/core/ground-throttle.js, docs/DECISIONS.md 02/10/2026):
 *
 *   1. Reverse a ralenti: desactivar-lo baixa la palanca a ralenti, el reverse es desactiva
 *      quan hi arriba i l empenta queda a ralenti; activar-lo amb la palanca alta la baixa a
 *      ralenti i el reverse entra alla. Amb el ralenti de cada avio.
 *   2. Limitador de taxi: no passa de TAXI_LIMIT_KT amb el gas a fons; desactivat torna a
 *      accelerar; avis amb el gas a fons mes de TAXI_WARN_S segons sobre una pista.
 *
 * El bucle de la prova fa els mateixos passos que Game.step (index.html), amb les mateixes
 * funcions. Una darrera prova llegeix index.html com a text i comprova el cablejat.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AIRCRAFT, AIRCRAFT_ORDER, FlightModel, newCtl, FLAT_ENV, PHYS_DT,
  TAXI_LIMIT_KT, TAXI_WARN_S, TAXI_FULL_THR, leverIdle, reverseToggle, reverseUpdate, reverseCancel,
  makeTaxiLimiter, taxiToggle, taxiCap, governThrottle, taxiUpdate
} from '../src/core/index.js';
import { onRunwayAt, AIRPORTS } from '../src/world/index.js';

/** un pas com Game.step: transicio del reverse, limitador, fisica, palanca del jugador restaurada */
function tick(f, ctl, L, onRunway = false, env = FLAT_ENV) {
  reverseUpdate(ctl, PHYS_DT, leverIdle(f.cfg));
  const lever = ctl.throttle;
  taxiUpdate(L, PHYS_DT, { wow: f.wow, onRunway: onRunway && lever >= TAXI_FULL_THR, throttle: lever });
  ctl.throttle = governThrottle(L, ctl, f.out.gs, PHYS_DT);
  f.step(PHYS_DT, ctl, env);
  ctl.throttle = lever;
}
const run = (f, ctl, L, s, onRunway = false) => { for (let i = 0; i < Math.round(s / PHYS_DT); i++) tick(f, ctl, L, onRunway); };
const ground = id => { const f = new FlightModel(AIRCRAFT[id]); f.reset({ onGround: true, hdg: 0 }); return { f, ctl: newCtl(), L: makeTaxiLimiter() }; };

describe('reverse a ralenti', () => {
  for (const id of AIRCRAFT_ORDER) {
    test(`${id}: desactivar-lo baixa la palanca a ralenti i l empenta hi queda`, () => {
      const { f, ctl, L } = ground(id), idle = leverIdle(f.cfg);
      ctl.parkBrake = true; ctl.reverse = true; ctl.throttle = 0.9; run(f, ctl, L, 4);
      assert.equal(reverseToggle(ctl, idle), 'stowing');
      assert.equal(ctl.reverse, true, 'el reverse no es desactiva fins que la palanca arriba a ralenti');
      let guard = 0; while (ctl.reverse && guard++ < 120 * 10) tick(f, ctl, L);
      assert.equal(ctl.reverse, false);
      assert.equal(ctl.throttle, idle, 'el reverse es desactiva amb la palanca a ralenti');
      ctl.parkBrake = false; run(f, ctl, L, 20);
      assert.equal(ctl.throttle, idle, 'l empenta queda a ralenti fins que el jugador mou la palanca');
      assert.ok(f.out.gs < 5, `l avio no accelera endavant (gs ${f.out.gs.toFixed(1)} kt)`);
    });
    test(`${id}: activar-lo amb la palanca alta la baixa a ralenti i entra alla`, () => {
      const { f, ctl, L } = ground(id), idle = leverIdle(f.cfg);
      ctl.parkBrake = true; ctl.throttle = 0.9;
      assert.equal(reverseToggle(ctl, idle), 'arming');
      assert.equal(ctl.reverse, false, 'amb la palanca alta, el reverse no entra encara');
      let guard = 0; while (!ctl.reverse && guard++ < 120 * 10) { tick(f, ctl, L); assert.ok(f.revPos < 0.02, 'cap inversor s obre amb la palanca per sobre de ralenti'); }
      assert.equal(ctl.reverse, true);
      assert.equal(ctl.throttle, idle, 'el reverse entra a ralenti');
      run(f, ctl, L, 5);
      assert.equal(ctl.throttle, idle);
    });
  }
  test('a ralenti, activar-lo es immediat', () => {
    const { f, ctl } = ground('commuter');
    assert.equal(reverseToggle(ctl, leverIdle(f.cfg)), 'deployed'); assert.equal(ctl.reverse, true);
  });
  test('si el jugador mou la palanca durant la transicio, es cancel.la i l estat queda com estava', () => {
    const ctl = newCtl(); ctl.throttle = 0.9;
    reverseToggle(ctl, 0); reverseCancel(ctl); reverseUpdate(ctl, PHYS_DT, 0);
    assert.equal(ctl.reverse, false); assert.equal(ctl.throttle, 0.9);
    ctl.reverse = true; reverseToggle(ctl, 0); reverseCancel(ctl);
    for (let i = 0; i < 600; i++) reverseUpdate(ctl, PHYS_DT, 0);
    assert.equal(ctl.reverse, true); assert.equal(ctl.throttle, 0.9);
  });
  test('tornar a prémer durant la transicio la cancel.la', () => {
    const ctl = newCtl(); ctl.throttle = 0.9; reverseToggle(ctl, 0);
    assert.equal(reverseToggle(ctl, 0), 'cancelled'); assert.equal(ctl.revPending, null);
  });
  test('el ralenti surt de l avio (cfg.engines.leverIdle), no d un valor fix', () => {
    assert.equal(leverIdle({ engines: { leverIdle: 0.12 } }), 0.12);
    const ctl = newCtl(); ctl.throttle = 0.9; reverseToggle(ctl, 0.12);
    for (let i = 0; i < 1200; i++) reverseUpdate(ctl, PHYS_DT, 0.12);
    assert.equal(ctl.reverse, true); assert.equal(ctl.throttle, 0.12);
  });
});

describe('limitador de taxi', () => {
  for (const id of AIRCRAFT_ORDER) {
    test(`${id}: amb el gas a fons no passa de ${TAXI_LIMIT_KT} kt; desactivat, torna a accelerar`, () => {
      const { f, ctl, L } = ground(id);
      taxiToggle(L, f.wow); assert.equal(L.on, true);
      ctl.throttle = 1; let max = 0;
      for (let i = 0; i < 120 * 90; i++) { tick(f, ctl, L); max = Math.max(max, f.out.gs); }
      assert.ok(max <= TAXI_LIMIT_KT, `gs maxima ${max.toFixed(2)} kt`);
      assert.ok(max > TAXI_LIMIT_KT - 8, `el limitador deixa rodar (${max.toFixed(1)} kt)`);
      taxiToggle(L, f.wow); assert.equal(L.on, false);
      run(f, ctl, L, 25);
      assert.ok(f.out.gs > TAXI_LIMIT_KT + 5, `sense limitador accelera (${f.out.gs.toFixed(1)} kt)`);
    });
  }
  for (const id of AIRCRAFT_ORDER) {
    test(`${id}: tampoc amb 10 m/s de vent de cua`, () => {
      const { f, ctl, L } = ground(id), env = { ...FLAT_ENV, windN: 10 };
      taxiToggle(L, true); ctl.throttle = 1; let max = 0;
      for (let i = 0; i < 120 * 90; i++) { tick(f, ctl, L, false, env); max = Math.max(max, f.out.gs); }
      assert.ok(max <= TAXI_LIMIT_KT, `gs maxima ${max.toFixed(2)} kt`);
    });
  }
  test('la palanca del jugador no es toca: nomes l empenta que va a la fisica', () => {
    const { f, ctl, L } = ground('commuter'); taxiToggle(L, true); ctl.throttle = 1; run(f, ctl, L, 30);
    assert.equal(ctl.throttle, 1);
    assert.ok(taxiCap(1, TAXI_LIMIT_KT) === 0 && taxiCap(1, 0) === 1);
  });
  test('nomes s activa a terra', () => {
    const L = makeTaxiLimiter(); assert.equal(taxiToggle(L, false), false); assert.equal(L.on, false);
    assert.equal(taxiToggle(L, true), true); assert.equal(L.on, true);
  });
  test('en deixar el terra el limitador es deixa anar', () => {
    const L = makeTaxiLimiter(); taxiToggle(L, true); taxiUpdate(L, PHYS_DT, { wow: false, onRunway: false, throttle: 1 });
    assert.equal(L.on, false);
  });
  describe('avis', () => {
    const step = (L, s, o) => { for (let i = 0; i < Math.round(s / PHYS_DT); i++) taxiUpdate(L, PHYS_DT, { wow: true, onRunway: true, throttle: 1, ...o }); };
    test(`gas a fons mes de ${TAXI_WARN_S} s, actiu i a una pista: avis, i no es desactiva`, () => {
      const L = makeTaxiLimiter(); taxiToggle(L, true);
      step(L, TAXI_WARN_S - 0.1); assert.equal(L.warn, false);
      step(L, 0.3); assert.equal(L.warn, true); assert.equal(L.on, true);
      step(L, 30); assert.equal(L.on, true, 'no es desactiva sol');
    });
    test('sense limitador, fora de pista o sense gas a fons, no hi ha avis i el compte es reinicia', () => {
      const off = makeTaxiLimiter(); step(off, 10); assert.equal(off.warn, false);
      const L = makeTaxiLimiter(); taxiToggle(L, true);
      step(L, 10, { onRunway: false }); assert.equal(L.warn, false);
      step(L, 10, { throttle: 0.9 }); assert.equal(L.warn, false);
      step(L, 2); step(L, 1, { throttle: 0.5 }); step(L, 2); assert.equal(L.warn, false, 'el compte es reinicia');
      step(L, 4); assert.equal(L.warn, true);
      step(L, 0.1, { throttle: 0.5 }); assert.equal(L.warn, false);
    });
  });
});

describe('onRunwayAt', () => {
  test('el centre d una pista es pista; l aeroport lluny no', () => {
    const A = AIRPORTS.LEBL, en = A.allEnds[0], mid = A.toWorld(en.thr[0] + en.dir[0] * en.rw.len / 2, en.thr[1] + en.dir[1] * en.rw.len / 2);
    assert.equal(onRunwayAt(mid[0], mid[1]), true);
    assert.equal(onRunwayAt(A.e + 50000, A.n + 50000), false);
  });
});

describe('cablejat a index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  test('la tecla R i les tecles de gas fan servir la logica de core', () => {
    assert.match(html, /case 'KeyR': if \(f\.wow\) \{ const r = reverseToggle\(c, leverIdle\(f\.cfg\)\)/);
    assert.match(html, /reverseUpdate\(ctl, dt, leverIdle\(fdm\.cfg\)\)/);
    assert.doesNotMatch(html, /c\.throttle = Math\.min\(c\.throttle, 0\.05\)/, 'el valor fix de 0,05 no hi torna');
  });
  test('Digit1 commuta el limitador i Game.step governa la palanca', () => {
    assert.match(html, /case 'Digit1': if \(f\.wow\) \{ taxiToggle\(this\.taxi, true\)/);
    assert.match(html, /c\.throttle = governThrottle\(T, c, f\.out\.gs, PHYS_DT\);\s*f\.step\(PHYS_DT, c, this\.env\); c\.throttle = lever;/);
  });
  test('l indicador TAXI i l avis surten al HUD, a la cabina i a l avis', () => {
    assert.equal((html.match(/t\('hud\.taxiLimit'|i18nT\('hud\.taxiLimit'/g) || []).length, 3);
    assert.match(html, /S\.taxi\.warn\) w\.push\(t\('warn\.taxiLimitRunway'/);
  });
  test('Game.snapshot porta el limitador: la UI llegeix S.taxi a cada frame', () => {
    // sense el camp, S.taxi.on llancava a UI.frame i el HUD es quedava buit
    const snap = html.match(/^ {2}snapshot\(\) \{ return \{.*\}; \}$/m);
    assert.ok(snap, 'Game.snapshot() no trobat');
    assert.match(snap[0], /\btaxi: this\.taxi\b/);
  });
});
