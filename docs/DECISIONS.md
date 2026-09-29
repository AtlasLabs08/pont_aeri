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

## 2026-09-26 - Revisio del B2: el que queda fora d economy.js
- El cost per cicle del manteniment no es a economy.js: el calcula wear.js a B3.
- Als vols de contracte, el pagament es contractFeePerLeg[cls] * rankPayMult * m_aterratge. Decisio d'en Marc: la nota tambe compta quan l'avio no es teu.
- Un accident fixa el tram d'aterratge al de nota 0.

## 2026-09-26 - B3: desgast per dia d operacio
Cada vol pilotat en un avio propi compta com un dia d'operacio per al desgast (dayHours per classe). Els vols despatxats (E5) tambe.

## 2026-09-26 - B3: l engine overhaul no te comptador propi
L'engine overhaul no te comptador propi: es una accio que el jugador fa quan vol.

## 2026-09-26 - B3: cicles del dia d operacio i factor de rotacio
Els cicles del dia d'operacio (fins a ~15) i el factor de rotacio de l'economia (fins a 2,7) no es corresponen; es revisa al B5.

## 2026-09-26 - Els agents pugen la seva branca i obren el PR (PR #6)
L'agent puja la seva branca (git push -u origin <branca>) i obre el PR contra dev. Mai fa push a dev ni a main. Ho diuen CLAUDE.md, AGENTS.md i la regla 9 de la seccio 0 d'ENGINEERING.md.

## 2026-09-26 - B4: progressio del pilot
- Baixada de rang proporcional, no d'un grao sencer: el rang es deriva sempre de l'XP. Si un accident et deixa per sota del llindar, baixes al rang que et correspon, ni mes ni menys.
- Els multiplicadors d'XP (turbulencia, meteo dura, dificultat d'aeroport) nomes s'apliquen a l'XP positiva. Un mal aterratge amb turbulencia no resta mes.
- Els check-rides de les habilitacions de tipus son del motor de l'escola (C1). progression.js nomes compra l'habilitacio quan el check-ride ja s'ha passat.
- L'endorsement de vent creuat fort (crosswind) no te rang minim: rank 'student' a BALANCE.endorsements.

## 2026-09-26 - Baixar de rang no treu habilitacions
Un pilot que baixa de rang conserva les habilitacions i els endorsements que ja tenia. canFlyType no mira el rang. Decisio d'en Marc.

## 2026-09-26 - A4: sortida de pista (excursion)
Sortida de pista (excursion): rolloutMetres > touchdown.remaining.

