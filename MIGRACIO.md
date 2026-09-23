# Migracio: d'un fitxer a modul

Estat: pas 2 i 3 de la migracio. Branca `refactor/extreure-core`.

## Abans de moure res

Obre el joc original i corre el harness des del panell de depuracio.
**Copia els numeros i enganxa'ls aqui sota.** Son el teu patro de comparacio:
si despres de la migracio surten diferents, has trencat alguna cosa.

```
=== tp — Garbí G-72 — PASS ===
ok   Rotation speed VR: 112.47 kt [100, 118]
ok   Take-off ground roll: 1044.38 m [750, 1350]
ok   Take-off distance to 35 ft: 1472.72 m [1000, 1650]
ok   Initial climb rate: 1434.11 fpm [1000, 2100]
ok   Stall speed clean: 111.77 kt [108, 118]
ok   Stall speed full flaps: 91.19 kt [87, 96]
ok   Stall break: nose drop: 19.56 deg [3, 90]
ok   Stall wing drop, 6 s of back pressure: 10.14 deg [1, 22]
ok   Approach speed (Vref+5): 116.58 kt [108, 122]
ok   Approach pitch attitude: 0.45 deg [0, 1]
ok   Approach torque: 30.89 % [15, 60]
ok   Touchdown sink rate: 223.30 fpm [30, 360]
ok   Landing ground roll: 605.55 m [400, 850]
ok   Landing distance from 50 ft: 912.61 m [800, 1400]
ok   Touchdown load at 150 fpm: 1.21 g [1.05, 1.3]
ok   Touchdown load at 300 fpm: 1.36 g [1.25, 1.45]
ok   Touchdown load at 500 fpm: 1.81 g [1.55, 1.95]
ok   Touchdown load at 600 fpm: 2.12 g [1.85, 2.25]
ok   AP altitude capture error: 0.31 ft [0, 60]
ok   AP heading capture error: 0.00 deg [0, 2]
ok   A/THR speed error: 0.30 kt [0, 4]
ok   ILS: LOC and G/S captured: 2.00 modes [2, 2]
ok   Coupled ILS: centreline error at 200 ft: 0.08 m [0, 8]
ok   Coupled ILS: glide path error at 200 ft: 0.02 ft [0, 20]
ok   Autopilot hands over at 100 ft: 1.00  [1, 1]
ok   Parking brake creep (10 s): 0.00 m [0, 0.05]
ok   180 deg taxi turn diameter: 39.73 m [9.9, 44.550000000000004]

=== nb — Mestral M-200 — PASS ===
ok   Rotation speed VR: 148.53 kt [135, 155]
ok   Take-off ground roll: 1543.52 m [1200, 2000]
ok   Take-off distance to 35 ft: 2174.10 m [1500, 2400]
ok   Initial climb rate: 3147.21 fpm [2000, 3800]
ok   Stall speed clean: 151.75 kt [148, 160]
ok   Stall speed full flaps: 110.20 kt [107, 116]
ok   Stall break: nose drop: 10.06 deg [3, 90]
ok   Stall wing drop, 6 s of back pressure: 13.80 deg [1, 22]
ok   Approach speed (Vref+5): 140.83 kt [132, 146]
ok   Approach pitch attitude: 3.18 deg [2.5, 3.5]
ok   Approach N1: 54.34 % [38, 72]
ok   Touchdown sink rate: 326.63 fpm [30, 360]
ok   Landing ground roll: 875.20 m [650, 1300]
ok   Landing distance from 50 ft: 1186.80 m [1100, 1900]
ok   Touchdown load at 150 fpm: 1.22 g [1.05, 1.3]
ok   Touchdown load at 300 fpm: 1.39 g [1.25, 1.45]
ok   Touchdown load at 500 fpm: 1.79 g [1.55, 1.95]
ok   Touchdown load at 600 fpm: 2.05 g [1.85, 2.25]
ok   AP altitude capture error: 0.02 ft [0, 60]
ok   AP heading capture error: 0.00 deg [0, 2]
ok   A/THR speed error: 0.02 kt [0, 4]
ok   ILS: LOC and G/S captured: 2.00 modes [2, 2]
ok   Coupled ILS: centreline error at 200 ft: 0.09 m [0, 8]
ok   Coupled ILS: glide path error at 200 ft: 0.03 ft [0, 20]
ok   Autopilot hands over at 100 ft: 1.00  [1, 1]
ok   Parking brake creep (10 s): 0.00 m [0, 0.05]
ok   180 deg taxi turn diameter: 45.50 m [11.6, 52.199999999999996]

=== wb — Llevant L-900 — PASS ===
ok   Rotation speed VR: 161.05 kt [150, 178]
ok   Take-off ground roll: 1769.72 m [1600, 2800]
ok   Take-off distance to 35 ft: 2367.59 m [2000, 3300]
ok   Initial climb rate: 3277.56 fpm [1800, 3800]
ok   Stall speed clean: 166.21 kt [160, 172]
ok   Stall speed full flaps: 120.78 kt [117, 126]
ok   Stall break: nose drop: 11.34 deg [3, 90]
ok   Stall wing drop, 6 s of back pressure: 6.91 deg [1, 22]
ok   Approach speed (Vref+5): 153.83 kt [146, 160]
ok   Approach pitch attitude: 2.62 deg [2, 3]
ok   Approach N1: 52.64 % [38, 72]
ok   Touchdown sink rate: 79.56 fpm [30, 360]
ok   Landing ground roll: 949.09 m [900, 1800]
ok   Landing distance from 50 ft: 1525.54 m [1350, 2400]
ok   Touchdown load at 150 fpm: 1.17 g [1.05, 1.3]
ok   Touchdown load at 300 fpm: 1.30 g [1.25, 1.45]
ok   Touchdown load at 500 fpm: 1.69 g [1.55, 1.95]
ok   Touchdown load at 600 fpm: 1.99 g [1.85, 2.25]
ok   AP altitude capture error: 0.01 ft [0, 60]
ok   AP heading capture error: 0.00 deg [0, 2]
ok   A/THR speed error: 0.01 kt [0, 4]
ok   ILS: LOC and G/S captured: 2.00 modes [2, 2]
ok   Coupled ILS: centreline error at 200 ft: 0.21 m [0, 8]
ok   Coupled ILS: glide path error at 200 ft: 0.06 ft [0, 20]
ok   Autopilot hands over at 100 ft: 1.00  [1, 1]
ok   Parking brake creep (10 s): 0.00 m [0, 0.05]
ok   180 deg taxi turn diameter: 54.49 m [28.7, 129.15]

=== jumbo — Tramuntana T-4 — PASS ===
ok   Rotation speed VR: 159.47 kt [150, 175]
ok   Take-off ground roll: 2045.96 m [1800, 3000]
ok   Take-off distance to 35 ft: 2937.36 m [2200, 3500]
ok   Initial climb rate: 1940.71 fpm [1500, 3200]
ok   Stall speed clean: 170.90 kt [165, 178]
ok   Stall speed full flaps: 122.35 kt [119, 128]
ok   Stall break: nose drop: 7.86 deg [3, 90]
ok   Stall wing drop, 6 s of back pressure: 6.65 deg [1, 22]
ok   Approach speed (Vref+5): 156.29 kt [148, 163]
ok   Approach pitch attitude: 1.91 deg [1, 2.5]
ok   Approach N1: 60.31 % [38, 72]
ok   Touchdown sink rate: 103.08 fpm [30, 360]
ok   Landing ground roll: 1026.21 m [1000, 2000]
ok   Landing distance from 50 ft: 1407.27 m [1400, 2600]
ok   Touchdown load at 150 fpm: 1.29 g [1.05, 1.3]
ok   Touchdown load at 300 fpm: 1.37 g [1.25, 1.45]
ok   Touchdown load at 500 fpm: 1.85 g [1.55, 1.95]
ok   Touchdown load at 600 fpm: 2.18 g [1.85, 2.25]
ok   AP altitude capture error: 0.02 ft [0, 60]
ok   AP heading capture error: 0.00 deg [0, 2]
ok   A/THR speed error: 0.01 kt [0, 4]
ok   ILS: LOC and G/S captured: 2.00 modes [2, 2]
ok   Coupled ILS: centreline error at 200 ft: 0.29 m [0, 8]
ok   Coupled ILS: glide path error at 200 ft: 0.07 ft [0, 20]
ok   Autopilot hands over at 100 ft: 1.00  [1, 1]
ok   Parking brake creep (10 s): 0.00 m [0, 0.05]
ok   180 deg taxi turn diameter: 90.65 m [23.45, 105.52499999999999]
```

