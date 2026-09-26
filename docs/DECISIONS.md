# Registre de decisions

Una linia per decisio, amb data. Serveix per no rediscutir el mateix d aqui a quatre mesos.

## 2026-09-22 — Ruleset de main amb 0 aprovacions

Posat a 0 temporalment per poder treballar sol. PENDENT: pujar a 1 quan el company accepti la invitacio a l organitzacio.

## 2026-09-22 — Repositori public dins l organitzacio AtlasLabs08

Public perque el codi no es el fossat del projecte i construir en public es marqueting barat. Organitzacio i no compte personal perque el projecte no pengi de cap dels dos.

## 2026-09-26 - Mode Airline: disseny de Nivell 1 tancat
Dos modes, Free Flight i Airline. Economia en euros amb costos reals i un factor global K. Detall a ENGINEERING.md.

## 2026-09-26 - Entorn de proves a Cloudflare Pages
dev es publica a pont-aeri.pages.dev passant npm test i build. main segueix a GitHub Pages per als amics.

## 2026-09-26 - three fixat a 0.128
Es la r128 que carrega el CDN. La r129 i posteriors canvien per defecte la llum i els colors.

## 2026-09-26 - Dos avions nous i sis variants
Migjorn Mi-9 i Xaloc X-90, derivats de la fisica existent. No es el mercat enorme que el BACKLOG descarta.

## 2026-09-26 - Sense perdua total de l avio
Es mante el BACKLOG. Un accident costa fins al 60 % del valor i fins a 6 setmanes a terra.

## 2026-09-26 - BALANCE omplert sense pujar version
B1 omple balance.js i deixa version: 1. Encara no hi ha cap partida desada de jugadors, i per tant no cal cap migracio. A partir d ara, qualsevol canvi de valor puja version. (Regla de versio substituida, vegeu l'entrada del 26/09/2026.)

## 2026-09-26 - BALANCE.version a 1 fins que Airline arribi a main
BALANCE.version es queda a 1 fins que el mode Airline arribi a main. Mentre no hi hagi partides reals de jugadors, afegir o canviar valors de balance.js no puja version ni afegeix migracio. A partir del primer merge d'Airline a main, qualsevol canvi de valor puja version i porta la seva migracio a career/state.js.