## 2026-09-26 - F4+F5: ids i classes dels avions nous
- commuter: Migjorn Mi-9, classe commuter, 19 seients, habilitacio commuter.
- rj: Xaloc X-90, classe narrowbody, 100 seients, habilitacio narrowbody.
- tpShort: Garbi G-42, classe turboprop, 48 seients, habilitacio turboprop.
- nbShort: Mestral M-100, classe narrowbody, 140 seients, habilitacio narrowbody.
- nbStretch: Mestral M-300, classe narrowbody, 220 seients, habilitacio narrowbody.
- wbEr: Llevant L-900ER, classe widebody, 290 seients, habilitacio widebody.
BALANCE.version es queda a 1 (vegeu l'entrada del 26/09/2026 sobre BALANCE.version).

## 2026-09-26 - El Xaloc X-90 es narrowbody
Tot i ser un jet regional, el X-90 fa servir les tarifes de narrowbody (tripulacio, manteniment, contractes, rotacio) i demana l'habilitacio narrowbody. No hi ha classe regional a BALANCE.

## 2026-09-26 - G-72F i T-4F ajornats
Les variants de carrega no s'afegeixen fins que hi hagi contractes de carrega.

## 2026-09-26 - Geometria 3D reaprofitada fins a F6
Cada avio nou dibuixa el MODEL_GEOM del seu avio base escalat a la seva mida: Mi-9 i G-42 del G-72; X-90, M-100 i M-300 del M-200; L-900ER del L-900. La geometria propia del Mi-9 (ala alta, fuselatge curt) i del X-90 (motors a cua) es la tasca F6. La fisica del X-90 ja porta els motors a cua.

## 2026-09-26 - F4+F5: rangs del harness al bloc expect
Els rangs dels avions nous son al bloc expect de cada avio a aircraft-data.js, com els quatre existents: Harness.run els llegeix d'alla i harness.test.js no canvia. Els avions nous entren a AIRCRAFT_ORDER al mateix commit que fleetTypes, smoke i snapshot, perque cada commit quedi en verd.

## 2026-09-26 - snapshot.json regenerat per F4+F5
F4+F5 canvien la fisica a proposit. snapshot.json es regenera amb node test/snapshot.test.js --update: nomes s'hi afegeixen les entrades dels sis avions nous, i els 108 valors de tp, nb, wb i jumbo son identics.

## 2026-09-26 - Noms propis i panell DEV fora d'i18n
Decisio d'en Marc. Els noms propis (noms de companyia pintats a les lliurees, com Velanta Regional o Solquer, i noms dels models d'avio) no passen per i18n perque no es tradueixen. El panell DEV no es interficie de jugador i queda fora de l'abast d'i18n; a mes, core/ no pot importar d'i18n/ (seccio 3 d'ENGINEERING.md), i els noms que mostra el panell surten de Harness.run, a core/.

## 2026-09-27 - B5: preus d'ocasio de referencia
Proposats per en Marc. BALANCE.usedPrice, en euros: commuter 350.000, tpShort 1.100.000, tp 1.800.000, rj 4.500.000, nbShort 6.500.000, nb 8.000.000, nbStretch 10.000.000, wb 22.000.000, wbEr 25.000.000, jumbo 30.000.000.

## 2026-09-27 - B5: financament dels avions
30 % d'entrada i la resta en quotes constants per vol, mai pel pas del temps. Interes per vol 0,004, el mateix que el credit inicial. Termini final: 340 vols (BALANCE.financing; era 260 abans del calibratge robust). Ho calcula career/finance.js.

## 2026-09-27 - B5: quotes dels prestecs fora de K*r
Decisio d'en Marc. Les quotes dels prestecs es paguen del cash tal qual, fora de K*r: el preu d'un avio es en euros reals. Divergencia de docs/DESIGN.md, que posa el financament entre els costos del tram (C): computeFlightResult encara accepta financePerFlight, pero el harness no el fa servir.

## 2026-09-27 - B5: termini del credit inicial
Decisio d'en Marc. El credit inicial (250.000 EUR) te el mateix termini que el financament dels avions: BALANCE.startingLoan.termFlights = 260 (ara 340), un valor propi del startingLoan. Una prova de balance.test.js comprova que coincideixen.

## 2026-09-27 - B5: rangs calibrats
Decisio d'en Marc. Llindars d'XP calibrats amb el harness perque cada rang que demana una classe arribi a +-5 vols del moment en que hi ha diners per a l'entrada: private 650, commercial 1.250, atpl 1.950, captain 2.450, instructor 3.200 (uns 60 vols despres del jumbo). Amb la llavor per defecte: private al vol 51 (diners al 53), commercial al 93 (96), atpl al 144 (146), captain al 188 (193), instructor al 253 (jumbo + 60). (Valors substituits pel calibratge robust sobre 50 llavors, vegeu l'entrada corresponent.) Sense multiplicador d'XP per classe d'avio. Divergencia de docs/DESIGN.md: la taula de rangs deia 500, 2.000, 6.000, 15.000 i 35.000.

## 2026-09-27 - B5: XP perduda per accident
Decisio d'en Marc. BALANCE.crash.xpLoss passa de [200, 1500] a [35, 230]: l'accident mes lleu costa l'XP d'uns 3 vols mitjans i el mes greu la d'uns 20 (11,5 XP per vol mitja al harness). (Ara [30, 200], vegeu el calibratge robust sobre 50 llavors.)

