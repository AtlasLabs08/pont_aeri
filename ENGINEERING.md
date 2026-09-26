# Pont Aeri — Especificació d'enginyeria

Document de referència per a qualsevol agent que escrigui codi en aquest
repositori. Descriu el codi **tal com és avui** (26/09/2026, commit `d302e63`
a `dev`) i l'ordre de feina per construir el mode Airline.

- El disseny de joc (economia, progressió, escola de vol, contingut) és a
  `docs/DESIGN.md`.
- La història de la migració a mòduls és a `MIGRACIO.md`.
- Les decisions preses són a `docs/DECISIONS.md`. Les idees aparcades, a
  `docs/BACKLOG.md`. **Cap agent no pot implementar res que sigui al backlog.**

---

## 0. Regles per a l'agent

Llegeix aquesta secció abans de tocar res. Són obligatòries.

1. **`npm test` ha d'estar en verd abans i després de cada canvi.**
   Si en trenques una, el canvi no està acabat.
2. **Mai regeneris `test/snapshot.json`** (`node test/snapshot.test.js --update`)
   si la tasca no diu explícitament que canvia la física. Fer passar la prova
   canviant la referència és l'única trampa que invalida tot el sistema.
3. **Refactor i funcionalitat mai al mateix commit.** Si mous codi, només el
   mous. Si veus una millora, apunta-la a `docs/BACKLOG.md` i segueix.
4. **Cap constant econòmica fora de `src/career/balance.js`.** A la resta de
   `career/` només es permeten constants d'unitats amb nom
   (`SECONDS_PER_HOUR`, `KG_PER_TONNE`, escales 0–100), mai valors econòmics.
5. **Cap `Math.random()` a `src/career/`.** Vegeu §7.
6. **Respecta la taula de dependències de §3.** `career/` no toca el navegador.
7. **Cap text visible nou fora de `src/i18n/`.** Vegeu §9.
8. **Si una tasca sembla exigir trencar un contracte d'aquest document,
   atura't i explica-ho** en comptes de decidir-ho tu.
9. **Puja nomes la teva branca i obre un PR contra `dev`.** Mai facis
   push a `dev` ni a `main`: GitHub ho bloqueja igualment.

---

## 1. Estat actual

### Estructura

```
index.html            2.627 línies. Seccions 8c–20: tot el que toca el navegador.
                      Un <script type="module"> que importa de src/.
src/core/             Simulador headless, sense window/document/THREE
  constants.js  noise.js  atmosphere.js  aircraft-data.js
  flight-model.js  trim.js  autopilot.js  harness.js
  index.js            barrel: la resta del joc importa d'aquí
src/world/            Món headless
  geo.js  airports.js  terrain.js  ils.js  index.js
test/
  smoke.test.js       els mòduls carreguen i exporten el que toca
  harness.test.js     cada fila del harness dins del seu rang
  snapshot.test.js    cada mètrica idèntica a snapshot.json (fins a 10 decimals)
  snapshot.json       instantània de precisió completa, regenerada post-migració
docs/  DECISIONS.md  BACKLOG.md
MIGRACIO.md  vite.config.js  package.json  .node-version
```

### Què queda a `index.html`

| Secció | Línies aprox. | Símbols |
| --- | --- | --- |
| 8c Escenari fotogràfic | 143–259 | `Photo` (injectat a `world/terrain.js` amb `setPhoto`) |
| 9 Shaders | 260–617 | `SHADERS` |
| 10 Render | 618–1021 | `QUALITY R3 anchor unanchor setOrigin updateOrigin mergeGeos xf noiseTexture initRenderer patchFog fogHook applyQuality onResize SKYCFG celestial SkyJS Env Sea Terrain` |
| 11 Escenografia d'aeroport | 1022–1178 | `Clouds GLYPHS makeBuildingMaterial makeLightMaterial LightSet AirportScenery airportSegContains` |
| 12 Ciutats | 1179–1285 | `Scenery` |
| 13 Models d'avió | 1286–1488 | `MODEL_GEOM AircraftModel` |
| 14 Instruments | 1489–1731 | `Instruments` |
| 15 Cabina 3D | 1732–1833 | `Cockpit` |
| 16 Entrada | 1834–1876 | `Input` |
| 17 Càmeres | 1877–1918 | `Cameras` |
| 18 Estat de joc | 1919–2115 | `Game` |
| 18b HUD | 2116–2266 | `HUD` |
| 18c So | 2267–2442 | `Sound Callouts` |
| 19 Bucle | 2443–2491 | `Main` |
| 20 Interfície | 2492–2621 | `Best UI` |
| — Etiqueta DEV | final | `<script>` clàssic, `IS_DEV` |