## Mapa de talls

Cada fitxer de `src/` porta a la capcalera les linies exactes de l'original
i que ha d'exportar.

| Linies | Va a |
| --- | --- |
| 119-197 | `src/core/constants.js` + `src/core/noise.js` |
| 198-431 | `src/core/aircraft-data.js` |
| 432-459 | `src/core/atmosphere.js` |
| 460-864 | `src/core/flight-model.js` |
| 865-905 | `src/core/trim.js` |
| 906-1057 | `src/core/autopilot.js` |
| 1058-1271 | `src/core/harness.js` |
| 1272-1368 | `src/world/geo.js` |
| 1369-1465 | `src/world/airports.js` |
| 1466-1638 | `src/world/terrain.js` |
| 1639-1685 | `src/world/ils.js` |
| 1686+ | encara no. Toca navegador (fetch, location). Queda a l'HTML. |

Les linies 119-1685 no fan servir CAP global de navegador. Ni `window`, ni
`document`, ni `THREE`. Per aixo surten netes i corren en Node.

## Ordre de treball

1. `constants.js` i `noise.js` primer. No depenen de res.
2. `atmosphere.js`. Depen nomes de constants.
3. `aircraft-data.js`. Copiar i enganxar, es dades.
4. `flight-model.js`. El gros.
5. `trim.js`, `autopilot.js`.
6. `harness.js`.
7. `npm test` -> les proves de fum han de passar.
8. Despres `world/`, en el mateix ordre del mapa.
9. `npm test` -> el harness sencer ha de passar amb els mateixos numeros d'abans.