## 2026-09-27 - B5: preu de referencia calibrat per classe
Decisio d'en Marc. BALANCE.demand.pRef passa de 90 + 0,60 EUR/km a 260 + 0,09 EUR/km: puja les rutes curtes i evita que el llarg radi es dispari. Amb K = 2,6 els cinc tipus base queden dins del +-20 % de la Corba objectiu (net per vol sol / amb tripulacio completa): Mi-9 -19 % / -18 %, G-72 +19 % / +15 %, M-200 +18 % / +19 %, L-900 -11 % / -13 %, T-4 -16 % / -11 %. rotation.cap no s'ha tocat. (Ara 290 + 0,10 EUR/km amb K = 2,4, vegeu el calibratge robust sobre 50 llavors.)

## 2026-09-27 - B5: cost de contractacio de tripulacio
Decisio d'en Marc. BALANCE.crewHireCost, cost unic per tripulacio i classe: commuter 42.000, turboprop 60.000, narrowbody 180.000, widebody 200.000. El sou no hi es: ja es dins dels costos del tram multiplicats pel factor de rotacio. Ho calcula career/crew.js (maxCrew, hireCrew). Divergencia de docs/DESIGN.md, que no posava preu a contractar tripulacio. Amb la llavor per defecte la primera tripulacio arriba al vol 10. (Ara commuter 44.000 i narrowbody 100.000, vegeu el calibratge robust sobre 50 llavors.)

## 2026-09-27 - B5: reserva del harness en contractar tripulacio
El jugador simulat contracta una tripulacio per vol, nomes si no compra la classe seguent i si despres de pagar-la li queda cash per a 1,2 contractacions mes (HARNESS.crewReserve).

## 2026-09-27 - B5: valor final de K i del termini
Correccio: aquesta entrada deia que el calibratge complia a partir d'una sola llavor (la per defecte: K 2,6, termini de 260 vols, salts de 53, 43, 50 i 47 vols, 4,0 % de vols en negatiu, actes de 12,3, 10,9 i 14,9 h). Una sola llavor no ho demostra: amb la nota truncada de debo, la mateixa llavor ja no complia, i sobre 50 llavors tampoc. Els valors finals son els de l'entrada "B5: calibratge robust sobre 50 llavors": K 2,4 i termini de 340 vols.

## 2026-09-27 - B5: criteris nous de la seccio 10
Decisio d'en Marc. Per a aquest calibratge, cada salt de classe entre 40 i 50 vols (en comptes de 25 a 35) i cap acte de mes de 16 h de joc (en comptes de 12). Com que la primera tripulacio ha d'arribar entre el vol 8 i el 12, nomes el primer salt (commuter -> turbohelix) pot arribar fins a 55 vols. Es mante menys del 12 % de vols en negatiu.

## 2026-09-27 - B5: suposicions acceptades del harness
Decisio d'en Marc. El harness no fa servir weatherBonus (0), no simula accidents ni asseguranca, deixa la reputacio a 50 i no mesura l'ultim acte, que queda obert. Vola els tipus base (Mi-9, G-72, M-200, L-900, T-4), cadascun en una rotacio d'aeroports fixa.

## 2026-09-27 - B5: cicles del dia d'operacio
Els ~15 cicles del dia d'operacio de wear.js i el factor de rotacio maxim (2,7) no es corresponen. Decisio d'en Marc: no es toca ara; es revisa a l'E2.

## 2026-09-27 - B5: draw() a career/rng.js
draw(state) de la seccio 7 d'ENGINEERING.md viu a src/career/rng.js, exportat pel barrel de career/. El harness economic en treu tot l'atzar.

