# Pont Aeri — Especificació d'enginyeria

Document de referència per a qualsevol agent que escrigui codi en aquest
repositori. Descriu el codi **tal com és avui** a `dev` i l'ordre de feina per
construir el mode Airline.

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
index.html            Seccions 8c–20: tot el que toca el navegador.
                      Un <script type="module"> que importa de src/.
src/core/             Simulador headless, sense window/document/THREE
  constants.js  noise.js  atmosphere.js  aircraft-data.js  model-geom.js
  flight-model.js  trim.js  autopilot.js  harness.js
  flight-recorder.js  landing-watch.js
  index.js            barrel: la resta del joc importa d'aquí
src/world/            Món headless
  geo.js  airports.js  terrain.js  ils.js  taxi.js  route.js  weather.js
  airport-data.js     generat per tools/airports-ourairports.mjs, no editar a mà
  terrain-data.js     format del fitxer del terreny real (fase A)
  index.js
src/career/           Lògica del mode Airline. Funcions pures, a Node sense mocks
  balance.js  types.js  state.js  rng.js  util.js
  landing.js  demand.js  economy.js  wear.js  damage.js
  progression.js  crew.js  finance.js  market.js
  lessons.js  school.js
  index.js
src/app/              Orquestració: partida, vol, escola, mercat. Parla amb ui/ pel bus
  bus.js  flight.js  save.js  airline.js
  lesson-run.js  lesson-session.js  debrief.js  guide.js
  market.js  aircraft-images.js
  index.js
src/ui/               Pantalles del mode Airline. Només pinta i crida app/
  dom.js  screens.js  top-bar.js  airline-ui.js
  fleet.js  market.js  guide.js  silhouettes.js
  index.js
src/i18n/             t() i formatadors; textos a en.js (font) i ca.js
  index.js  en.js  ca.js
src/platform/         L'únic lloc de src/ que toca APIs del navegador
  storage.js  env.js  entropy.js  index.js
public/aircraft/      Imatges dels avions del Market (§15), servides tal com són
public/terrain/       terrain-250.bin: terreny real a 250 m (tools/terrain-build.mjs)
tools/                airports-ourairports.mjs  balance.mjs  estabilitat.mjs  terrain-build.mjs
test/                 Totes les proves (§10)
  *.test.js           core, world, recorder, i18n, platform, ui-boundary…
  app/  career/       una prova per fitxer de app/ i de career/
  helpers/            utilitats de les proves (terrain.js: carrega el terreny real)
  snapshot.json       instantània de la física, a precisió completa