`THREE` és global del CDN, r128. `package.json` ja té `three@^0.128.0` fixat
per al dia que es faci `import * as THREE from 'three'`: **no el pugis de
versió**, la r129+ canvia per defecte la llum i els colors.

### Peces de `Game` que el mode Airline ha de fer servir

- `Game.opts` — configuració del vol. Airline no hi afegeix camps: construeix
  un `opts` i el passa.
- `Game.spawn()` — inicia un vol.
- `Game.step()` — un pas de física (`PHYS_DT`). Aquí es mostreja el vol.
- `Game.onTouchdown()` — omple `Game.report`: `fpm g bounces ias pitch roll
  onRunway rwy tdzDist fromThr center crab remaining`, i més tard `rollout`.
- `Game.scoreReport(R)` — retorna `{ score, comment, pts }`, amb `pts` =
  `{ sink, g, zone, center, attitude }`. **Airline consumeix aquesta nota, no la
  recalcula.**
- `Game.crashNow(title, detail)` — accident. `Game.tailStrike` és a part.
- `Game.flight` — `{ mode, t, started, airborne, maxAlt, from, to, done, landings }`.
- `Game.timeAccel` i `Game.cycleAccel()` — ja existeix acceleració fins a ×16
  per sobre de 10.000 ft, i torna a ×1 per sota.

### Entorns

| Branca | On es publica | Com |
| --- | --- | --- |
| `main` | atlaslabs08.github.io/pont_aeri/ | GitHub Actions: `npm ci`, `npm test`, `vite build`, Pages |
| `dev` | pont-aeri.pages.dev | Cloudflare: `npm test && npm run build`, sortida `dist` |
| qualsevol altra | `<hash>.pont-aeri.pages.dev` | Cloudflare, previsualització automàtica |

El workflow `CI` passa proves i build a **cada PR**, sigui quina sigui la
branca de destinació. Node 22 a `.node-version` i als dos workflows: si es
canvia, es canvia als tres llocs alhora.

---

## 2. Convencions ja establertes

Segueix-les. No són suggeriments.

- **Capçalera de cada fitxer de `src/`**, en aquest ordre: descripció d'una o
  dues línies; `ORIGEN:` si és codi mogut; `EXPORTA:`; `IMPORTA:` si no és
  obvi; `INTERFICIE (no la canviis, els tests en depenen):` si altres mòduls o
  proves en depenen. Comentaris en català, sense accents, com la resta de `src/`.
- **Un barrel `index.js` per capa.** Fora de la capa s'importa del barrel, mai
  d'un fitxer solt.
- **Injecció de dependències per trencar la frontera amb el navegador.** El
  patró de referència és `setPhoto()` a `world/terrain.js`: la capa headless
  declara un marcador de posició amb el comportament per defecte, i
  `index.html` hi injecta la peça real. Tot lligam nou entre capes headless i
  navegador es fa així.
- **Branques** `tipus/descripcio-curta` i **commits** `tipus: descripció`, amb
  `tipus` = `feat fix refactor chore test docs`.
- **Un fitxer = un commit** durant qualsevol moviment de codi.
- **Decisions** a `docs/DECISIONS.md`, una entrada datada per decisió.

---

## 3. Arquitectura objectiu

```
src/
  core/        EXISTEIX. Simulador headless.
  world/       EXISTEIX. Món headless.
  career/      NOU. Lògica del mode Airline. Funcions pures.
  i18n/        NOU. t(), en.js, ca.js.
  platform/    NOU. L'únic lloc de src/ que pot tocar APIs del navegador
               (localStorage, location, Intl si cal).
  app/         NOU. Orquestració: carrega i desa la partida, aplica les
               funcions de career/, emet esdeveniments.
  ui/          NOU. Pantalles del mode Airline.
  render/      FUTUR (bloc M). Seccions 8c–13 d'index.html.
```

### Dependències permeses

