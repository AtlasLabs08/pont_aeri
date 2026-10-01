/* Genera src/world/airport-data.js amb les pistes reals dels aeroports de les
 * fases 1 i 2 (docs/DESIGN.md, F1), a partir d OurAirports.
 * Es l unic lloc del projecte que fa peticions de xarxa: el joc i les proves
 * nomes llegeixen el fitxer generat, que es comiteja.
 *
 * Correr:  node tools/airports-ourairports.mjs          (baixa els CSV)
 *          node tools/airports-ourairports.mjs <dir>    (llegeix <dir>/runways.csv
 *                                                        i <dir>/airports.csv)
 *
 * Regles (docs/DECISIONS.md, 2026-10-01, H2):
 *   - fora les pistes amb closed=1
 *   - peus a metres
 *   - si falta le_heading_degT, el rumb es calcula de les coordenades dels
 *     dos llindars
 *   - els ids dels caps (amb sufix L/R/C) van a ids
 * Les dades que no surten d OurAirports (nom curt, ILS, terreny) son a EXTRA.
 * La mida surt de BALANCE.airportSize (career/balance.js) i el nombre de
 * portes, de GATES_BY_LAYOUT.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BALANCE } from '../src/career/index.js';

const BASE = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'world', 'airport-data.js');
const FT_M = 0.3048;

/* mida de BALANCE -> disseny de la plataforma (H5): petit, mitja, gran */
const LAYOUT_BY_SIZE = { small: 'small', regional: 'medium', major: 'large', hub: 'large' };
const GATES_BY_LAYOUT = { small: 3, medium: 6, large: 10 };

/* el que no surt d OurAirports. ils: caps de pista amb ILS (H3). terrain (H6):
 * flatR = radi d aplanament en m al voltant del rectangle de l aeroport;
 * corridor = passadis d aproximacio sobre l eix allargat de cada cap (null si
 * no cal): len = m des del llindar on s acaba, edge = m de transicio lateral */
const EXTRA = {
  // LEGE: H3 diu "20". OurAirports numera la pista 01/19 (rumb veritable 14): el
  // cap 19 es el mateix cap fisic (aterratge cap a 194). Es manten l id de la font.
  LEGE: { name: 'Girona-Costa Brava', city: 'Girona', ils: ['19'], terrain: { flatR: 1500, corridor: null } },
  LERS: { name: 'Reus', city: 'Reus', ils: ['25'], terrain: { flatR: 1500, corridor: null } },
  LEIB: { name: 'Eivissa', city: 'Eivissa', ils: ['24'], terrain: { flatR: 1500, corridor: null } },
  LEMH: { name: 'Menorca', city: 'Maó', ils: ['01'], terrain: { flatR: 1500, corridor: null } },
  LELL: { name: 'Sabadell', city: 'Sabadell', ils: [], terrain: { flatR: 1500, corridor: null } },
  LEDA: { name: 'Lleida-Alguaire', city: 'Lleida', ils: ['31'], terrain: { flatR: 1500, corridor: null } },
  LESU: { name: 'La Seu d\'Urgell', city: 'La Seu d\'Urgell', ils: [], terrain: { flatR: 1500, corridor: null } }
};
const ORDER = ['LEGE', 'LERS', 'LEIB', 'LEMH', 'LELL', 'LEDA', 'LESU'];

/** CSV amb cometes (RFC 4180) -> files d objectes per capcalera */
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

async function load(dir, name) {
  if (dir) return readFileSync(join(dir, name), 'utf8');
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.text();
}

/** rumb inicial ortodromic (graus veritables) de (lat1, lon1) a (lat2, lon2) */
function bearing(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

const num = s => (s === '' || s === undefined ? null : Number(s));
const r1 = x => Math.round(x * 10) / 10, r6 = x => Math.round(x * 1e6) / 1e6;

export function buildData(airportsCsv, runwaysCsv) {
  const apts = parseCsv(airportsCsv), rwys = parseCsv(runwaysCsv), out = {};
  for (const icao of ORDER) {
    const a = apts.find(x => x.ident === icao);
    if (!a) throw new Error(`${icao}: no es a airports.csv`);
    const size = BALANCE.airportSize[icao] || BALANCE.demand.defaultSize, layout = LAYOUT_BY_SIZE[size], X = EXTRA[icao];
    const runways = rwys.filter(r => r.airport_ident === icao && r.closed !== '1').map(r => {
      const le = [num(r.le_latitude_deg), num(r.le_longitude_deg)], he = [num(r.he_latitude_deg), num(r.he_longitude_deg)];
      if (le.includes(null) || he.includes(null)) throw new Error(`${icao} ${r.le_ident}/${r.he_ident}: falten coordenades`);
      const hdg = num(r.le_heading_degT) ?? bearing(le[0], le[1], he[0], he[1]);
      return { ids: [r.le_ident, r.he_ident], hdg: r1(hdg), len: Math.round(num(r.length_ft) * FT_M), wid: Math.round(num(r.width_ft) * FT_M),
        le: [r6(le[0]), r6(le[1])], he: [r6(he[0]), r6(he[1])] };
    }).sort((x, y) => y.len - x.len);
    if (!runways.length) throw new Error(`${icao}: cap pista oberta`);
    for (const e of X.ils) if (!runways.some(r => r.ids.includes(e))) throw new Error(`${icao}: ILS ${e} no es cap cap de pista`);
    out[icao] = { icao, name: X.name, city: X.city, ref: [r6(num(a.latitude_deg)), r6(num(a.longitude_deg))],
      elev: r1(num(a.elevation_ft) * FT_M), size, layout, gates: GATES_BY_LAYOUT[layout], ils: X.ils, terrain: X.terrain, runways };
  }
  return out;
}

export function render(data) {
  const lines = Object.values(data).map(d => `  ${d.icao}: ${JSON.stringify(d)}`);
  return `/* generat per tools/airports-ourairports.mjs, no editar a ma.
 * Pistes d OurAirports (davidmegginson/ourairports-data), metres i graus
 * veritables. ILS, noms i terreny: taula EXTRA de l script. Mida: BALANCE.airportSize.
 *
 * EXPORTA: AIRPORT_DATA GATES_BY_LAYOUT
 */

export const GATES_BY_LAYOUT = ${JSON.stringify(GATES_BY_LAYOUT)};

export const AIRPORT_DATA = {
${lines.join(',\n')}
};
`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const dir = process.argv[2];
  const [ap, rw] = await Promise.all([load(dir, 'airports.csv'), load(dir, 'runways.csv')]);
  writeFileSync(OUT, render(buildData(ap, rw)));
  console.log('escrit', OUT);
}
