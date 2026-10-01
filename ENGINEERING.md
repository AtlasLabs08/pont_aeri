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
   Excepció: `src/career/lessons.js` és un fitxer de dades amb els llindars de
   pilotatge de les lliçons i dels check-rides (ft, vistes, comandaments, notes
   i nusos del setup); els valors econòmics i
   `passScore`/`mercyScore`/`mercyAttempt` continuen a `balance.js`.
5. **Cap `Math.random()` a `src/career/`.** Vegeu §7.
6. **Respecta la taula de dependències de §3.** `career/` no toca el navegador.
7. **Cap text visible nou fora de `src/i18n/`.** Vegeu §9.
8. **Si una tasca sembla exigir trencar un contracte d'aquest document,
   atura't i explica-ho** en comptes de decidir-ho tu.
9. **Puja la teva branca (`git push -u origin <branca>`) i obre el PR contra
   `dev`.** Mai facis push a `dev` ni a `main`: GitHub ho bloqueja igualment.

---

## 1. Estat actual

### Estructura

```
index.html            2.627 línies. Seccions 8c–20: tot el que toca el navegador.
                      Un <script type="module"> que importa de src/.
src/core/             Simulador headless, sense window/document/THREE
  constants.js  noise.js  atmosphere.js  aircraft-data.js
  flight-model.js  trim.js  autopilot.js  harness.js
  flight-recorder.js  landing-watch.js
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
 * @property {string}  aircraftTypeId   'tp' | 'nb' | 'wb' | 'jumbo' | 'commuter' | 'rj' | 'tpShort' | 'nbShort' | 'nbStretch' | 'wbEr'
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
 * @property {number|null} remaining  metres de pista que queden en el contacte
 *           (tots quatre null si onRunway és fals, igual que rwy)
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
 * @property {Market} [market]       D2+D5. Opcional: si falta, refreshMarket el genera
 */

/** @typedef {{epoch:number, listings:Listing[]}} Market
 *   epoch = floor(clock.minute / BALANCE.market.regenMinutes) de quan es va generar */

/**
 * @typedef {Object} Listing         un anunci del mercat d ocasio (D5)
 * @property {string} reg            'EC-XXX', unica entre la flota i la llista
 * @property {string} typeId
 * @property {'basic'|'standard'|'premium'|'deluxe'} tier
 * @property {number} yearBuilt
 * @property {number} hours
 * @property {number} cycles
 * @property {{engines:number, gear:number, airframe:number, avionics:number}} condition
 * @property {{nextAHours:number, nextCHours:number}} maintenance   hores absolutes, com l Airframe
 * @property {number} listPrice      K1. Opcional: el preu de priceOf, sense rebaixa; sense, price
 * @property {number} offerPct       K1. Opcional: rebaixa 0..1 (0 = sense oferta)
 * @property {number} price          euros enters que es paguen: round(listPrice * (1 - offerPct))
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
 * @property {number} value          el preu pagat (sense depreciacio de moment)
 * @property {'basic'|'standard'|'premium'|'deluxe'} [tier]   D2+D5. Opcional: sense, 'standard'
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
- `market` i `Airframe.tier` no pugen `schemaVersion` ni porten migració
  (D2+D5, `docs/DECISIONS.md` 30/09/2026, G11): `validate` accepta una partida
  sense mercat i un avió sense categoria. En carregar una partida graduada,
  `app/` crida `refreshMarket`. L'atzar del mercat surt de
  `derivedRng(rngSeed, 'market', epoch)` i no toca `rngCounter`. La categoria
  d'un avió no canvia mai, ni amb el desgast.
- **Ofertes i regla de venda** (`docs/DECISIONS.md` 01/10/2026, K1-K2): els
  anuncis generats porten `listPrice` i `offerPct` (0 si no hi ha oferta); un
  anunci desat abans no els té i es llegeix com `listPrice = price`,
  `offerPct = 0` (`validate` els accepta opcionals). `Airframe.finance.purchasePrice`
  és el que es va pagar. **La cotització de venda és
  `round(min(priceOf(estat actual), finance.purchasePrice) * (1 - sellFee))`**:
  mai es ven per més del que es va pagar menys la comissió, així comprar
  ofertes per revendre-les no dona guany. No treguis el `min`: una prova ho
  vigila (`test/career/finance.test.js`).

---

## 6. `src/career/balance.js`

Un sol objecte exportat. Cap altre fitxer de `career/` pot contenir un número
que no sigui 0, 1, un índex o una constant d'unitats amb nom
(`SECONDS_PER_HOUR`, `KG_PER_TONNE`, escales 0–100); mai un valor econòmic.
L'única excepció és `career/lessons.js`, un fitxer de dades amb els llindars de
pilotatge de l'escola i dels check-rides (vegeu la regla 4 de §0 i
`docs/DECISIONS.md`, 27/09/2026).
`version` es queda a 1 fins que el mode Airline arribi a `main`: mentre no hi
hagi partides reals de jugadors, afegir o canviar valors no puja `version` ni
afegeix migració. A partir del primer merge d'Airline a `main`, qualsevol canvi
de valor puja `version` i porta la seva migració a `career/state.js` (vegeu
`docs/DECISIONS.md`, 26/09/2026).

```js
export const BALANCE = {
  version: 1,
  K: 2.4,                                   // factor global: l unica palanca de ritme

  startingCash: 400000,
  startingLoan: { principal: 250000, ratePerFlight: 0.004, termFlights: 340 },   // termini = financing
  startingBase: 'LEBL',                     // base en graduar-se: on es fa l escola (C5)
  reputation: { start: 50 },                // els limits 0..100 son de l esquema (state.js)

  fuelPricePerKg: 0.90,
  fees: { perTonneMTOW: 12, perPax: 1.8, airportsPerLeg: 2 },   // es paga a l origen i al desti
  crewRatePerBlockHour: { commuter: 250, turboprop: 450, narrowbody: 900, widebody: 1800 },
  maintAccrualPerHour:  { commuter: 180, turboprop: 300, narrowbody: 700, widebody: 1600 },

  fleetTypes: {                             // clau = aircraftTypeId del FlightRecord
    tp:    { cls: 'turboprop',  seats: 70,  rating: 'turboprop'  },
    nb:    { cls: 'narrowbody', seats: 180, rating: 'narrowbody' },
    wb:    { cls: 'widebody',   seats: 300, rating: 'widebody'   },
    jumbo: { cls: 'widebody',   seats: 400, rating: 'quad'       }
  },
  usedPrice: {                              // B5: preu d ocasio de referencia per tipus
    commuter: 350000, tpShort: 1100000, tp: 1800000, rj: 4500000, nbShort: 6500000,
    nb: 8000000, nbStretch: 10000000, wb: 22000000, wbEr: 25000000, jumbo: 30000000
  },
  financing: { downPct: 0.30, ratePerFlight: 0.004, termFlights: 340,     // B5: quotes per vol
               reserveFlights: 10 },        // D2+D5: regla de compra (G6)
  market: {                                 // D2+D5: mercat d ocasio i categories
    listings: [8, 12], regenMinutes: 1440,  // un dia de partida
    mix: { rated: 0.50, next: 0.35, other: 0.15 },
    tierWeights: { basic: 0.25, standard: 0.35, premium: 0.25, deluxe: 0.15 },
    tiers: [                                // de pitjor a millor
      { key: 'basic',    priceFactor: [0.6, 0.8], ageYears: [20, 30], condition: [55, 75],  revenueMult: 0.90, wearMult: 1.25 },
      { key: 'standard', priceFactor: [0.8, 1.0], ageYears: [12, 22], condition: [70, 88],  revenueMult: 1.00, wearMult: 1.00 },
      { key: 'premium',  priceFactor: [1.0, 1.2], ageYears: [5, 14],  condition: [85, 96],  revenueMult: 1.08, wearMult: 0.90 },
      { key: 'deluxe',   priceFactor: [1.2, 1.4], ageYears: [1, 6],   condition: [94, 100], revenueMult: 1.15, wearMult: 0.80 }
    ],
    referenceYear: 2026, ageWeight: 0.5,
    hoursPerYear:  { commuter: 1200, turboprop: 1800, narrowbody: 2600, widebody: 4200 },
    hoursPerCycle: { commuter: 0.8,  turboprop: 1.0,  narrowbody: 1.5,  widebody: 5.0 },
    hoursJitter: 0.3, sellFee: 0.10,
    offers: { count: [1, 2], discount: [0.10, 0.20] }   // K1: ofertes per llista i rebaixa uniforme
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
  crash: { minPct: 0.15, maxPct: 0.60, groundedDays: [14, 45], xpLoss: [30, 200] },

  // B3 (wear.js): valors provisionals, es calibren a B5
  operations: { dayHours: { commuter: 8, turboprop: 9, narrowbody: 11, widebody: 14 },
                minLegHours: { commuter: 0.5, turboprop: 0.6, narrowbody: 0.75, widebody: 1.5 } },
  wear: {                                   // punts de condicio (0..100) que es perden
    enginesPerHour: 0.0075, avionicsPerHour: 0.05,
    airframePerCycle: 0.005, gearPerCycle: 0.02,
    gearFreeFpm: 300, gearPerExtraFpm: 0.01,  // desgast extra de l aterratge del jugador
    gearFreeG: 1.6, gearPerExtraG: 5
  },
  maintCostPerCycle: { commuter: 40, turboprop: 60, narrowbody: 120, widebody: 300 },
  checks: {
    A:      { intervalHours: 500,  pctOfValue: 0.008, groundedDays: 1,
              restore: { avionics: 100 }, boost: { gear: 20 } },
    C:      { intervalHours: 6000, pctOfValue: 0.04,  groundedDays: 10,
              restore: { airframe: 100, gear: 100, avionics: 100 } },
    engine: {                     pctOfValue: 0.03,  groundedDays: 5,
              restore: { engines: 100 } }
  },
  failure: { threshold: 70, pAtThreshold: 0.002, refCondition: 20, pAtRef: 0.08 },

  insurance: { premiumPctPerFlight: 0.0012, excessOptions: [0.05, 0.10, 0.25] },

  ranks: [
    { key: 'student',    xp: 0,     payMult: 1.00, slots: 0, dispatchPct: 0    },
    { key: 'private',    xp: 600,   payMult: 1.25, slots: 2, dispatchPct: 0.20 },
    { key: 'commercial', xp: 1100,  payMult: 1.55, slots: 3, dispatchPct: 0.30 },
    { key: 'atpl',       xp: 1500,  payMult: 1.85, slots: 5, dispatchPct: 0.40 },
    { key: 'captain',    xp: 1950,  payMult: 2.20, slots: 7, dispatchPct: 0.50 },
    { key: 'instructor', xp: 2550,  payMult: 2.50, slots: 9, dispatchPct: 0.60 }
  ],

  ratings: {                                // habilitacions de tipus (DESIGN.md)
    commuter:   { rank: 'student',    cost: 0 },
    turboprop:  { rank: 'private',    cost: 25000 },
    narrowbody: { rank: 'commercial', cost: 120000 },
    widebody:   { rank: 'atpl',       cost: 400000 },
    quad:       { rank: 'captain',    cost: 600000 }
  },
  endorsements: {
    night:      { rank: 'private',    cost: 15000 },
    crosswind:  { rank: 'student',    cost: 30000 },
    lowVis:     { rank: 'commercial', cost: 60000 },
    shortField: { rank: 'commercial', cost: 45000 },
    longHaul:   { rank: 'atpl',       cost: 150000 }
  },

  crewHireCost: { commuter: 44000, turboprop: 60000, narrowbody: 100000, widebody: 200000 },   // B5
  rotation: { perCrew: 0.5, cap: { commuter: 2.6, turboprop: 2.6, narrowbody: 2.7, widebody: 1.8 } },

  demand: { elasticity: { leisure: 1.6, business: 1.1 },
            hourFactor: { peak: 1.15, off: 0.70 }, weatherFactorMin: 0.8,
            reputation: { base: 0.6, span: 0.8 },
            hours: { peak: [[420, 600], [1080, 1260]], off: [[0, 360]] },  // minuts del dia, [inici, fi)
            pRef: { base: 290, perKm: 0.10 },            // LEBL-LEPA 201,97 km -> 310,20 EUR
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

`market.offers` (K1): a cada llista, entre `count[0]` i `count[1]` anuncis
(qualsevol, garantits inclosos) surten amb una rebaixa uniforme dins de
`discount`. Es trien al final del flux derivat del mercat (`derivedRng`),
després de les garanties i del farciment: no mouen cap altra tirada ni
`rngCounter`. Sense pujar `version`.

---

## 7. Determinisme

Tot l'atzar de `career/` ha de ser reproduïble des de la partida desada.
`draw` és a `src/career/rng.js` (B5).

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

### Contracte de la meteo (`src/world/weather.js`, F3)

```js
weatherFor({ icao, month, hour, day, seed }) -> {
  windDirDeg,   // 0-359, d on ve el vent
  windKt, gustKt,   // enters; gustKt >= windKt
  visibilityM,  // 50-10000
  ceilingFt,    // 100-10000, o null = cel net
  turbulence,   // 0-1
  pattern,      // clau de WEATHER_PATTERNS, o 'general'
  severity,     // 0-1: el pitjor entre vent, visibilitat, sostre i turbulencia
  hard          // severity >= HARD_SEVERITY (0,7)
}
toGameWeather(w) -> { windDir, windKt, turb, gustKt, visibilityM, ceilingFt }
```

- `month` 1-12, `hour` 0-23, `day` enter: els passa qui la crida (el rellotge
  arriba a l'E1). `weatherFor` no llegeix cap rellotge.
- Mateixa entrada, mateixa sortida: tot l'atzar surt de `hash2`.
- Distribucio sobre tots els aeroports, mesos i hores: vent apreciable (>= 12 kt
  o ratxes >= 18 kt) en un 20 % +-4 punts, `hard` en un 6,7 % +-2.
- Els patrons locals son una taula de dades (`WEATHER_PATTERNS`): afegir-ne un
  no toca codi. Els aeroports sense patro fan servir el general.
- `toGameWeather` passa a les unitats de `Game.opts`: `windDir` 0-350 de 10 en
  10, `windKt` enter 0-40, `turb` boolea (`turbulence >= 0,35`). `Game` encara no
  accepta rafegues, visibilitat ni sostre: es retornen com a dades.

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
| `test/harness.test.js` | rangs realistes per avió (bloc `expect`), també el tren (fre a tota potència; contacte a 400 fpm a la massa de prova, a la màxima d'aterratge i a la mínima; contacte a 800 fpm), el pas de ralentí a potència màxima en 10 s i el canvi gran de potència en 60 s respecte de l'equilibri final (`phugPitch`, `phugAlt`) |
| `test/fisica.test.js` | el Mi-9 és el turbohèlix més dòcil en un canvi gran de potència (per sota del G-72 i del G-42) i l'amortidor d'extensió del tren té la mateixa ζ amb qualsevol massa |
| `test/landing-watch.test.js` | `LandingWatch`: l'aterratge es registra amb qualsevol ordre de contacte i la xarxa de seguretat tanca l'informe |
| `test/snapshot.test.js` | física idèntica. Vegeu la regla 2 de §0 |
| `test/career/*.test.js` | NOU. Una prova per funció pública de `career/` |
| `test/recorder.test.js` | NOU. `FlightRecorder` alimentat amb un `FlightModel` real |

### Estabilitat del tren i qualitats de vol: `tools/estabilitat.mjs`

`node tools/estabilitat.mjs [id ...]`. No forma part de `npm test`. Imprimeix
per avió els escenaris que el harness comprova (treure el fre amb tota la
potència, contacte a 400 fpm, pas de ralentí a potència màxima en 10 s), la
resposta de 60 s al canvi gran de potència en els dos sentits, respecte de
l'equilibri final (excés de capcineig, desviació d'altitud, i com a informació
sobreoscil·lacions i temps d'assentament), i una taula de qualitats de vol
(període curt, balanceig holandès, balanceig i espiral) per comparar els
avions entre ells. Criteris a `docs/DECISIONS.md`, 29/09/2026.

### Harness econòmic: `tools/balance.mjs`, script `npm run balance`

No forma part de `npm test` (és lent i dona informació, no un sí o un no).

1. Crea una partida nova amb llavor fixa.
2. Simula 200 vols. Notes d'aterratge: normal de mitjana 72 i desviació 14,
   truncada a [0, 100] (es torna a tirar fins que cau dins, no es retalla),
   amb un 3 % de cua sota 25.
3. Aplica les compres òbvies quan hi ha diners, amb la regla de compra del joc
   (`purchaseRule` i `buyAircraft` de `career/finance.js`, G6 del D2+D5):
   `cash - entrada >= financing.reserveFlights * Q` (financat) o
   `cash - preu >= reserveFlights * Q` (al comptat), amb Q la suma de les
   quotes per vol de tots els préstecs després de la compra, sobre el cash que
   queda després de pagar l'habilitació. Mode per defecte: el primer avió al
   comptat i la resta financats, a `usedPrice`, estat 100, `revenueMult` i
   `wearMult` 1.
4. Imprimeix: corba de `cash`, vol de cada compra, vols fins a cada rang, % de
   vols en negatiu, ingressos per hora de joc a cada acte.

`npm run balance --seeds N` (o `npm run balance -- --seeds N`) corre la
partida amb N llavors seguides a partir de la llavor per defecte i imprimeix,
per a cada mètrica (vol de la primera tripulació, cada salt, % de vols en
negatiu, durada de cada acte tancat), la mediana i el percentil 90 (rang més
proper). Un salt o un acte que no arriba dins dels 200 vols compta com a
infinit. També imprimeix la Corba objectiu amb tots els vols de totes les
llavors, el nombre de llavors on el cash baixa de 0 en algun moment després
d'una compra i el cash mínim de totes, i avalua els criteris.

`npm run balance -- --tier <basic|standard|premium|deluxe>` (es combina amb
`--seeds N`): cada compra és d'aquella categoria, **totes financades (també la
primera)**, amb preu = `usedPrice` × punt mig del `priceFactor` de la
categoria, estat inicial al punt mig del seu `condition`, i els seus
`revenueMult` i `wearMult` passats a `computeFlightResult` i
`applyFlightWear`. `npm run balance -- --tiers` corre el mode per defecte i les
quatre categories (50 llavors) i imprimeix una taula amb el criteri A i el B.

**Criteris** (criteri robust del B5, vegeu `docs/DECISIONS.md`), sobre 50
llavors (`npm run balance --seeds 50`):

- Mediana: cada salt de classe entre 40 i 50 vols (el primer, commuter →
  turbohèlix, fins a 55); primera tripulació entre el vol 8 i el 12; menys del
  12 % de vols en negatiu; cap acte de més de 16 hores de joc.
- Percentil 90: cap salt de més de 60 vols; cap acte de més de 20 hores de joc.
- Els cinc tipus base dins del ±20 % de la Corba objectiu de `docs/DESIGN.md`.
- 0 llavors amb cash < 0 després d'una compra (D2+D5). Només al mode per
  defecte.

**Criteri B** (D2+D5, cap categoria no domina; `npm run balance -- --tiers`),
per a cada categoria amb `--tier`, respecte de `--tier standard`:

- la mediana de cada salt de classe a ±8 vols de la de standard;
- el p90 de cada salt com a molt 5 vols per sobre del p90 del mateix salt a
  standard (els salts limitats pel rang ja toquen els 60 vols amb standard);
- menys del 12 % de vols en negatiu (mediana).

Les llavors amb cash < 0 i el cash mínim de cada categoria s'imprimeixen com a
informació, però no formen part de B (`docs/DECISIONS.md`, 30/09/2026).

Una sola llavor no demostra res: l'informe d'una llavor només és orientatiu.

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

### Ordre de feina (26/09)

Les tasques s'agrupen en un sol PR i s'executen en aquest ordre: F4+F5, B5,
C1, C2, C3+C4, C5+D1, D2+D5, D3+D4, D6, E1+E5, E2, E3+E4, F1+F2, F3, i al
final (opcionals) D7 i M1–M3. Les taules de sota no canvien.

Dependències estrictes. Cada tasca és un PR contra `dev` amb `npm test` en verd.

### Bloc A — Fonaments

| Id | Tasca | Depèn de | Fet quan |
| --- | --- | --- | --- |
| A1 | `src/i18n/`: `t`, formatadors, `en.js`, `ca.js` | — | **Fet.** Proves de `t`, reserva a `en` i formats |
| A2 | `src/platform/`: `storage.js`, `env.js` (`IS_DEV`) | — | **Fet.** `Storage` no llança mai |
| A3 | `src/core/flight-recorder.js` + `test/recorder.test.js` | — | **Fet.** 16 proves, 240 en total |
| A4 | Enganxar el recorder a `Game` a `index.html` | A3 | **Fet.** Un vol lliure imprimeix el `FlightRecord` a la consola si `IS_DEV`, un sol cop per vol: al primer aterratge amb nota, o en estavellar-se. `Touchdown.remaining` al recorder i `excursion` a `damage.js`. 6 proves noves (1 a `recorder.test.js`, 5 a `damage.test.js`), 509 en total |
| A5 | `src/career/state.js` i `types.js` | A1 | **Fet.** Proves de creació, migració, validació, export i import, i de puresa de `career/`. 31 proves, 297 en total |

A3 i A4 són dos PR separats: el primer no toca `index.html`, el segon sí.

### Bloc B — Economia headless

| Id | Tasca | Depèn de | Fet quan |
| --- | --- | --- | --- |
| B1 | `balance.js` complet | A5 | **Fet.** `BALANCE` de §6 més `reputation.start`, congelat en profunditat. Proves de coherència. 11 proves, 308 en total |
| B2 | `landing.js`, `demand.js`, `economy.js` | B1 | **Fet.** Proves dels trams, de l'elasticitat i del compte de resultats. `distanceKm` nova a `world/geo.js`, `skippedCruiseFuelKg` al `FlightRecord`. 389 proves en total |
| B3 | `wear.js`, `damage.js` | B2 | **Fet.** La factura de danys depen de l'fpm i la g del contacte (i del tail strike i de la pista), no de la nota: `assessDamage` no llegeix `score`. Una nota de 20 punts pot sortir sense factura si el contacte es suau. El cas de referencia, 850 fpm en un avio de 8.000.000 EUR, dona veryHard, 96.000 EUR i 3 dies. Inclou el cost per cicle del manteniment (`cycleCost` d'`applyFlightWear`). 55 proves noves (53 a `wear.test.js` i `damage.test.js`, 2 de `purity.test.js`), 444 en total |
| B4 | `progression.js` | B2 | **Fet.** XP per vol, rangs, habilitacions de tipus i endorsements. Valors a `BALANCE.ratings`, `BALANCE.endorsements` i `fleetTypes[..].rating`. La baixada de rang per accident es proporcional: el rang surt sempre de l'XP. 59 proves noves (58 a `progression.test.js`, 1 de `purity.test.js`), 503 en total |
| B5 | `tools/balance.mjs` i calibratge de `K` | B2–B4 | **Fet.** Harness econòmic (`npm run balance`, i `--seeds N` per a la mediana i el percentil 90 sobre N llavors), `career/finance.js`, `career/crew.js` i `career/rng.js` (`draw`). K 2,4; termini de 340 vols; rangs, `crash.xpLoss`, `demand.pRef` i `crewHireCost` calibrats (`docs/DECISIONS.md`, 27/09/2026). Compleix el criteri robust de §10 sobre 50 llavors: salts de 47, 42, 42 i 42 vols de mediana (55, 52, 50 i 56 al p90), primera tripulació al vol 9, 4,5 % de vols en negatiu, actes de 10,9, 10,6 i 12,5 h de mediana (12,8, 13,2 i 14,9 h al p90). 53 proves noves, 892 en total |

**Cap línia d'interfície d'Airline abans que B5 passi.**

### Bloc C — Escola de vol

| Id | Tasca | Depèn de | Fet quan |
| --- | --- | --- | --- |
| C1 | `career/school.js`: lliçons com a dades, motor de criteris | A3, B4 | **Fet.** `career/lessons.js` (8 lliçons i 4 check-rides, només dades) i `career/school.js` (`METRICS`, `factsFromRecord`, `evaluate`, `isLessonAvailable`, `recordLessonAttempt`, `canGraduate`, `evaluateCheckRide`). Afegir una lliçó no toca codi. La gràcia de la lliçó 7 (nota ≥ 30) s'aplica a partir del tercer intent inclòs. Els check-rides només avaluen: l'habilitació es compra a `progression.js`. `fuelWithinPlan` compta el creuer saltat amb la penalització, com `economy.js`, i `recordLessonAttempt` només accepta lliçons disponibles. 77 proves noves (75 a `school.test.js`, 2 de `purity.test.js`), 969 en total |
| C2 | `app/`: bus, `setFlightLauncher`, `onFlightFinished` | A2, A5 | **Fet.** `app/bus.js` (`on`, `off`, `emit`, `TOPICS` congelat), `app/flight.js` (`setFlightLauncher`, `launchFlight`, `onFlightFinished`, `cancelFlight`, `isFlightInProgress`) i `app/save.js` (`loadCareer`, `saveCareer`, `backupCareer`, `discardCareer`, clau `pontAeri.career.v1`). Un vol llançat des d'`app` torna el seu `FlightRecord`. 33 proves noves (9 a `bus.test.js`, 10 a `flight.test.js`, 14 a `save.test.js`), mes 1 a `smoke.test.js`, 1003 en total |
| C3 | Executor de lliçons a `index.html`: instructor al HUD, criteris en viu | C1, C2, A4 | **Fet.** `app/lesson-run.js` (`LessonRun`, `lessonGoalParams`, `attemptMessage`, `keyLabel`, `messageText`, `circuitGuidance`), headless i provable a Node: manté els fets en viu (sempre inclou `crashed`), decideix quan tanca l'intent (crash, criteris en viu de les lliçons 1-4 i 6, els 120 s de D5 o, a la 5, la desviació d'altitud en superar el llindar; les lliçons 7 i 8 només tanquen amb `finish(record)`, quan `Game` calcula la nota), quin missatge toca a l'instructor i la llista d'objectius del HUD (`objectives()`). `app/lesson-session.js` (`startLesson`, `currentLesson`, `currentLessonId`, `lastLessonId`, `abandonLesson`) lliga cada `LessonRun` amb el seu vol: la promesa d'un vol només tanca la seva llico, i Restart torna a llançar la darrera. `maxAltFt` de la lliçó 4 és MSL arrodonida a 10 ft, com l'altímetre del HUD (D4 canviada el 29/09): `LessonRun` la calcula en viu i substitueix la del `FlightRecord` en combinar els fets. Nova mètrica `headingChangeDeg` a `METRICS` (school.js) per a D5. A `index.html`: panell DEV (D1) que llança cada lliçó amb `launchFlight`, `setFlightLauncher` cablejat per primera vegada, `onFlightFinished` cridat des de `finishRecord`, `cancelFlight` en abandonar o tornar al menú, i el text de l'instructor al HUD. Lliçons 2 i 3 des de `gate`, 1 i 4 des de `runway`, 5 des de `airborne` (nou, correcció del PR #22: en vol, anivellat, mar endins, tren amunt, flaps 0), 6 des de `downwind` (nou: al travers del llindar, rumb contrari al de la pista, tren amunt, flaps d'aproximació) i 7-8 des de `final` (7 a 3 nm sobre la senda; 8 a 12 nm, fora de l'eix i per sota de la senda, correcció del 29/09). `airborne` i `downwind` reaprofiteixen el mateix mecanisme d'inicialització en vol que `final` (`trimAircraft`), amb una altra posició/altitud/velocitat/configuració; els valors (ft, nm, flaps) són a `LESSONS[..].spawn` a `lessons.js`, `launchLesson()` els passa a `Game.spawn()` via `opts`. Cap dels dos modes nous és visible al menú de Free Flight. 92 proves noves (40 a `lesson-run.test.js`, 3 a `school.test.js` per `headingChangeDeg` i el nou criteri de la lliçó 5, mes les de C4), 1056 en total amb C4. Correccions del 28/09 després de la prova d'en Marc (`docs/DECISIONS.md`): Restart ja no mata la llico (la 5 no suspenia), la lliçó 2 compta el comandament en prémer la tecla, abans de cap comprovació (`controlKeys` a `lessons.js`), la 1 comença a la pista, la 3 ressalta en verd el capçal de la pista assignada, la 5 suspèn a l'instant en passar de 200 ft, la 6 guia per fases amb el costat del gir calculat (`guidance` a `lessons.js`, geometria respecte de la pista assignada: camps `asg*` de la instantània) i totes mostren al HUD una llista d'objectius generada dels criteris. 47 proves noves (41 a `lesson-run.test.js`, 6 a `lesson-session.test.js`), 1103 en total. Correccions del 29/09 per tancar les lliçons 1 a 5 (`docs/DECISIONS.md`): tecla `Home` per tornar la càmera a l'angle per defecte, a totes les càmeres i a Free Flight (`CONTROL_KEYS.cameraReset` a `lessons.js`, el mapa de tecles que la lliçó 2 fa servir com a `controlKeys`); explicacions de l'instructor com a dades (`tips` a `lessons.js`, `LessonRun.tips()`, tecles sempre de `CONTROL_KEYS`): girar la càmera amb el clic dret a la 1, rodar (Q/E, potència, frens) a la 3, WASD i Q/E a la 4; a la 3, rodona verda fluorescent al punt objectiu i línia recta discontínua des de l'avió, en lloc del ressaltat del capçal; l'altura dels objectius de la 4 diu "ft AGL" (no anava amb retard: és AGL i l'altímetre és MSL); i totes les distàncies a l'aeroport (PFD, HUD, ND, caixa d'aproximació, vol cronometrat) mesuren fins al capçal de la pista de destinació amb `thresholdDistNm` i `destinationEnd` (`world/ils.js`), arreglant un error antic de Free Flight (la cabina mostrava el DME, uns 2 nm més). 19 proves noves (12 a `lesson-run.test.js`, 7 a `threshold.test.js`), 1122 en total. Darrers canvis del 29/09 després de provar les 8 lliçons (`docs/DECISIONS.md`): doble clic amb el botó dret per tornar la càmera a l'angle per defecte (Home es manté com a alternativa, `Game.resetCamera`); a la 3, la línia verda segueix el camí més curt per les calles de rodatge (`world/taxi.js`: `buildTaxiGraph` fa el graf de la geometria de taxiways existent, sense redibuixar-la, i `taxiRoute` hi busca el camí amb A*; `LessonRun.taxiPath` el recalcula si l'avió se n'allunya més de `taxi.rerouteM`); la 4 compta MSL com l'altímetre (D4 canviada) i l'etiqueta diu "ft"; a la 6, la llista mostra totes les condicions de D6, també la distància al llindar i l'altura AGL (el comptador dels 10 s no avançava perquè aquestes dues no eren a la llista i l'instructor deia "abans dels 500 ft"); la 7 comença a 3 nm i la 8 a 12 nm, 2 nm fora de l'eix amb 25° d'intercepció i per sota de la senda, amb guia de la intercepció (`ilsGuidance`) i criteri nou `ilsFlown` (dins d'1 punt de les dues agulles entre 1.500 i 500 ft sobre la pista); el mode `final` accepta distància, offset, angle i altura per `opts` amb el mateix `trimAircraft`, i els camps `spawn*` ja no queden a `Game.opts` després d'una lliçó; el panell DEV cancel·la la lliçó en marxa (`cancelFlight`, sense intent) abans de llançar-ne una altra. 48 proves noves (28 a `lesson-run.test.js`, 2 a `lesson-session.test.js`, 1 a `school.test.js`, 17 a `test/taxi.test.js`), 1170 en total |
| C4 | Ajudes de l'escola: barra d'arrodoniment, debrief automàtic | C3 | **Fet.** `app/debrief.js` (`debriefRows`, pur): 7 files (sink, g, zona, centrat, actitud, rebots, tail strike), OK a partir del 70 % dels punts màxims de cada component. Els punts màxims surten d'un camp `ptsMax` nou a `Game.scoreReport` (index.html): no hi havia cap altre lloc que els exposés (regla 8 de la secció 0), vegeu la descripció del PR. Barra d'arrodoniment (D7) i debrief automàtic (D8) només a la lliçó 7, marcats com a dades (`aids`) a `lessons.js`, mai com a condició al codi. Només visibles dins l'escola: Free Flight no en mostra res. 11 proves noves a `debrief.test.js`, 1054 en total amb C3 |
| C5 | Pantalla d'escola i graduació | C3 | **Fet** amb D1. Graduar-se completa el `CareerState` que es crea en entrar per primer cop a Airline amb el nom del pilot (E1, `docs/DECISIONS.md` 30/09/2026): `graduate(state)` a `progression.js` afegeix `commuter`, suma `graduationXp` amb `applyXp`, posa `school.graduated`, un sol cop, i deixa la companyia al mateix punt de partida que `tools/balance.mjs` amb `startingCompany` (`finance.js`): `startingCash` (ja inclou el crèdit), el crèdit inicial amb `makeLoan`, la reputació inicial i la base `BALANCE.startingBase`. El harness crida el mateix `graduate` (`startState`) i `npm run balance --seeds 50` no canvia. Continuar amb un `balanceMismatch` fa `backupCareer()` abans de desar. L'escola viu a la partida i es desa després de cada intent i en tancar cada pantalla (`app/airline.js`). Pantalla d'escola, de graduació i guia de consulta (`app/guide.js`, tecles de `CONTROL_KEYS`). Aprovat per gràcia amb la nota a l'instructor i al debrief (E3). Lliçó 7 sense barra d'arrodoniment, amb el tip de la V/S (E4). 55 proves noves amb D1, 1557 en total |