## 2026-09-27 - B5: criteri robust de la seccio 10
Decisio d'en Marc. El criteri del B5 es mesura sobre 50 llavors (npm run balance --seeds 50), no sobre una. Mediana: cada salt de classe entre 40 i 50 vols (el primer fins a 55), primera tripulacio entre el vol 8 i el 12, menys del 12 % de vols en negatiu, cap acte de mes de 16 h de joc. Percentil 90 (rang mes proper): cap salt de mes de 60 vols, cap acte de mes de 20 h. Els cinc tipus base dins del +-20 % de la Corba objectiu (amb tots els vols de les 50 llavors). Un salt o un acte que no arriba dins dels 200 vols compta com a infinit. Substitueix els criteris d'una sola llavor de l'entrada "B5: criteris nous de la seccio 10", que es mantenen com a llindars de la mediana.

## 2026-09-27 - B5: la nota del harness es una normal truncada
La nota d'aterratge del jugador simulat es torna a tirar fins que cau a [0, 100] (normal truncada, com diu la seccio 10), en comptes de retallar-la. Amb el retall, els vols que sortien per sobre de 100 treien 100 (textbook, 55 XP) i l'XP mitjana per vol era 11,5; amb la truncada es 9,9.

## 2026-09-27 - B5: calibratge robust sobre 50 llavors
Decisio d'en Marc: nomes es toquen rangs, crash.xpLoss, K, el termini dels prestecs, demand.pRef i crewHireCost. Valors finals:
- K 2,4 (era 2,6).
- Termini del financament i del credit inicial: 340 vols (era 260).
- demand.pRef: 290 + 0,10 EUR/km (era 260 + 0,09). LEBL-LEPA -> 310,20 EUR.
- crewHireCost: commuter 44.000, turboprop 60.000, narrowbody 100.000, widebody 200.000 (commuter era 42.000 i narrowbody 180.000).
- Rangs: private 600, commercial 1.100, atpl 1.500, captain 1.950, instructor 2.550 (uns 60 vols despres de la mediana del jumbo, al vol 176).
- crash.xpLoss: [30, 200], uns 3 i uns 20 vols mitjans d'XP (9,9 XP per vol).
Resultat sobre les llavors 20260927 a 20260976 (mediana / p90): primera tripulacio 9 / 12; salts 47 / 55, 42 / 52, 42 / 50 i 42 / 56 vols (el jumbo no arriba dins dels 200 vols en 4 de les 50); vols en negatiu 4,5 / 6,5 %; actes 10,9 / 12,8, 10,6 / 13,2 i 12,5 / 14,9 h. Corba objectiu (sol / complet): commuter -8 / -8 %, turbohelix +18 / +15 %, M-200 +11 / +12 %, L-900 -3 / -4 %, T-4 +8 / +13 %. El p90 del salt al jumbo es el mes ajustat: el llindar de captain el mou molt (1.925 dona 41 / 56 amb una mediana a 1 vol del minim; 1.975 dona 42 / 69).

## 2026-09-27 - C1: lessons.js, excepcio a la regla 4
src/career/lessons.js es un fitxer de dades amb els llindars de pilotatge de les llicons i dels check-rides: ft, vistes, comandaments, notes i nusos del setup (3.000 ft, 200 ft, 4 vistes, 6 comandaments, notes de 70 i 80, 12 kt de vent creuat). Es una excepcio a la regla 4 de la seccio 0 d'ENGINEERING.md: els valors economics i passScore, mercyScore i mercyAttempt de l'escola continuen a BALANCE.school. El criteri de nota de la llico 7 no porta el 45 escrit: porta la marca SCHOOL_PASS, que school.js resol amb BALANCE.school.
- fuelWithinPlan (factsFromRecord) compta el creuer saltat igual que economy.js: fuelBurntKg + skippedCruiseFuelKg * (1 + BALANCE.cruiseSkipFuelPenalty) <= fuelPlannedKg; sense skippedCruiseFuelKg compta 0. economy.js no exporta aquest calcul (es dins de computeFlightResult), i per no tocar-lo la formula es repeteix a school.js amb un comentari que ho diu.
- recordLessonAttempt llanca un Error amb l'id si isLessonAvailable es fals: no es pot desar l'intent d'una llico amb l'anterior sense aprovar. Una llico ja aprovada continua sent repetible.