| Capa | Pot importar |
| --- | --- |
| `core/` | `core/` |
| `world/` | `core/` |
| `career/` | `core/`, `world/` (només dades i utilitats) |
| `i18n/` | res |
| `platform/` | res |
| `app/` | `career/`, `platform/`, `i18n/`, `core/`, `world/` |
| `ui/` | tot menys `render/` |
| `index.html` | tot |
| `test/`, `tools/` | tot menys `ui/` i `render/`. `platform/` només es prova amb dobles injectats a `globalThis` |

`career/` ha de poder córrer sencer a Node sense cap mock del navegador.

### Com parlen Airline i el simulador

`Game` viu a `index.html` fins al bloc M. Per no crear imports circulars:

- `app/` exporta `setFlightLauncher(fn)`. `index.html` hi injecta una funció
  que rep un `opts`, el copia a `Game.opts` i crida `Game.spawn()`.
- En acabar un vol, `index.html` crida `app.onFlightFinished(record)` amb el
  `FlightRecord` de §4.
- `app/bus.js`: `on(topic, fn)`, `off(topic, fn)`, `emit(topic, payload)`.
  `ui/` s'hi subscriu. Temes: `career:changed`, `flight:finished`,
  `dispatch:resolved`, `rank:up`, `save:error`.

---

## 4. El contracte central: `FlightRecord`

És l'única cosa que el simulador envia a Airline. Cap mòdul de `career/` no
toca `FlightModel`, `Game` ni el render.

### `src/core/flight-recorder.js`

Headless, provable a Node alimentant-lo amb un `FlightModel`.

**Implementat (A3).** L'API i el comportament de referència són a la
capçalera del fitxer; les proves, a `test/recorder.test.js`.

```js
export class FlightRecorder {
  start(meta)              // { aircraftTypeId, from, to, fuelPlannedKg, paxOnBoard, plannedArrivalMin }
  sample(f, ctl, dt)       // un cop per pas de física, DESPRÉS de f.step()
  setTimeAccel(k)  cruiseSkip(fuelKg?)  event(type)  tailStrike()  rollout(metres)
  touchdown(report, score) // Game.report + Game.scoreReport(report)
  crash(cause)             // un de CRASH_CAUSES; si no ho és, queda 'fuselage'
  finish({ arrivalMin }) -> FlightRecord   // objecte pla i nou a cada crida
}
export const CRASH_CAUSES, EVENT_TYPES, RECORD_KEYS
```

Tres regles per a qui l'enganxi a `Game` (A4):

- **`touchdown()` es crida quan `Game` calcula la nota** (la branca
  `report.shown`), no a `onTouchdown()`: el pic de g i els rebots encara
  s'actualitzen durant 1,5 s després del contacte.
- **No es mostreja durant una repetició** (`Game.state === 'replay'`): quan
  acaba, `fdmRestore` torna el model enrere i el vol no ha passat de debò.
- El combustible s'integra (`f.out.ff * dt`), no es resta del dipòsit, per no
  falsejar-lo quan es restaura l'estat del model.

### Esquema

```js
/**
 * @typedef {Object} FlightRecord
 * @property {string}  aircraftTypeId   'tp' | 'nb' | 'wb' | 'jumbo' (+ nous a F4)
 * @property {string}  from             ICAO
 * @property {string}  to               ICAO
 * @property {number}  blockSeconds     Game.flight.t
 * @property {number}  airborneSeconds
 * @property {number}  fuelBurntKg
 * @property {number}  fuelPlannedKg
 * @property {number}  paxOnBoard
 * @property {number}  maxAltFt         Game.flight.maxAlt
 * @property {number}  maxG
 * @property {number}  maxBankDeg
 * @property {number}  abruptInputs     per al confort de cabina
 * @property {number}  timeAccelMax
 * @property {boolean} usedCruiseSkip
 * @property {number}  skippedCruiseFuelKg  combustible del tram saltat, sense penalitzacio; 0 per defecte
 * @property {number}  arrivalDeltaMin  + = tard
 * @property {Touchdown|null} touchdown null si no ha aterrat
 * @property {number}  rolloutMetres
 * @property {boolean} tailStrike
 * @property {string|null} crashCause   CRASH_CAUSES o null
 * @property {Array<{type:string, atSecond:number}>} events
 */

/**
 * @typedef {Object} Touchdown       copiat de Game.report i scoreReport
 * @property {number} fpm   @property {number} g   @property {number} bounces
 * @property {boolean} onRunway   @property {string|null} rwy
 * @property {number|null} tdzDist   @property {number|null} center   @property {number|null} crab
 *           (tots tres null si onRunway és fals, igual que rwy)
 * @property {number} ias   @property {number} pitch   @property {number} roll
 * @property {number} score            0..100
 * @property {{sink:number, g:number, zone:number, center:number, attitude:number}} pts
 */
```

