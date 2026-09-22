# Migracio: d'un fitxer a modul

Estat: pas 2 i 3 de la migracio. Branca `refactor/extreure-core`.

## Abans de moure res

Obre el joc original i corre el harness des del panell de depuracio.
**Copia els numeros i enganxa'ls aqui sota.** Son el teu patro de comparacio:
si despres de la migracio surten diferents, has trencat alguna cosa.

```
(enganxa aqui la sortida del harness ABANS de tocar res)
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