## 2026-09-27 - C1: la gracia de la llico 7
La nota minima baixa de passScore (45) a mercyScore (30) a partir de l'intent mercyAttempt (3) inclos: el tercer intent ja pot aprovar amb 30. DESIGN.md parla del "tercer intent fallit"; es pren com el tercer intent. Que s'ha aprovat per gracia (mercy) es retorna a qui crida pero no es desa a la partida: el subobjecte school no canvia d'esquema.

## 2026-09-27 - C1: school.js treballa sobre el subobjecte school
recordLessonAttempt rep i retorna nomes CareerState.school ({ lessonsPassed, attempts, graduated }), no l'estat sencer. Com progression.js, no modifica el que rep: retorna un school nou dins del resultat ({ school, passed, mercy, attempt, results }). No toca graduated: graduar-se (habilitacio commuter, graduationXp) es del C5.

## 2026-09-27 - C1: els check-rides nomes avaluen
evaluateCheckRide(ratingId, facts) diu si s'ha passat i prou. Donar l'habilitacio, comprovar el rang i cobrar-ne el cost son de purchaseRating a progression.js. El setup de cada check-ride (vent creuat, ILS, massa) es informacio per al C3 i el D3: school.js no l'interpreta.

## 2026-09-27 - C2: app/, bus i final de vol
- onFlightFinished cridat sense cap vol en marxa (Free Flight, o una segona crida sobre el mateix vol) no fa res i retorna false, en comptes de llancar: index.html no sap si el vol que acaba de tocar terra era d'Airline o no, i preguntar-ho abans de cridar seria imports circulars amb Game.
- cancelFlight() resol la promesa de launchFlight amb null (vol abandonat, no un error): qui l'ha demanat ja sap que no hi haura FlightRecord i pot netejar la UI en el then, no en un catch.
- discardCareer() sempre intenta backupCareer() primer. Si la copia falla (Storage ple o refusant) i hi havia partida, no esborra res: es prefereix deixar una partida bruta pero recuperable a perdre-la sense cap rastre.
- emit() amb un tema fora de TOPICS llanca (error de programacio d'un mòdul, no una entrada de l'usuari); un subscriptor que llanca no bloqueja els altres ni fa llancar emit: es un error de la UI, no del bus.
- loadCareer() distingeix 'migrated' de 'ok' comparant schemaVersion de l'estat cru amb SCHEMA_VERSION abans de migrar. Avui career/state.js nomes accepta schemaVersion === 1 (MIGRATIONS hi es buit), aixi que aquest estat no te encara cap prova amb una migracio real: queda preparat per quan n'hi hagi una.

## 2026-09-27 - C3+C4: D1-D8, encarrec de l escola de vol

Decisions d'en Marc per a C3 (executor de llicons) i C4 (ajudes de l escola).

- D1. Mentre no existeixi el C5, les llicons es llancen des del panell DEV
  (nomes IS_DEV). El panell DEV queda fora d'i18n (decisio ja existent, vegeu
  "Noms propis i panell DEV fora d'i18n"). Hi ha un boto DEV "desbloqueja-les
  totes" que nomes marca les llicons com a aprovades a la memoria (school),
  sense passar per recordLessonAttempt.
- D2. El progres de l escola (l objecte school de CareerState) viu nomes en
  memoria. No es desa. La persistencia la decideix el C5.
- D3. Un vol abandonat (cancelFlight) no compta com a intent. Un crash si que
  compta, i sempre es un suspens: els fets en viu inclouen sempre crashed, i
  un crash sense crashed aprovaria la llico.
- D4. Totes les llicons es fan a LEBL, amb meteo calma (sense turbulencia,
  vent 0). maxAltFt de la llico 4 (takeoff) es AGL: app/lesson-run.js el
  calcula en viu i substitueix el maxAltFt (MSL) del FlightRecord en combinar
  els fets.