`events[].type`: `engineFailure gearFault hydraulicFault avionicsFault
stallWarning overspeed gpws goAround divert`. Només els que el simulador ja
detecta; la resta s'afegeixen quan existeixin les avaries (E2).

---

## 5. `CareerState`

Una sola estructura serialitzable. Res de classes, `Map`, `Set` ni `Date`.

```js
/**
 * @typedef {Object} CareerState
 * @property {number} schemaVersion
 * @property {number} balanceVersion
 * @property {number} rngSeed
 * @property {number} rngCounter
 * @property {string} createdAt      ISO, només informatiu
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
 * @property {string} reg            clau primària, 'EC-XXX'
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
```

### Invariants

- `cash` i tot import: **euros enters**. Arrodoneix amb `Math.round` només al
  final de cada càlcul.
- `logbook` és append-only.
- `reg` és la clau d'un avió, mai l'índex dins de `fleet`.
- `clock.minute` només el modifica `career/clock.js`.
- `routesFlown` guarda `'AAAA-BBBB'` amb els dos ICAO en ordre alfabètic.

---

## 6. `src/career/balance.js`

Un sol objecte exportat. Cap altre fitxer de `career/` pot contenir un número
que no sigui 0, 1, un índex o una constant d'unitats amb nom
(`SECONDS_PER_HOUR`, `KG_PER_TONNE`, escales 0–100); mai un valor econòmic.
`version` es queda a 1 fins que el mode Airline arribi a `main`: mentre no hi
hagi partides reals de jugadors, afegir o canviar valors no puja `version` ni
afegeix migració. A partir del primer merge d'Airline a `main`, qualsevol canvi
de valor puja `version` i porta la seva migració a `career/state.js` (vegeu
`docs/DECISIONS.md`, 26/09/2026).