### Bloc D — Centre d'operacions

| Id | Tasca | Depèn de |
| --- | --- | --- |
| D1 | Menú principal Free Flight / Airline, shell i barra superior. **Fet** amb C5: capa `src/ui/` (barrel `index.js`, només pinta i crida `app/`), menú de dues portes amb resposta als cinc estats de `loadCareer`, centre d'operacions amb les set pestanyes "Aviat", barra superior de `topBarModel` (E6), exportar i importar (E9) i panell DEV sobre la partida carregada (E10) | C5 |
| D2 | Fleet. **Fet** amb D5 (`docs/DECISIONS.md` 30/09/2026, G1-G12): una fila per avió amb matrícula, model, categoria, any, hores, cicles, els 4 estats, ubicació, status, hores fins a l'A-check i el C-check, préstec (quota per vol i vols que queden, o al comptat) i venda amb confirmació (`sellQuote`/`sellAircraft` de `finance.js`: cotització amb `priceOf` menys `sellFee`, cancel·la el préstec de l'avió, bloquejada si no és `ready` o si cash + net < 0). `app/market.js` (`fleetModel`, `sellAirframe`) i `ui/fleet.js`. Extres: Settings al menú principal (el mateix panell de la pausa) i el valor de la Vref al tip de la lliçó 7 i a la guia (`aircraftSpeeds`, `FlightModel.vspeeds()`). 79 proves noves amb D5, 1636 en total | D1, B3 |
| D3 | Dispatch: taulell de sortides, produeix l'`opts` del vol. **Nota del D2+D5:** en liquidar cada vol, passa a `computeFlightResult` el `revenueMult` de la categoria de l'avió (`tierOf(airframeTier(a)).revenueMult`) i a `applyFlightWear` el seu `wearMult`; tots dos són opcionals i valen 1 per defecte. El lloguer (G1) va amb D3+D4 | D2, B2 |
| D4 | Briefing i debrief amb compte de resultats | D3, A4 |
| D5 | Market: mercat d'ocasió amb historial. **Fet** amb D2: `career/market.js` (`priceOf`, `typeGroups`, `generateMarket` amb garanties per habilitació i pesos de `mix` i `tierWeights`, `refreshMarket` per `clock.minute`), `derivedRng` a `rng.js`, `purchaseRule`/`buyAircraft` a `finance.js` (al comptat o financat, només amb l'habilitació, amb el coixí de `reserveFlights`), categories d'avió (`Airframe.tier`: preu, edat i estat, `revenueMult` a `economy.js` i `wearMult` a `wear.js`). Harness amb la regla de compra, la mètrica de cash < 0, `--tier` i `--tiers` (criteris A i B de §10). `app/market.js` (`marketModel`, `buyListing`, `devNewMarket`), `ui/market.js` (anuncis per classe, filtre per categoria, efectes i desglossament de les dues modalitats) i botó DEV "new market". Sense lloguer (G1) | D2 |
| D5b | Market en targetes. **Fet** (`docs/DECISIONS.md` 01/10/2026, K1-K5): ofertes al mercat (`generateMarket`, `listPrice`/`offerPct`), regla de venda K2 a `sellQuote`, graella de targetes responsive amb filtre Ofertes (`cardModel` a `app/market.js`, `ui/market.js`), mapa d'imatges `app/aircraft-images.js` + `public/aircraft/` i siluetes SVG per classe (`ui/silhouettes.js`) | D5 |
| D6 | Pilot, Finance, Crew, Map | D1 |
| D7 | Escena 3D del menú, reaprofitant càmera i escenografia | D1 |