- D5. Llico 5 (maneuvers): comenca en vol, anivellat. Altitud de referencia =
  altitud inicial de l intent. S'avalua en complir 120 s (durationS a
  lessons.js), no continuament. Criteri nou: canvi de rumb total acumulat
  >= 180 graus (metrica nova headingChangeDeg, afegida a METRICS de
  school.js, amb prova).
- D6. Llico 6 (circuit), "final estabilitzat": en creuar 500 ft AGL a menys
  de 3 nm del llindar, i mantingut 10 s: rumb a +-10 graus de la pista, tren
  avall, flaps d'aterratge, IAS entre Vref-5 i Vref+20 kt, sink <= 1000 fpm.
  Llindars a LESSONS['circuit'].finalStabilized.
- D7. Barra d'arrodoniment (C4): sink desitjada lineal de 500 fpm a 50 ft AGL
  fins a 150 fpm al contacte. Visible des de 50 ft AGL fins al contacte.
  Llindars a LESSONS['landing'].flareBar.
- D8. Barra d'arrodoniment i debrief automatic: nomes a la llico 7, marcats
  com a dades a lessons.js (aids: { flareBar: true, autoDebrief: true }), mai
  com a condicio al codi.

Consequencia tecnica no discutida per en Marc, nomes registrada: Game.scoreReport
(index.html) no exposava els punts maxims de cada component (sink, g, zone,
center, attitude), nomes els aconseguits. app/debrief.js els necessita per
decidir "OK" / "Needs improvement" (regla 8 de la seccio 0: no copiar-los a
ma). S'ha afegit un camp ptsMax al retorn de scoreReport amb els mateixos
coeficients que ja hi havia a la formula (35, 15, 20, 20, 10): cap fisica
nova, nomes exposar el que ja hi era. Vegeu la descripcio del PR.

## 2026-09-28 - C3: correccions de l escola de vol despres de la prova d en Marc