docs/  DESIGN.md  DECISIONS.md  BACKLOG.md
MIGRACIO.md  vite.config.js  package.json  .node-version
```

### Què queda a `index.html`

| Secció | Símbols |
| --- | --- |
| 8c Escenari fotogràfic | `Photo` (injectat a `world/terrain.js` amb `setPhoto`) |
| 9 Shaders | `SHADERS` |
| 10 Render | `QUALITY R3 anchor unanchor setOrigin updateOrigin mergeGeos xf noiseTexture initRenderer patchFog fogHook applyQuality onResize SKYCFG celestial SkyJS Env Sea Terrain` |
| 11 Escenografia d'aeroport | `Clouds GLYPHS makeBuildingMaterial makeLightMaterial LightSet AirportScenery airportSegContains` |
| 12 Ciutats | `Scenery` |
| 13 Models d'avió | `MODEL_GEOM AircraftModel` |
| 14 Instruments | `Instruments` |
| 15 Cabina 3D | `Cockpit` |
| 16 Entrada | `Input` |
| 17 Càmeres | `Cameras` |
| 18 Estat de joc | `Game` |
| 18b HUD | `HUD` |
| 18c So | `Sound Callouts` |
| 19 Bucle | `Main` |
| 20 Interfície | `Best UI` |
| — Etiqueta DEV | `<script>` clàssic, `IS_DEV` |

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

**Excepció acceptada** (decisió del projecte): `core/autopilot.js` i
`core/harness.js` importen `world/ils.js` (només `ILS`, per a la guia de senda),
tot i que la taula diu que `core/` només importa `core/`. No es mou codi.
Qualsevol altre import de `core/` cap a `world/` és una violació.

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
    jumbo: { cls: 'widebody',   seats: 400, rating: 'quad'       },
    commuter:  { cls: 'commuter',   seats: 19,  rating: 'commuter'   },
    rj:        { cls: 'narrowbody', seats: 100, rating: 'narrowbody' },
    tpShort:   { cls: 'turboprop',  seats: 48,  rating: 'turboprop'  },
    nbShort:   { cls: 'narrowbody', seats: 140, rating: 'narrowbody' },
    nbStretch: { cls: 'narrowbody', seats: 220, rating: 'narrowbody' },
    wbEr:      { cls: 'widebody',   seats: 290, rating: 'widebody'   }
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
- La meteo es genera amb `hash2`, a partir de l'aeroport, el mes, l'hora, el
  dia i la llavor (`weatherFor`, contracte de sota): ha de sortir igual encara
  que el jugador tanqui i obri el joc.
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
- **Versions de l'esquema** (decisió del projecte): mentre Airline no sigui a
  `main`, els camps nous opcionals de `CareerState` (com `market` o
  `Airframe.tier`) no pugen `schemaVersion` ni porten migració; `validate` els
  accepta absents. Quan Airline arribi a `main`, cada canvi d'esquema puja
  `schemaVersion` i porta la seva migració a `career/state.js`.
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

Tot amb `node:test`. `npm test` les corre totes. **Totes són a `test/`**
(`test/app/` i `test/career/` hi tenen una prova per fitxer; `test/helpers/`
guarda utilitats compartides). Una prova nova va amb el seu fitxer; la taula només
recull les que tenen una funció especial:

| Fitxer | Què vigila |
| --- | --- |
| `test/snapshot.test.js` | física idèntica a `snapshot.json`. Vegeu la regla 2 de §0 |
| `test/harness.test.js` | rangs realistes per avió (bloc `expect`), el tren, el pas de ralentí i el canvi gran de potència |
| `test/career/purity.test.js` | `career/` no fa servir `Math.random`, `Date`, `window`, `document` ni importa res de fora de `career/`, `core/` i `world/` |
| `test/ui-boundary.test.js` | `ui/` només pinta i crida `app/`: no importa `render/` ni toca `Game` (es llegeix com a text) |
| `test/platform.test.js` | `platform/` amb dobles injectats a `globalThis` |
| `test/balance-harness.test.js` | el harness econòmic (`tools/balance.mjs`) és determinista |
| `test/terrain-real.test.js` | terreny real (fase A, TA-1 a TA-9), proves de propietats: el fitxer es descodifica igual d'un `Uint8Array` i d'un `ArrayBuffer`, aeroports plans a `A.elev` sense excavacions, mar i terra on toca (també als deltes), cims dins del marge de 250 m, rebaixa urbana ≤ 25 m, normals contínues, Photo mana, senda de cada cap amb aproximació directa (`glidePathMargin`) i caps sense aproximació directa que de debò no la compleixen. Les proves que necessiten el terreny el carreguen amb `test/helpers/terrain.js` |
| `test/smoke.test.js` | els mòduls carreguen i exporten el que toca; un `FlightModel` avança amb valors plausibles. **Actualitza'l** quan s'afegeixi un export que la resta del joc necessiti o canviï el nombre d'avions |

### Dades d'aeroports: `tools/airports-ourairports.mjs`

`node tools/airports-ourairports.mjs [dir]`. No forma part de `npm test` i, amb
`tools/terrain-build.mjs`, és l'únic lloc del projecte que fa peticions de xarxa: baixa `runways.csv` i
`airports.csv` d'OurAirports (o els llegeix de `dir`) i reescriu
`src/world/airport-data.js`, que es comiteja. El joc i les proves només
llegeixen el fitxer generat. Regles a la capçalera de l'script i a
`docs/DECISIONS.md` (01/10/2026, H2); el que no surt d'OurAirports (ILS, noms
curts, terreny) és la taula `EXTRA` de l'script, les designacions que
OurAirports té antigues (LEGE 02/20) són a `IDS_OVERRIDE`, i la mida surt de
`BALANCE.airportSize`. Per afegir un aeroport: `ORDER` i `EXTRA`, i tornar-lo
a córrer.

### Terreny real: `tools/terrain-build.mjs`

`node tools/terrain-build.mjs [dir]`. No forma part de `npm test`. Baixa de
`copernicus-dem-30m.s3.amazonaws.com` (o llegeix de `dir`, i hi desa el que
baixa) les tessel·les de Copernicus GLO-30 que cobreixen `World.G` (DEM i
màscara d'aigua WBM) i reescriu `public/terrain/terrain-250.bin`, que es
comiteja: alçada mitjana de cada cel·la de 250 m (sense els píxels de mar) i
distància signada a la costa a partir de la WBM (mar = oceà). El remostreig és
per lon/lat amb la projecció del joc (`ll`). El format és a la capçalera de
`world/terrain-data.js`; el joc el carrega amb `World.load(bytes)` (fetch a
`index.html`, `readFileSync` a les proves). Si es canvia `World.G` o la
projecció, cal tornar-lo a córrer. Decisions a `docs/DECISIONS.md`
(02/10/2026, TA-1 a TA-9); les aproximacions sobre el terreny real (senda per
cap, caps sense aproximació directa) són a `APPROACH_DATA` d'`airports.js`.

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

Estat real de cada tasca. El detall de cada decisió és a `docs/DECISIONS.md`;
aquí només hi ha què existeix i què falta. **Total de proves vigent: 1862 proves**
(`npm test`); no s'apunten comptes per tasca perquè es queden vells.

### Ordre de feina (26/09)

Les tasques s'agrupen en un sol PR i s'executen en aquest ordre: F4+F5, B5,
C1, C2, C3+C4, C5+D1, D2+D5, D3+D4, D6, E1+E5, E2, E3+E4, F1+F2, F3, i al
final (opcionals) D7 i M1–M3. Les taules de sota no canvien.

Dependències estrictes. Cada tasca és un PR contra `dev` amb `npm test` en verd.

### Bloc A — Fonaments

| Id | Tasca | Depèn de | Estat |
| --- | --- | --- | --- |
| A1 | `src/i18n/`: `t`, formatadors, `en.js`, `ca.js` | — | **Fet** |
| A2 | `src/platform/`: `storage.js`, `env.js` (`IS_DEV`), `entropy.js` | — | **Fet** |
| A3 | `src/core/flight-recorder.js` | — | **Fet** |
| A4 | Enganxar el recorder a `Game` a `index.html` | A3 | **Fet**. Un vol lliure imprimeix el `FlightRecord` a la consola si `IS_DEV`, un sol cop per vol |
| A5 | `src/career/state.js` i `types.js` | A1 | **Fet** |

### Bloc B — Economia headless

| Id | Tasca | Depèn de | Estat |
| --- | --- | --- | --- |
| B1 | `balance.js` complet | A5 | **Fet** |
| B2 | `landing.js`, `demand.js`, `economy.js` | B1 | **Fet** |
| B3 | `wear.js`, `damage.js` | B2 | **Fet**. La factura de danys depèn de l'fpm i la g del contacte, no de la nota |
| B4 | `progression.js` | B2 | **Fet** |
| B5 | `tools/balance.mjs`, `finance.js`, `crew.js`, `rng.js` i calibratge de `K` | B2–B4 | **Fet**. Compleix el criteri de §10 sobre 50 llavors |

**Cap línia d'interfície d'Airline abans que B5 passi.**

### Bloc C — Escola de vol

| Id | Tasca | Depèn de | Estat |
| --- | --- | --- | --- |
| C1 | `career/lessons.js` (dades) i `career/school.js` (motor de criteris) | A3, B4 | **Fet** |
| C2 | `app/`: bus, `setFlightLauncher`, `onFlightFinished`, `save.js` | A2, A5 | **Fet** |
| C3 | Executor de lliçons: `app/lesson-run.js`, `app/lesson-session.js`, instructor al HUD i criteris en viu a `index.html`, panell DEV | C1, C2, A4 | **Fet**, les vuit lliçons |
| C4 | Ajudes de l'escola: barra d'arrodoniment (D7) i debrief automàtic (D8), `app/debrief.js` | C3 | **Fet**, només a la lliçó 7 |
| C5 | Pantalla d'escola, graduació (`graduate` a `progression.js`) i guia de consulta | C3 | **Fet** amb D1 |

### Bloc D — Centre d'operacions

| Id | Tasca | Depèn de | Estat |
| --- | --- | --- | --- |
| D1 | Menú principal Free Flight / Airline, `src/ui/`, barra superior, exportar i importar, panell DEV | C5 | **Fet**. Les pestanyes sense contingut mostren "Available soon" |
| D2 | Fleet | D1, B3 | **Fet** amb D5 (`app/market.js`, `ui/fleet.js`, venda amb `sellQuote`/`sellAircraft`) |
| D3 | Dispatch: taulell de sortides, produeix l'`opts` del vol | D2, B2 | **Pendent**. En liquidar cada vol, ha de passar a `computeFlightResult` el `revenueMult` de la categoria de l'avió i a `applyFlightWear` el seu `wearMult`. El lloguer (G1) va amb D3+D4 |
| D4 | Briefing i debrief amb compte de resultats | D3, A4 | **Pendent** |
| D5 | Market: mercat d'ocasió amb categories | D2 | **Fet** (`career/market.js`, `purchaseRule`/`buyAircraft`, `ui/market.js`, `--tier` i `--tiers` al harness). Sense lloguer |
| D5b | Market en targetes, ofertes i imatges | D5 | **Fet** (K1–K5) |
| D6 | Pilot, Finance, Crew, Map | D1 | **Pendent** |
| D7 | Escena 3D del menú, reaprofitant càmera i escenografia | D1 | **Pendent** (opcional) |

### Bloc E — Bucle complet

| Id | Tasca | Depèn de | Estat i nota |
| --- | --- | --- | --- |
| E1 | `career/clock.js` i posició de la flota | D4 | **Pendent**. L'avió queda on aterra. `clock.minute` només existeix com a camp de l'estat |
| E2 | Manteniment, revisions i avaries en vol | B3, E1 | **Pendent**. Les avaries són esdeveniments nous del `FlightModel`; tira les avaries amb `failureChance` de `wear.js` i `draw(state)`. Desgast extra de motors per TOGA prolongat: cal una dada nova al `FlightRecord` |
| E3 | Detector de creuer estable i ×32 | A4 | **Pendent**. Estén `Game.cycleAccel` (ara fins a ×16), no el substitueix; el bucle de `Game` limita a `16 * 12` passos per frame |
| E4 | Salt de creuer | E3 | **Pendent**. El recorder (`cruiseSkip`) i `economy.js` (penalització del 8 %) ja ho preveuen |
| E5 | `career/dispatch.js`, vols automàtics | E1, B4 | **Pendent**. Resolució en aterrar, llavor desada; cada vol despatxat aplica `applyFlightWear`. El bus ja té els temes `rank:up` i `dispatch:resolved`, sense emissors |

### Bloc F — Contingut (paral·lel, delegable)

| Id | Tasca | Estat |
| --- | --- | --- |
| F1 | Més aeroports (fases 1 i 2 del disseny) | **Fet** amb F2: LEGE, LERS, LEIB, LEMH, LELL, LEDA i LESU, de `world/airport-data.js` (generat per `tools/airports-ourairports.mjs`); aproximació a tots els caps (ILS o RNP), ruta fins al FF i regles de `world/route.js` (H1–H17) |
| F1b | Fase 3: LEVC, LEAL, LECH, LFMP | **Pendent**. Cal ampliar la graella (`World.G`, ara fins a n = −300 km) i tornar a córrer `tools/terrain-build.mjs` (el relleu i la costa ja són els reals, fase A); el dibuix de la costa del ND (`COAST.mainland`) acaba a lat 39,95. La senda de cada cap nou, sobre el terreny real (`glidePathMargin`, `APPROACH_DATA`). Després, mateix pipeline: `ORDER` i `EXTRA` de l'script |
| F2 | Taxiways i portes procedimentals | **Fet** amb F1, tots menys LEBL i LEPA (`proceduralDef`, `makeAirport`, `taxiRoute`) |
| F3 | `world/weather.js` amb llavor | **Fet** (contracte a §7), sense cablejar al joc: l'E1 hi passarà el rellotge |
| F4 | Migjorn Mi-9 i Xaloc X-90 a `aircraft-data.js` | **Fet**. Ids `commuter` i `rj` |
| F5 | Variants G-42, M-100, M-300, L-900ER | **Fet**. Ids `tpShort`, `nbShort`, `nbStretch` i `wbEr`. G-72F i T-4F, ajornats fins que hi hagi contractes de càrrega |
| F6 | Geometria pròpia del Mi-9 i del X-90; taula de flaps pròpia del M-300; refer les proporcions del X-90 | **A mitges**: fet només el visual (`core/model-geom.js`, pilons del X-90). **Pendent**: la taula de flaps del M-300 (física, el harness passa justet) i les proporcions del X-90 (backlog) |

### Bloc M — Migració pendent (paral·lel, baixa prioritat)

Mateixes regles que `MIGRACIO.md`: només moure, un fitxer per commit.

| Id | Tasca | Estat i nota |
| --- | --- | --- |
| M1 | `import * as THREE from 'three'` en comptes del CDN | **Pendent**. Versió fixada a 0.128 |
| M2 | Seccions 8c–13 a `src/render/` | **Pendent**. Les proves no cobreixen el render: cal revisió visual |
| M3 | Seccions 14–20 a `src/ui/` i `src/app/`; textos existents a i18n | **Pendent**. `Game` surt d'`index.html` i desapareix `setFlightLauncher` |

Les proves no veuen el render. Per a M1–M3, cada PR ha d'incloure una llista
de comprovació visual: vol de dia i de nit a LEBL i LEPA, les quatre càmeres,
els avions, aterratge amb informe.

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
