/* world/weather.js (F3): determinisme, rangs, distribucio i patrons locals.
 *
 * Correr:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { weatherFor, toGameWeather, WEATHER_PATTERNS, HARD_SEVERITY } from '../src/world/weather.js';
import { AIRPORT_ORDER } from '../src/world/airports.js';
import { BALANCE } from '../src/career/balance.js';

const SEED = 20260930;
const AIRPORTS = [...new Set([...AIRPORT_ORDER, ...Object.keys(BALANCE.airportSize),
  ...WEATHER_PATTERNS.flatMap(p => p.icao)])];

/** Totes les combinacions aeroport x mes x hora x 8 dies. */
function* sample(icaos = AIRPORTS, months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], hours = [...Array(24).keys()], days = 8) {
  for (const icao of icaos) for (const month of months) for (const hour of hours) for (let i = 0; i < days; i++) {
    const day = i * 37 + month * 3;
    yield weatherFor({ icao, month, hour, day, seed: SEED });
  }
}
const frac = (it, pred) => { let n = 0, k = 0; for (const w of it) { n++; if (pred(w)) k++; } return k / n; };
const range = (a, b) => v => v >= a && v <= b;

describe('weatherFor: determinisme i rangs', () => {
  test('mateixa entrada, mateixa sortida', () => {
    const inp = { icao: 'LEGE', month: 1, hour: 7, day: 123, seed: 9 };
    assert.deepEqual(weatherFor(inp), weatherFor({ ...inp }));
    assert.deepEqual([...sample(['LEBL'], [7], [15], 20)], [...sample(['LEBL'], [7], [15], 20)]);
  });

  test('la llavor, el dia, l hora i l aeroport canvien el resultat', () => {
    const base = { icao: 'LEMD', month: 3, hour: 10, day: 50, seed: 1 };
    const key = w => JSON.stringify(w);
    const outs = new Set([base, { ...base, seed: 2 }, { ...base, day: 51 }, { ...base, hour: 11 }, { ...base, icao: 'LEBL' }]
      .map(i => key(weatherFor(i))));
    assert.ok(outs.size >= 4);
  });

  test('tots els camps dins de rang i amb el tipus correcte', () => {
    for (const w of sample()) {
      assert.ok(Number.isInteger(w.windDirDeg) && range(0, 359)(w.windDirDeg), 'windDirDeg ' + w.windDirDeg);
      assert.ok(Number.isInteger(w.windKt) && range(0, 40)(w.windKt), 'windKt ' + w.windKt);
      assert.ok(Number.isInteger(w.gustKt) && w.gustKt >= w.windKt && w.gustKt <= 60, 'gustKt ' + w.gustKt);
      assert.ok(range(50, 10000)(w.visibilityM), 'visibilityM ' + w.visibilityM);
      assert.ok(w.ceilingFt === null || (Number.isInteger(w.ceilingFt) && range(100, 10000)(w.ceilingFt)), 'ceilingFt ' + w.ceilingFt);
      assert.ok(range(0, 1)(w.turbulence), 'turbulence ' + w.turbulence);
      assert.ok(range(0, 1)(w.severity), 'severity ' + w.severity);
      assert.equal(typeof w.hard, 'boolean');
      assert.equal(w.hard, w.severity >= HARD_SEVERITY);
      assert.ok(w.pattern === 'general' || WEATHER_PATTERNS.some(p => p.key === w.pattern), w.pattern);
    }
  });
});

describe('weatherFor: distribucio', () => {
  test('vent apreciable (>= 12 kt o ratxes >= 18 kt) en un 20 % +-4', () => {
    const f = frac(sample(), w => w.windKt >= 12 || w.gustKt >= 18);
    assert.ok(Math.abs(f - 0.20) <= 0.04, 'apreciable ' + f);
  });

  test('condicions dures en un 6,7 % +-2', () => {
    const f = frac(sample(), w => w.hard);
    assert.ok(Math.abs(f - 0.067) <= 0.02, 'hard ' + f);
  });

  test('la distribucio aguanta una altra llavor', () => {
    const it = (function* () {
      for (const icao of AIRPORTS) for (let m = 1; m <= 12; m++) for (let h = 0; h < 24; h++) for (let d = 0; d < 8; d++) {
        yield weatherFor({ icao, month: m, hour: h, day: d * 11 + m, seed: 5 });
      }
    })();
    const ws = [...it];
    assert.ok(Math.abs(frac(ws, w => w.windKt >= 12 || w.gustKt >= 18) - 0.20) <= 0.04);
    assert.ok(Math.abs(frac(ws, w => w.hard) - 0.067) <= 0.02);
  });
});