En Marc ha provat les llicons al navegador (PR #22). Decisions:

- Llico 5 (maneuvers): en superar la desviacio d altitud del criteri
  altDeviationMaxFt (200 ft a lessons.js), l intent suspen a l instant, sense
  esperar els 120 s, i l instructor diu quants peus t has desviat. Els 120 s
  de D5 continuen sent la condicio per aprovar. Substitueix el "s avalua en
  complir 120 s, no continuament" de D5 nomes per al suspens per desviacio.
  El text de l objectiu diu el que s ha de fer de debo: virar almenys 180
  graus en total mantenint l altitud dins de +-200 ft durant 2 min, amb els
  tres numeros com a parametres de lessons.js.
- Llico 1 (exterior): comenca a la pista (mode 'runway': alineat, fre
  d aparcament posat, motors al ralenti), no a la porta: a la porta els
  edificis de la terminal tapaven una de les cameres.
- Llico 2 (cockpit): l objectiu es IDENTIFICAR el comandament, no fer-lo
  servir. onCommand s emet quan el jugador prem la tecla, abans de qualsevol
  comprovacio que impedeixi l accio (tren bloquejat a terra, inversors nomes
  a terra). Tota la llico s ha de poder fer amb l avio aturat. Les tecles de
  cada comandament son dades a lessons.js (controlKeys) i el missatge de
  l instructor diu el nom i la tecla, com a parametres i18n.
- Llico 6 (circuit): l instructor guia per fases, un missatge per fase: vent
  en cua (mantenir l altitud del spawn, tren i flaps), gir a base quan el
  llindar queda baseTurnDeg (45 graus) enrere del travers (i comencar a
  baixar), gir a final quan l eix queda a finalTurnLatM, i a final
  (estabilitzar-se abans de finalStabilized.aglFt). El costat del gir surt de
  la geometria real (posicio i rumb respecte de la pista assignada), mai
  escrit a ma. Llindars a LESSONS['circuit'].guidance.

Consequencia tecnica, nomes registrada: la guia de la llico 6 fa servir la
geometria respecte de la pista assignada (Game.activeEnd), no de l ILS
autosintonitzat, perque en vent en cua el receptor sintonitza el capcal
contrari. La instantania de lesson-run.js te tres camps opcionals nous
(asgAlongM, asgLatM, asgHdgDeg).

## 2026-09-29 - C3: llicons 1 a 5 per donar-les per acabades

En Marc ha provat les llicons 1 a 5 (PR #22) i demana aquests canvis:

- Tecla de reinici de camera: Home. Torna la camera a l angle (i la
  distancia i el zoom) per defecte, a totes les cameres exteriors, a la
  cabina i a Free Flight (Cameras.resetView a index.html). Es l unica tecla
  lliure: totes les lletres ja son d Input o de Game.onKey. Viu a
  CONTROL_KEYS.cameraReset (lessons.js), el mapa de tecles de comandament
  que la llico 2 fa servir com a controlKeys. L instructor ho ensenya a la
  llico 1 (arrossegar amb el clic dret gira la camera, Home la torna), sense
  cap criteri nou. Les explicacions de l instructor son dades (tips a
  lessons.js) i les tecles surten sempre de CONTROL_KEYS.
- Llico 3 (taxi): una rodona verda fluorescent a terra, al punt objectiu
  (el llindar de la pista assignada, sobre l eix; radi = maxLatOffsetM), i
  una linia recta discontinua del mateix color des de l avio fins a la
  rodona, redibuixada a cada frame. Linia recta, no el cami per les
  taxiways. Substitueix el ressaltat del capcal. Nomes en aquesta llico.
- Distancia a l aeroport: totes les vistes la mesuren fins al capcal de la
  pista de destinacio (thresholdDistNm a world/ils.js), en linia recta. El
  capcal es el de l ILS sintonitzat si es de l aeroport de destinacio, si
  no el de la pista assignada (destinationEnd). Abans la cabina (PFD i HUD)
  mostrava el DME, que es a l antena del localitzador, a l altre extrem de
  la pista (uns 2 nm mes), i l ND i el vol cronometrat mesuraven fins al
  centre de l aeroport. Error antic: tambe passava a Free Flight a dev.
  Les llicons continuen fent servir distThr de l ILS: no canvien.
- Llico 4 (takeoff): el comptador d altura de la llista d objectius no va
  amb retard. Compta AGL (D4, alcada del tren sobre el terreny), i
  l altimetre del HUD es MSL: la diferencia es l elevacio de l aeroport mes
  l alcada del tren. L etiqueta de la llista ara diu "ft AGL".

## 2026-09-29 - C3: llicons 6 a 8 i darrers canvis per tancar C3+C4

En Marc ha provat les 8 llicons (PR #22). Decisions:

- Reinici de camera: un doble clic amb el boto dret torna la camera a l angle
  per defecte, igual que Home, que es mante com a alternativa. El navegador no
  dona dblclick del boto dret: Input (index.html) mesura dos mousedown del boto
  dret en menys de 400 ms. L instructor de la llico 1 ensenya el doble clic i
  menciona Home (la tecla surt de CONTROL_KEYS).
- Llico 3 (taxi): la linia verda discontinua segueix el cami per les calles de
  rodatge, no una recta (substitueix la "linia recta" de l entrada anterior del
  29/09). world/taxi.js fa un graf de la geometria de taxiways que ja existia,
  sense redibuixar-la (cruilles en T i creuaments), i en busca el cami mes curt
  (A*) des de l avio fins al capcal, amb la rodona al final. A LEBL tota la
  xarxa queda connectada. El cami es recalcula si l avio se n allunya mes de
  taxi.rerouteM (40 m, lessons.js).
- D4 canviada: la llico 4 fa servir la mateixa altitud que l altimetre del HUD
  (MSL), no AGL, perque el jugador vegi el mateix numero a tot arreu. Totes les
  llicons son a LEBL, gairebe a nivell del mar. maxAltFt en viu es l altitud
  MSL arrodonida a 10 ft, com l altimetre, i l etiqueta de la llista torna a
  dir "ft". La resta de D4 (LEBL, meteo calma) no canvia.
- Llicons 7 i 8 separades, abans indistingibles (totes dues a 10 nm sobre la
  senda):
  - Llico 7 (aterratge): comenca a 3 nm en final curt, alineada i
    estabilitzada. Tot va de l arrodoniment.
  - Llico 8 (ILS): comenca a 12 nm, 2 nm fora de l eix amb 25 graus d angle
    d intercepcio, anivellada a 2.000 ft (per sota de la senda), tren amunt i
    flaps d aproximacio. L instructor explica les dues agulles (localitzador i
    senda) i guia la intercepcio per fases. Criteri nou ilsFlown: haver seguit
    l ILS vol dir que, entre 1.500 i 500 ft AGL, cap de les dues agulles no
    passa d 1 punt de desviacio i el senyal es valid en tot el tram.
  Distancies, angles i llindars a lessons.js (spawn, ilsTolerance, guidance).
  El mode 'final' de Game.spawn accepta per opts la distancia, l offset, l angle
  d intercepcio i l altura, amb el mateix trimAircraft (cap fisica nova); per
  defecte, Free Flight, no canvia.

- D6, circuit a 1.000 ft (decisio d en Marc, correccio posterior del mateix
  dia): el tram de vent en cua de la llico 6 passa de 1.500 a 1.000 ft AGL
  (LESSONS['circuit'].spawn.aglFt), l altura habitual del circuit d avions
  petits, per poder arribar als 10 s estabilitzat baixant a un ritme normal.
  La resta de D6 (500 ft AGL, 3 nm, 10 s, rumb, tren, flaps, velocitat, sink)
  no canvia. Volat sencer sense navegador (FlightModel, Autopilot i World
  reals, des del spawn 'downwind', velocitat vertical fixa des del gir a base):
  amb 400 a 700 fpm a base els 10 s es compleixen a 1,32 nm del llindar, en
  quan l avio queda alineat a final (a 448, 394, 332, 208 i 83 ft AGL amb
  400, 450, 500, 600 i 700 fpm). El ritme bo es 400-500 fpm: a 600 fpm o mes
  ja s es per sota dels 500 ft abans del gir a final i, sense aplanar el
  descens, molt per sota de la senda (uns 460 ft a 1,3 nm). Amb 300 fpm
  tambe s hi arriba, pero a 0,32 nm.

Consequencies tecniques, nomes registrades:

- L altura del tram d ilsFlown es l altura sobre la pista (hatFt, de l hW
  d ILS.nav), no el radioaltimetre: a 12 nm de la 07L hi ha turons d uns
  600 ft, i amb l AGL del terreny l avio ja entrava al tram al punt de sortida,
  amb l agulla fora.
- Llico 6: el comptador dels 10 s nomes avanca a menys de 3 nm del llindar i
  per sota de 500 ft AGL, dues condicions de D6 que no eren a la llista, i
  l instructor deia "estabilitza't abans dels 500 ft". Ara la llista mostra
  totes les condicions de D6 i el missatge de final diu les del comptador.
  Els criteris de D6 no canvien. Amb el circuit a 1.500 ft (a 1,5 nm del
  llindar) i un descens d uns 500 fpm, s arribava als 500 ft gairebe al
  llindar: per tenir els 10 s abans calia baixar uns 900 fpm a base.
- Panell DEV: llancar una llico amb una altra en marxa cancel la la que hi ha
  (cancelFlight, no compta com a intent, D3) i comenca la nova.
- Game.opts conservava els camps spawn* d una llico (Object.assign del
  launcher): ara es treuen abans de cada vol, perque un Free Flight 'final' no
  hereti la distancia ni l offset de la llico 8.