Fes commit despres de cada fitxer. Un fitxer = un commit. Si alguna cosa peta
sabras exactament on.

## La regla

**Nomes moure i exportar. Cap formula canvia.**

Si veus una cosa millorable mentre mous codi, apunta-la a `docs/BACKLOG.md`
i segueix. Barrejar refactor i millores es la manera mes rapida de no saber
mai que ha trencat que.

## Prompt per al model

Si ho fas amb ajuda d'un model, dona-li el fitxer original i una cosa aixi,
**fitxer per fitxer, no tot de cop**:

> Aixo es un simulador de vol en un sol fitxer HTML. Vull extreure les linies
> X a Y a un modul ES6 a `src/core/NOM.js`.
>
> Regles estrictes:
> - Mou el codi literalment. No canviis ni una formula, ni un nom de variable,
>   ni l'ordre de les operacions.
> - Afegeix `export` davant del que et digui la capcalera del fitxer destinacio.
> - Afegeix els `import` que calguin dels moduls ja fets.
> - Si una cosa que necessites encara no esta extreta, digues-m'ho en comptes
>   d'inventar-la.
> - No afegeixis comentaris nous, no reformatis, no "milloris" res.
>
> Tornam nomes el contingut del fitxer.

La part de "digues-m'ho en comptes d'inventar-la" es la important. Sense
aixo el model s'omple els buits ell sol i et trenca coses que no veus.