describe('weatherFor: patrons locals i estacionals', () => {
  const inKey = (key) => w => w.pattern === key;
  const WINTER = [11, 12, 1, 2], SUMMER = [6, 7, 8];
  const range24 = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], DAY = range24(0, 23);

  /** frequencia del patro dins (aeroport, mesos, hores) i a tres llocs de fora */
  function check(key, icao, months, hours, other = 'LEMD') {
    const inside = frac(sample([icao], months, hours, 20), inKey(key));
    const otherSeason = frac(sample([icao], ALL.filter(m => !months.includes(m)), hours, 20), inKey(key));
    const otherHours = frac(sample([icao], months, DAY.filter(h => !hours.includes(h)), 20), inKey(key));
    const otherAirport = frac(sample([other], months, hours, 20), inKey(key));
    assert.ok(inside >= 0.25, key + ' dins: ' + inside);
    assert.ok(inside >= 5 * otherSeason + 0.2, key + ' fora d estacio: ' + otherSeason);
    assert.ok(inside >= 5 * otherHours + 0.2, key + ' fora de franja: ' + otherHours);
    assert.equal(otherAirport, 0, key + ' a ' + other);
  }

  test('boira matinal a l hivern a Lleida i Girona', () => {
    check('fogMorning', 'LELL', WINTER, range24(5, 10));
    check('fogMorning', 'LEGE', WINTER, range24(5, 10));
    const f = [...sample(['LELL', 'LEGE'], WINTER, range24(5, 10), 20)].filter(inKey('fogMorning'));
    assert.ok(f.every(w => w.visibilityM <= 900 && w.ceilingFt <= 300 && w.windKt <= 4 && w.hard));
  });

  test('marinada de tarda a l estiu al Prat', () => {
    check('seaBreeze', 'LEBL', SUMMER, range24(12, 19));
    const ws = [...sample(['LEBL'], SUMMER, range24(12, 19), 20)].filter(inKey('seaBreeze'));
    assert.ok(ws.every(w => w.windDirDeg >= 140 && w.windDirDeg <= 180));
  });

  test('tramuntana a Girona: nord fort, sobretot a l hivern', () => {
    const winter = frac(sample(['LEGE'], [12, 1, 2], DAY, 20), inKey('tramuntana'));
    const summer = frac(sample(['LEGE'], SUMMER, DAY, 20), inKey('tramuntana'));
    const lleida = frac(sample(['LELL'], [12, 1, 2], DAY, 20), inKey('tramuntana'));
    assert.ok(winter >= 0.2, 'hivern ' + winter);
    assert.ok(winter >= 4 * summer, 'estiu ' + summer);
    assert.equal(lleida, 0);
    const ws = [...sample(['LEGE'], [12, 1, 2], DAY, 20)].filter(inKey('tramuntana'));
    assert.ok(ws.every(w => (w.windDirDeg >= 335 || w.windDirDeg <= 15) && w.windKt >= 20));
  });

  test('turbulencia termica de tarda a l estiu a la Seu d Urgell', () => {
    check('thermalTurb', 'LESU', SUMMER, range24(12, 18));
    const inside = [...sample(['LESU'], SUMMER, range24(12, 18), 20)];
    const outside = [...sample(['LESU'], WINTER, range24(12, 18), 20)];
    const mean = ws => ws.reduce((s, w) => s + w.turbulence, 0) / ws.length;
    assert.ok(mean(inside) >= mean(outside) + 0.2);
  });

  test('garbi (sud-oest) de tarda a l estiu a la costa', () => {
    check('garbi', 'LEPA', SUMMER, range24(13, 20));
    check('garbi', 'LEMG', SUMMER, range24(13, 20));
    const ws = [...sample(['LEPA'], SUMMER, range24(13, 20), 20)].filter(inKey('garbi'));
    assert.ok(ws.every(w => w.windDirDeg >= 210 && w.windDirDeg <= 240 && w.windKt >= 13));
  });

  test('els aeroports sense patro propi fan servir el general', () => {
    for (const icao of ['LEMD', 'LEZL', 'LECH']) {
      assert.ok(frac(sample([icao]), inKey('general')) === 1, icao);
    }
  });
});

describe('toGameWeather', () => {
  test('unitats de Game.opts: windDir 0..350 de 10 en 10, windKt enter 0..40, turb boolea', () => {
    for (const w of sample(['LEGE', 'LEBL', 'LESU'])) {
      const g = toGameWeather(w);
      assert.ok(g.windDir % 10 === 0 && range(0, 350)(g.windDir), 'windDir ' + g.windDir);
      assert.ok(Number.isInteger(g.windKt) && range(0, 40)(g.windKt));
      assert.equal(typeof g.turb, 'boolean');
      assert.equal(g.gustKt, w.gustKt);
      assert.equal(g.visibilityM, w.visibilityM);
      assert.equal(g.ceilingFt, w.ceilingFt);
    }
  });

  test('es pura i no toca l entrada', () => {
    const w = weatherFor({ icao: 'LEGE', month: 1, hour: 14, day: 3, seed: 1 });
    const copy = { ...w };
    assert.deepEqual(toGameWeather(w), toGameWeather(w));
    assert.deepEqual(w, copy);
    assert.equal(toGameWeather({ ...w, windDirDeg: 356 }).windDir, 0);
    assert.equal(toGameWeather({ ...w, windKt: 55 }).windKt, 40);
  });
});