### Bloc E — Bucle complet

| Id | Tasca | Depèn de | Nota |
| --- | --- | --- | --- |
| E1 | `career/clock.js` i posició de la flota | D4 | L'avió queda on aterra |
| E2 | Manteniment, revisions i avaries en vol | B3, E1 | Les avaries són esdeveniments nous del `FlightModel`. Tira les avaries amb failureChance de wear.js i draw(state). Desgast extra de motors per TOGA prolongat: cal una dada nova al FlightRecord. |
| E3 | Detector de creuer estable i ×32 | A4 | **Estén** `Game.cycleAccel`, no el substitueix. El bucle de `Game` limita a `16 * 12` passos per frame: a ×32 cal mesurar el temps de frame |
| E4 | Salt de creuer | E3 | +8 % de combustible, condicions revelades en sortir. Omple skippedCruiseFuelKg amb cruiseSkip(fuelKg): el combustible que s'hauria cremat al tram saltat, sense penalitzacio. La penalitzacio del 8 % l'aplica economy.js. |
| E5 | `career/dispatch.js`, vols automàtics | E1, B4 | Resolució en aterrar, llavor desada. Cada vol despatxat aplica applyFlightWear. |

### Bloc F — Contingut (paral·lel, delegable)

| Id | Tasca | Nota |
| --- | --- | --- |
| F1 | Més aeroports a `world/airports.js` (fases 1–3 del disseny) | Pistes reals d'OurAirports |
| F2 | Taxiways i portes procedimentals | Tots menys LEBL i LEPA |
| F3 | `world/weather.js` amb llavor | **Fet.** `weatherFor` i `toGameWeather`, purs, sense cablejar al joc (contracte a §7). Patrons locals i estacionals com a taula de dades. 14 proves a `test/weather.test.js` i 1 de puresa a `purity.test.js`, 1656 en total |
| F4 | Migjorn Mi-9 i Xaloc X-90 a `aircraft-data.js` | **Fet.** Ids `commuter` i `rj`. Rangs al bloc `expect` de cada avió. `smoke.test.js` a deu avions i `snapshot.json` regenerat amb F5, al mateix PR: els valors dels quatre avions existents no canvien. 839 proves en total |
| F5 | Variants G-42, G-72F, M-100, M-300, L-900ER, T-4F | **Fet** amb F4, sense G-72F ni T-4F (ajornats fins que hi hagi contractes de càrrega). Ids `tpShort`, `nbShort`, `nbStretch` i `wbEr` |
| F6 | Geometria pròpia del Mi-9 (ala alta, fuselatge curt) i del X-90 (motors a cua); taula de flaps pròpia del M-300 (ara passa el harness molt just: 346 de 360 fpm i 1,44 d'1,45 g) i suports de góndola del X-90. A més, el X-90 és massa llarg i prim i té una ala massa gran: cal refer-ne les proporcions de jet regional | Sense dependències. **Fet a mitges (només geometria visual):** Mi-9 i X-90 amb geometria pròpia a `src/core/model-geom.js` (ratios sobre les mides de l'avió), pilons de góndola al fuselatge del X-90 i `test/model-geom.test.js`. **Pendent:** la taula de flaps del M-300 (física) |

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

---

## 15. Com afegir la imatge d'un avió

Les targetes del Market (K4, K5) mostren la imatge del tipus d'avió o, si no
en té, una silueta de la seva classe. Per posar un render definitiu:

1. Posa el fitxer a **`public/aircraft/`** (per exemple `migjorn-mi-9.webp`).
   Vite serveix `public/` tal com és, i `vite build` el copia a `dist/`; no
   cal importar-lo des del codi. La ruta que fa servir el joc és relativa
   (`aircraft/<fitxer>`), així que va igual a github.io, a pages.dev i en local.
2. Afegeix **una línia** al mapa de `src/app/aircraft-images.js`, amb el
   `typeId` (`commuter`, `tpShort`, `tp`, `rj`, `nbShort`, `nb`, `nbStretch`,
   `wb`, `wbEr`, `jumbo`):

   ```js
   export const AIRCRAFT_IMAGES = Object.freeze({
     commuter: 'migjorn-mi-9.webp'
   });
   ```

Res més: la targeta deixa de pintar la silueta d'aquell tipus. Proporció
recomanada 5:2 (la imatge es redimensiona dins la targeta sense retallar-se).