```js
export const BALANCE = {
  version: 1,
  K: 2.6,                                   // factor global: l unica palanca de ritme

  startingCash: 400000,
  startingLoan: { principal: 250000, ratePerFlight: 0.004 },
  reputation: { start: 50 },                // els limits 0..100 son de l esquema (state.js)

  fuelPricePerKg: 0.90,
  fees: { perTonneMTOW: 12, perPax: 1.8, airportsPerLeg: 2 },   // es paga a l origen i al desti
  crewRatePerBlockHour: { commuter: 250, turboprop: 450, narrowbody: 900, widebody: 1800 },
  maintAccrualPerHour:  { commuter: 180, turboprop: 300, narrowbody: 700, widebody: 1600 },

  fleetTypes: {                             // clau = aircraftTypeId del FlightRecord
    tp:    { cls: 'turboprop',  seats: 70  },
    nb:    { cls: 'narrowbody', seats: 180 },
    wb:    { cls: 'widebody',   seats: 300 },
    jumbo: { cls: 'widebody',   seats: 400 }
  },
  contractFeePerLeg: { commuter: 3000, turboprop: 6000, narrowbody: 18000, widebody: 40000 },

  landingBands: [                           // de dalt a baix; guanya el primer amb score >= min
    { min: 99, mult: 1.35, xp: 55,  key: 'landing.textbook' },
    { min: 95, mult: 1.20, xp: 40,  key: 'landing.flawless' },
    { min: 90, mult: 1.08, xp: 30,  key: 'landing.excellent' },
    { min: 82, mult: 1.00, xp: 20,  key: 'landing.solid' },
    { min: 72, mult: 0.85, xp: 12,  key: 'landing.safe' },
    { min: 60, mult: 0.60, xp: 4,   key: 'landing.firm' },
    { min: 45, mult: 0.35, xp: 0,   key: 'landing.rough' },
    { min: 30, mult: 0.15, xp: -8,  key: 'landing.veryHard' },
    { min: 15, mult: 0.00, xp: -20, key: 'landing.incident' },
    { min: 0,  mult: 0.00, xp: -35, key: 'landing.inspection' }
  ],

  bonuses: { minScore: 82, punctualityPct: 0.04, punctualityWindowMin: 10,
             fuelSavingShare: 0.35, fuelSavingThreshold: 0.03 },

  damage: [                                 // pctOfValue sobre Airframe.value
    { id: 'hardLanding',   fpm: 600, g: 2.2, pctOfValue: 0.0015, groundedDays: 1 },
    { id: 'veryHard',      fpm: 800, g: 2.6, pctOfValue: 0.012,  groundedDays: 3 },
    { id: 'tailStrike',                       pctOfValue: 0.025,  groundedDays: 5 },
    { id: 'offRunway',                        pctOfValue: 0.005,  groundedDays: 1 },
    { id: 'excursion',                        pctOfValue: 0.03,   groundedDays: 7 }
  ],
  // Sense perdua total: BACKLOG.md la descarta. Un accident es car i llarg, mai definitiu.
  crash: { minPct: 0.15, maxPct: 0.60, groundedDays: [14, 45], xpLoss: [200, 1500] },

  insurance: { premiumPctPerFlight: 0.0012, excessOptions: [0.05, 0.10, 0.25] },

  ranks: [
    { key: 'student',    xp: 0,     payMult: 1.00, slots: 0, dispatchPct: 0    },
    { key: 'private',    xp: 500,   payMult: 1.25, slots: 2, dispatchPct: 0.20 },
    { key: 'commercial', xp: 2000,  payMult: 1.55, slots: 3, dispatchPct: 0.30 },
    { key: 'atpl',       xp: 6000,  payMult: 1.85, slots: 5, dispatchPct: 0.40 },
    { key: 'captain',    xp: 15000, payMult: 2.20, slots: 7, dispatchPct: 0.50 },
    { key: 'instructor', xp: 35000, payMult: 2.50, slots: 9, dispatchPct: 0.60 }
  ],

  rotation: { perCrew: 0.5, cap: { commuter: 2.6, turboprop: 2.6, narrowbody: 2.7, widebody: 1.8 } },

  demand: { elasticity: { leisure: 1.6, business: 1.1 },
            hourFactor: { peak: 1.15, off: 0.70 }, weatherFactorMin: 0.8,
            reputation: { base: 0.6, span: 0.8 },
            hours: { peak: [[420, 600], [1080, 1260]], off: [[0, 360]] },  // minuts del dia, [inici, fi)
            pRef: { base: 90, perKm: 0.6 },              // LEBL-LEPA 201,97 km -> 211,18 EUR
            dBase: { scale: 260, distanceKm: 3000 },
            sizeWeight: { hub: 1.0, major: 0.7, regional: 0.35, small: 0.15 },
            defaultKind: 'leisure',               // tipus de les rutes sense excepcio
            defaultSize: 'small' },               // mida dels aeroports que no son a airportSize

  airportSize: {                            // ICAO -> categoria; si no hi es, demand.defaultSize
    LEBL: 'hub', LEMD: 'hub', LIRF: 'hub', EGLL: 'hub', EDDF: 'hub', KJFK: 'hub', SBGR: 'hub',
    LEPA: 'major', LEIB: 'major', LEVC: 'major', LEAL: 'major', LEZL: 'major',
    LEMG: 'major', LFMN: 'major', LFPO: 'major', GCLP: 'major',
    LEGE: 'regional', LERS: 'regional', LEMH: 'regional', LFMP: 'regional',
    LELL: 'small', LEDA: 'small', LESU: 'small', LECH: 'small'
  },
  routeExceptions: {                        // clau 'AAAA-BBBB' en ordre alfabetic; camps opcionals
    'LEBL-LEMD': { kind: 'business' }       // el pont aeri
  },
  airportDifficulty: { LESU: 0.50, LELL: 0.30, LEMH: 0.10 },   // la resta, 0
  exclusivityBonus: 0.25,

  cruiseSkipFuelPenalty: 0.08,
  xpMultipliers: { turbulence: 1.3, hardWeather: 1.4 },
  school: { passScore: 45, mercyScore: 30, mercyAttempt: 3, graduationXp: 250 }
};
```

---

## 7. Determinisme

Tot l'atzar de `career/` ha de ser reproduïble des de la partida desada.

```js
import { makeRng } from '../core/index.js';
/** avanca el comptador i retorna [0,1) */
export function draw(state) {
  const r = makeRng((state.rngSeed ^ Math.imul(state.rngCounter, 0x9E3779B1)) >>> 0);
  state.rngCounter++;
  return r();
}
```

- `Math.random()` prohibit a `career/` i a `world/weather.js`.
  (`Game.updateGusts` en fa servir; és fora de l'abast i es deixa estar.)
- La meteo es genera amb `hash2`, a partir de ruta i franja horària: ha de
  sortir igual encara que el jugador tanqui i obri el joc.
- Cada `DispatchOrder` desa el seu `rngCounter` en crear-se.

---

## 8. Persistència

`src/platform/storage.js` és l'únic mòdul que toca `localStorage`:

```js
export const Storage = {
  load(key)        -> objecte o null   // mai llança
  save(key, obj)   -> true | false     // false si el navegador ho refusa
  remove(key)
};
```

- Clau `pontAeri.career.v1`. Sense prefix d'entorn: `github.io` i `pages.dev`
  són orígens diferents i no comparteixen `localStorage`. **Si mai es serveixen
  des del mateix domini, el prefix passa a ser obligatori.**
- `career/state.js` (pur): `createCareer({ name, seed, createdAt })`, `migrate(raw)`,
  `validate(state)`, `exportJson(state)`, `importJson(text)`. `migrate` mai
  llança: si no pot, retorna `null`.
- Si `balanceVersion !== BALANCE.version`: avisar i oferir migrar o reiniciar.
- Es desa en acabar cada vol i en tancar cada pantalla, mai per frame.
- Exportar i importar la partida en JSON: amb amics provant, és el que fa
  reproduïbles els bugs.

---

## 9. i18n

- `src/i18n/index.js`: `t(key, params)`, `setLang(lang)`, `getLang()`,
  `fmtMoney(euros)`, `fmtNumber(n, decimals)`, `fmtDateTime(date)`,
  `fmtDuration(minutes)`, tots amb `Intl`. Idioma per defecte: `en`.
  Locales: `ca` → `ca-ES`, `en` → `en-GB`.
- Els textos són a `src/i18n/en.js` i `src/i18n/ca.js`, amb `export default`
  d'un objecte pla, no a `.json`: importar JSON no es comporta igual a Node i a
  Vite. `en.js` és la font; si a `ca.js` li falta una clau, cau a `en`, i si
  tampoc hi és, `t()` retorna la clau tal qual.
- `t` interpola `{nom}` amb `params`. Si `params.count` existeix i hi ha claus
  `key.one` / `key.other`, tria la forma amb `Intl.PluralRules`.
- `fmtMoney`: euros enters, sense decimals.
- `fmtDateTime` rep un `Date`; `fmtDuration(160)` dona `2 h 40 min`. i18n no
  sap res del rellotge de la partida: qui en tingui un minut el converteix
  abans. i18n no importa res de cap altra capa.
- Prohibit concatenar: `t('flaps.set', { name })`, mai `'Flaps ' + n`.
- **Abast:** tot text nou passa per `t()` des del primer dia. Els textos que ja
  hi ha a `index.html` (missatges de `Game.msg`, `scoreReport`, `UI`) es
  migren al bloc M, no abans.
- Les claus de `balance.js` (`landing.solid`) són claus i18n.
- `fmtDateTime` formateja en la zona horària del navegador. Quan
  `career/clock.js` (E1) converteixi minuts de partida a `Date`, caldrà fixar
  una zona, per exemple `Europe/Madrid`, perquè tots els jugadors vegin la
  mateixa hora.

---

## 10. Proves

Tot amb `node:test`, com les existents. `npm test` les corre totes.

| Fitxer | Què comprova |
| --- | --- |
| `test/smoke.test.js` | exports de `core` i `world`. **Actualitza'l** quan s'afegeixi un export que la resta del joc necessiti, o quan canviï el nombre d'avions (F4). |
| `test/harness.test.js` | rangs realistes per avió |
| `test/snapshot.test.js` | física idèntica. Vegeu la regla 2 de §0 |
| `test/career/*.test.js` | NOU. Una prova per funció pública de `career/` |
| `test/recorder.test.js` | NOU. `FlightRecorder` alimentat amb un `FlightModel` real |

### Harness econòmic: `tools/balance.mjs`, script `npm run balance`

No forma part de `npm test` (és lent i dona informació, no un sí o un no).

1. Crea una partida nova amb llavor fixa.
2. Simula 200 vols. Notes d'aterratge: normal de mitjana 72 i desviació 14,
   truncada a [0, 100], amb un 3 % de cua sota 25.
3. Aplica les compres òbvies quan hi ha diners.
4. Imprimeix: corba de `cash`, vol de cada compra, vols fins a cada rang, % de
   vols en negatiu, ingressos per hora de joc a cada acte.

**Criteris:** cada salt de classe entre 25 i 35 vols; menys del 12 % de vols en
negatiu; cap acte de més de 12 hores de joc.

---

## 11. Flux de treball

```
tipus/descripcio  ──PR──▶  dev  ──PR──▶  main
                          │               │
                   pont-aeri.pages.dev   github.io (amics)
```

- Tota feina en una branca pròpia que surt de `dev`. PR **contra `dev`**, mai
  contra `main`.
- El CI ha de passar al PR. Després es prova a `pont-aeri.pages.dev`.
- `dev → main` només quan es vol que els amics vegin el canvi.

---

## 12. Etapes

Dependències estrictes. Cada tasca és un PR contra `dev` amb `npm test` en verd.

### Bloc A — Fonaments

| Id | Tasca | Depèn de | Fet quan |
| --- | --- | --- | --- |
| A1 | `src/i18n/`: `t`, formatadors, `en.js`, `ca.js` | — | **Fet.** Proves de `t`, reserva a `en` i formats |
| A2 | `src/platform/`: `storage.js`, `env.js` (`IS_DEV`) | — | **Fet.** `Storage` no llança mai |
| A3 | `src/core/flight-recorder.js` + `test/recorder.test.js` | — | **Fet.** 16 proves, 240 en total |
| A4 | Enganxar el recorder a `Game` a `index.html` | A3 | Un vol lliure imprimeix el `FlightRecord` a la consola si `IS_DEV` |
| A5 | `src/career/state.js` i `types.js` | A1 | **Fet.** Proves de creació, migració, validació, export i import, i de puresa de `career/`. 31 proves, 297 en total |

A3 i A4 són dos PR separats: el primer no toca `index.html`, el segon sí.

### Bloc B — Economia headless

| Id | Tasca | Depèn de | Fet quan |
| --- | --- | --- | --- |
| B1 | `balance.js` complet | A5 | **Fet.** `BALANCE` de §6 més `reputation.start`, congelat en profunditat. Proves de coherència. 11 proves, 308 en total |
| B2 | `landing.js`, `demand.js`, `economy.js` | B1 | **Fet.** Proves dels trams, de l'elasticitat i del compte de resultats. `distanceKm` nova a `world/geo.js`, `skippedCruiseFuelKg` al `FlightRecord`. 65 proves, 373 en total |
| B3 | `wear.js`, `damage.js` | B2 | Una nota de 20 punts genera la factura correcta |
| B4 | `progression.js` | B2 | XP, rangs, habilitacions |
| B5 | `tools/balance.mjs` i calibratge de `K` | B2–B4 | Criteris de §10 |

**Cap línia d'interfície d'Airline abans que B5 passi.**

### Bloc C — Escola de vol

| Id | Tasca | Depèn de | Fet quan |
| --- | --- | --- | --- |
| C1 | `career/school.js`: lliçons com a dades, motor de criteris | A3, B4 | Afegir una lliçó no toca codi |
| C2 | `app/`: bus, `setFlightLauncher`, `onFlightFinished` | A2, A5 | Un vol llançat des d'`app` torna el seu `FlightRecord` |
| C3 | Executor de lliçons a `index.html`: instructor al HUD, criteris en viu | C1, C2, A4 | Les 8 lliçons es poden completar |
| C4 | Ajudes de l'escola: barra d'arrodoniment, debrief automàtic | C3 | Només visibles dins l'escola |
| C5 | Pantalla d'escola i graduació | C3 | Graduar-se crea el `CareerState` inicial |

### Bloc D — Centre d'operacions

| Id | Tasca | Depèn de |
| --- | --- | --- |
| D1 | Menú principal Free Flight / Airline, shell i barra superior | C5 |
| D2 | Fleet | D1, B3 |
| D3 | Dispatch: taulell de sortides, produeix l'`opts` del vol | D2, B2 |
| D4 | Briefing i debrief amb compte de resultats | D3, A4 |
| D5 | Market: mercat d'ocasió amb historial | D2 |
| D6 | Pilot, Finance, Crew, Map | D1 |
| D7 | Escena 3D del menú, reaprofitant càmera i escenografia | D1 |

### Bloc E — Bucle complet

| Id | Tasca | Depèn de | Nota |
| --- | --- | --- | --- |
| E1 | `career/clock.js` i posició de la flota | D4 | L'avió queda on aterra |
| E2 | Manteniment, revisions i avaries en vol | B3, E1 | Les avaries són esdeveniments nous del `FlightModel` |
| E3 | Detector de creuer estable i ×32 | A4 | **Estén** `Game.cycleAccel`, no el substitueix. El bucle de `Game` limita a `16 * 12` passos per frame: a ×32 cal mesurar el temps de frame |
| E4 | Salt de creuer | E3 | +8 % de combustible, condicions revelades en sortir. Omple skippedCruiseFuelKg amb cruiseSkip(fuelKg): el combustible que s'hauria cremat al tram saltat, sense penalitzacio. La penalitzacio del 8 % l'aplica economy.js. |
| E5 | `career/dispatch.js`, vols automàtics | E1, B4 | Resolució en aterrar, llavor desada |

### Bloc F — Contingut (paral·lel, delegable)

| Id | Tasca | Nota |
| --- | --- | --- |
| F1 | Més aeroports a `world/airports.js` (fases 1–3 del disseny) | Pistes reals d'OurAirports |
| F2 | Taxiways i portes procedimentals | Tots menys LEBL i LEPA |
| F3 | `world/weather.js` amb llavor | Patrons locals i estacionals |
| F4 | Migjorn Mi-9 i Xaloc X-90 a `aircraft-data.js` | **Canvia la física a propòsit**: actualitzar `smoke.test.js` (nombre d'avions), regenerar `snapshot.json` i afegir entrada a `DECISIONS.md`, tot al mateix PR |
| F5 | Variants G-42, G-72F, M-100, M-300, L-900ER, T-4F | Com F4 |

### Bloc M — Migració pendent (paral·lel, baixa prioritat)

Mateixes regles que `MIGRACIO.md`: només moure, un fitxer per commit.

| Id | Tasca | Nota |
| --- | --- | --- |
| M1 | `import * as THREE from 'three'` en comptes del CDN | Versió fixada a 0.128 |
| M2 | Seccions 8c–13 a `src/render/` | Les proves no cobreixen el render: cal revisió visual |
| M3 | Seccions 14–20 a `src/ui/` i `src/app/`; textos existents a i18n | `Game` surt d'`index.html` i desapareix `setFlightLauncher` |

Les proves no veuen el render. Per a M1–M3, cada PR ha d'incloure una llista
de comprovació visual: vol de dia i de nit a LEBL i LEPA, les quatre càmeres,
els quatre avions, aterratge amb informe.

---

## 13. Repartiment de models

| Feina | Model |
| --- | --- |
| A3, A5, B1–B5, C1, E5 | Fort: contractes, determinisme i balanç |
| A1, A2, C2–C5, D1–D7, E1–E4 | Mixt, amb els contractes ja tancats |
| F1–F5, M1–M3 | Barat: mecànic i verificable |

---

## 14. Riscos

| Risc | Mitigació |
| --- | --- |
| Un agent regenera la instantània per fer passar les proves | Regla 2 de §0, i revisar sempre el diff de `test/` |
| `career/` acaba depenent del navegador | Taula de §3; les proves de `career/` corren a Node |
| Diners en coma flotant acumulen error | Enters, arrodoniment al final |
| Els vols despatxats canvien en recarregar | `rngCounter` desat per ordre |
| El balanç queda malament tard | B5 bloqueja tot el bloc C |
| `index.html` torna a créixer sense control | Codi nou d'Airline a `src/`; a `index.html` només el cablejat |
| Pujar `three` de versió sense voler | Fixat a 0.128 a `package.json` |
