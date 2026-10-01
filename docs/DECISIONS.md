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
  amb 400 a 700 fpm a base els 10 s es compleixen a 1,32 nm del llindar, tan
  aviat com l avio queda alineat a final (a 448, 394, 332, 208 i 83 ft AGL amb
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

## 2026-09-29 - Fisica: amortiment del tren, potencia del Mi-9 i estabilitat del X-90

Tres problemes que en Marc ha trobat jugant. Mesures abans i despres amb
tools/estabilitat.mjs (taules a la descripcio del PR).

- Criteri d amortiment del tren: gairebe critic. Un cop i com a molt un petit
  rebot, i l oscil.lacio de capcineig i d alcada del tren s apaga en menys
  d 1 s, a tots els avions. "S apaga" vol dir que la velocitat de capcineig
  queda per sota de 0,3 graus/s i la vertical del CG per sota d 1,5 cm/s. Es
  mesura en dos escenaris: treure el fre d aparcament amb tota la potencia
  (6 s de carrera) i un contacte a 400 fpm amb els spoilers de terra, des que
  el morro acaba de baixar. Rangs a l expect de cada avio: brakeSettle i
  tdSettle [0, 1] s, tdBounces [0, 1], brakePitch [0, 0,8] graus.
- Com: amortidor lineal nomes en extensio a cada pota, 2,5 vegades el critic
  de la pota (GEAR_REBOUND_ZETA a flight-model.js), amb la rigidesa estatica
  de la pota (pneumatic en serie amb l aire) i la massa aparent de l avio en
  aquell punt, perque escali igual a tots els avions. Nomes extensio perque
  la compressio decideix el pic de g del contacte: les files "Touchdown load"
  del harness (i la nota d aterratge i els danys que en depenen) queden
  identiques. Descartat un amortidor en els dos sentits: amb el mateix
  esmorteiment, el contacte a 300 fpm passava de 1,4 a 2-3 g. Descartat
  tambe afegir-lo en compressio nomes a velocitats de carrera petites: amb
  0,5 del critic ja treia de rang el contacte de 600 fpm del X-90, i amb 1,0
  els de 150 i 300 fpm del T-4 i del M-300, entre d altres. El
  terme c1 (lligat a PHYS_DT, fa estable la integracio de l oleo) es queda:
  el resultat nou es el mateix amb PHYS_DT/2 i PHYS_DT/4.
- Mi-9: 950 kW per motor (abans 1.200, classe PT6A-67D del Beech 1900D) i
  propDragArea 6,0 (abans 7,0, la proporcio a l ala del G-72). Les derivades
  eren les del G-72 i reaccionaven igual per unitat de moment d empenta; el
  que el feia picar mes (10,1 graus en 10 s, G-72 8,1, G-42 8,7) era una
  relacio potencia/pes de 293 W/kg (G-72 177, G-42 192). Ara 8,9 graus.
  Consequencia: a potencia maxima el Mi-9 crema una mica menys i puja una mica
  menys (1.815 fpm al harness, dins de [1.500, 2.800]). El balanc economic
  (tools/balance.mjs) fa servir FlightRecords sintetics i no canvia.
- Tots els turbohelix piquen amb potencia (empenta per sobre del CG, sense
  efecte de l estela sobre la cua) i els jets amb motors sota l ala
  s encabriten; es el comportament del model de sempre i no es toca aqui.
  powerPitch de l expect de cada avio guarda que cap avio no surti del rang
  de la seva familia.
- X-90: les derivades adimensionals eren totes dins del rang (interpolacio
  G-72 / M-200) i la longitudinal es queda. La lateral i direccional no: amb
  fuselatge llarg i envergadura curta (Izz/(m b2) 0,093, la resta
  0,046-0,056) donava el balanceig holandes menys esmorteit i la relacio
  phi/beta mes alta de tots. Cnb 0,142 -> 0,185 i Cnr -0,23 -> -0,39 pel brac
  de la deriva (lt/b 1,3 vegades el del M-200; Cnb escala amb el brac i Cnr
  amb el quadrat) i Clb -0,122 -> -0,105 perque phi/beta quedi com la del
  M-200. Geometria 3D sense tocar (F6).
- Observacio, sense canvi: el X-90 fa un 40 % mes de velocitat de balanceig per
  unitat d aleto que el M-200 (envergadura curta). Es potencia de control, no
  estabilitat; si en Marc el troba massa viu, es Clda.

## 2026-09-29 - Fisica: Mi-9 docil en capcineig, tren amb massa real i informe d aterratge

Seguiment del PR #24. Mesures abans i despres amb tools/estabilitat.mjs
(taules a la descripcio del PR).

- Mi-9, criteri de joc: es l avio de l escola i ha de ser el turbohelix mes
  docil en donar o treure molta potencia de cop, no un de la mitjana. Criteri
  mesurat: en el pas de ralenti a maxima i de maxima a ralenti (planeig o
  pujada trimats a 1,6 Vs neta, 5.000 ft, massa tipica, comandament i trim
  quiets, 60 s), el Mi-9 te l excés de capcineig i la desviacio d altitud mes
  baixos dels tres turbohelix (G-72, G-42 i Mi-9), en els dos sentits.
  test/fisica.test.js ho comprova directament; les files phugPitch i phugAlt
  del harness en guarden el rang per avio.
- Metrica respecte de l equilibri final, no de l estat inicial: amb la
  palanca nova i el mateix trim l avio acaba en un altre vol estabilitzat
  (una altra actitud i una altra velocitat vertical), i arribar-hi es la
  resposta que toca, no un defecte. Harness.equilibrium resol aquest vol
  estabilitzat (alfa, TAS i trajectoria) i Harness.powerResponse mesura:
  excés de capcineig (el que el morro es mou en sentit contrari abans
  d arribar a l actitud d equilibri i, a partir d aleshores, la desviacio
  maxima respecte d ella) i desviacio d altitud respecte de la trajectoria
  d equilibri des que la velocitat vertical hi arriba per primer cop.
  Comparades amb l estat inicial, el Mi-9 sortia pitjor nomes perque te mes
  relacio potencia/pes (232 W/kg, G-72 177): puja amb mes angle a tota
  potencia.
- Les sobreoscil.lacions i el temps d assentament queden a la taula nomes com
  a informacio, no com a criteri. Cap avio no s apaga en 60 s: la fugoide te
  un esmorteiment de 0,04 a 0,07 als turbohelix (el M-200 a tota potencia es
  lleugerament divergent, uns -0,02) i un periode de 35 a 45 s. El nombre de
  sobreoscil.lacions en 60 s depen sobretot del periode, no de l esmorteiment:
  el Mi-9 vola la prova mes lent (154 kt, G-72 171) i, amb un periode mes
  curt, li cap una sortida mes de +-1 grau dins la finestra, encara que siguin
  mes petites. No s ha tocat la fugoide de cap avio.
- Causa i canvi: la linia d empenta del Mi-9 era 0,75 m per sobre del CG.
  Amb el trim fix, el moment de l empenta canviava l alfa d equilibri uns
  3 graus i, amb ella, la velocitat i la trajectoria, i excitava la fugoide.
  Cmq no hi fa gairebe res (amb -60, irrealista, menys d 1 grau). Camp nou
  engines.thrustPos, nomes de fisica: el punt on actua l empenta. Per defecte
  es engines.pos, i index.html continua dibuixant les gondoles amb pos (la
  geometria 3D no canvia). Al Mi-9, 0,1 m per sobre del CG: la linia
  d empenta quasi pel CG, com l ajustaria el fabricant d un avio d escola.
  Excés de capcineig 15,5/15,7 -> 12,2/10,5 graus (G-72 13,1/13,2, G-42
  14,7/15,5) i desviacio d altitud 1.163/683 -> 790/626 ft (G-72 1.180/736,
  G-42 1.101/689). El valor es el minim de l escombrat entre -0,75 i +0,2 m.
  Ara, en els primers 10 s amb tota la potencia, el Mi-9 aixeca el morro
  7,4 graus en lloc d abaixar-lo 8,9 (fila powerPitch, dins de [6,5, 9,5]).
- Cost del thrustPos del Mi-9 a l arrodoniment: abans, en treure potencia,
  desapareixia el moment d empenta que abaixava el morro i el morro pujava
  sol, cosa que ajudava l arrodoniment. Ara aquesta ajuda gairebe no hi es i
  cal ~1 grau mes d arrodoniment o comencar-lo abans. Al harness (mateix
  pilot automatic d arrodoniment, 5 graus des de 8 m), el contacte del Mi-9
  passa de 63 a 155 fpm (rang [30, 360]); el 63 era el punt optim de
  l escombrat. Comprovat amb el harness: amb 6 graus en lloc de 5 el contacte
  torna a 83 fpm (48 amb 6,5), i comencant-lo a 9 m en lloc de 8, a 67 fpm.
  El harness no es toca (els seus parametres d arrodoniment son de tots els
  turbohelix). Es valida jugant: si a l escola costa massa, es pot revisar.
- Tren: l amortidor d extensio (GEAR_REBOUND_ZETA) es dimensionava un sol
  cop amb la massa tipica. La massa aparent de cada pota es proporcional a la
  massa, aixi que el coeficient s escala amb sqrt(massa / massa tipica)
  (FlightModel.reboundCoef) i la zeta es 2,5 buit o carregat (abans, un avio
  buit quedava a uns 3,1). Files noves al harness: contacte a 400 fpm a la
  massa maxima d aterratge i a la minima, i contacte a 800 fpm (rebots [0, 0]
  i assentament [0, 2] s: amb GEAR_REBOUND_ZETA = 0 fallen).
- Informe d aterratge (preventiu, no reproduit): despres de dos bots, en
  Marc no va veure ni l informe ni la pantalla d accident. Dues vies possibles:
  (1) el model nomes emet 'touchdown' si les principals toquen amb
  airTime > 2, i airTime torna a 0 despres de 0,5 s amb qualsevol roda a
  terra: si el morro toca primer i s hi queda, no hi ha informe; (2) una
  excepcio a Game.onTouchdown (candidat Sound.touchdown, WebAudio) deixava
  f.events sense buidar i es tornava a llancar a cada pas. core/landing-watch.js
  registra l aterratge amb qualsevol ordre de contacte i, com a xarxa de
  seguretat, el tanca a terra per sota de 35 kt; nomes actua sense informe
  obert ni accident, aixi que els aterratges normals no canvien. Cada
  esdeveniment es processa dins un try amb console.error, perque si torna a
  passar es vegi a la consola.
- Sense canvi: els rebots que el model compta pero Game no (un contacte de
  mes de 0,5 s i un bot de menys de 2 s en l aire) es queden, perque
  canviarien les notes. Vegeu la descripcio del PR.

## 2026-09-30 - C5+D1: E1-E10, graduacio, menu principal i centre d operacions

Decisions d en Marc per a C5 (pantalla d escola i graduacio) i D1 (menu
principal Free Flight / Airline, shell del centre d operacions i barra
superior).

- E1. Desat de l escola (substitueix la D2 del C3+C4). La partida
  (CareerState) es crea el primer cop que el jugador entra a Airline: se li
  demana el nom i es crida createCareer. L escola viu dins de la partida
  (CareerState.school) i es desa amb app/save.js (clau pontAeri.career.v1)
  despres de cada intent de llico i en tancar cada pantalla, mai per frame.
  Canvia el "Fet quan" del C5: graduar-se ja no crea la partida, la
  completa. El centre d operacions nomes s obre amb school.graduated = true.
  Nom: de 1 a 24 caracters despres de treure espais (state.js no te cap regla
  per al nom). La llavor i createdAt es generen a platform/
  (crypto.getRandomValues, new Date().toISOString()) i s injecten: mai
  Math.random() ni Date a career/.
- E2. Graduacio. Quan canGraduate(school) es cert i graduated es fals, el joc
  mostra la pantalla de graduacio i aplica graduate(state) un sol cop: afegeix
  'commuter' a pilot.ratings (el pilot comenca amb ratings: []), suma
  BALANCE.school.graduationXp a l XP pel mateix cami que la resta d XP
  (applyXp: el rang surt de l XP) i posa school.graduated = true. La pantalla
  mostra l habilitacio, l XP guanyada i el saldo (company.cash amb fmtMoney),
  i te un boto per obrir el centre d operacions. Si la partida carregada ja
  compleix canGraduate sense estar graduada (per exemple, despres del boto
  DEV), tambe surt la pantalla de graduacio.
- E3. Aprovat per gracia. Si recordLessonAttempt retorna mercy: true, el
  jugador ho llegeix a l instructor i al debrief: "Provisional pass with
  {score}. You still need practice: come back to the school whenever you
  like." / "Aprovat provisional amb {score}. Encara et falta ofici: torna a
  l escola quan vulguis." No es desa (decisio del C1 del 27/09, no canvia).
- E4. Llico 7 sense barra d arrodoniment. A lessons.js, aids.flareBar de
  'landing' passa a false (nomes dades; el codi de la barra es queda).
  autoDebrief no canvia. Tip nou de l instructor a la llico 7 sobre la V/S:
  "Just before touchdown, pull back gently to bring the vertical speed (V/S)
  as close to 0 as you can, without letting the airspeed drop below Vref."
- E5. Guia de consulta. Nomes consulta: no es practica i no te criteris.
  Conte les tecles, els parametres del HUD i els simbols, amb una frase curta
  per a cadascun. S obre des de la pantalla d escola i des de la pausa de
  Free Flight. Les tecles surten sempre de CONTROL_KEYS (lessons.js): les que
  Input o Game.onKey llegeixen i no hi eren s hi afegeixen (nomes dades, sense
  tocar Input). L ajuda de la tecla H no es toca.
- E6. Barra superior (nomes a Airline, nomes graduat): nom i distintiu de
  rang; barra d XP fins al rang seguent (plena al rang maxim); saldo en
  euros; reputacio 0-100; flota operatius/totals (status 'ready' /
  fleet.length); base. Fora d aquest PR, sense caselles buides que els
  esperin: data i hora (E1), xip d avis (E1/E2), variacio de l ultim vol i
  tendencia de la reputacio (D4).
- E7. Centre d operacions: les set pestanyes de DESIGN.md (Dispatch, Fleet,
  Market, Crew, Pilot, Finance, Map), cadascuna amb "Available soon" /
  "Aviat". Les omplen D2-D6. Un boto per tornar a l escola: les llicons es
  poden repetir sempre, sense XP ni diners.
- E8. Menu principal amb dues portes. Free Flight obre el menu que ja
  existeix. Airline: sense partida -> pantalla del nom -> escola; amb partida
  sense graduar -> escola; graduat -> centre d operacions. Cada un dels cinc
  estats de loadCareer te resposta a la UI: si balanceVersion no coincideix,
  avisar i oferir continuar o comencar de nou (seccio 8); si la partida no es
  pot llegir, dir que se n ha fet copia i oferir comencar de nou. Estetica de
  taulell de sortides (DESIGN.md): fons pissarra, tipografia condensada, files
  fines, accents ambre i verd, amb la pila de fonts del sistema (cap font
  externa ni dependencia nova). El fons es l escena que ja hi ha darrere del
  menu actual (l escena 3D del menu es el D7).
- E9. Exportar i importar la partida (seccio 8), a la pantalla d escola i al
  centre d operacions. Exportar descarrega el JSON d exportJson. Importar fa
  servir importJson: si falla, missatge d error i la partida actual no canvia.
- E10. Panell DEV (nomes IS_DEV, fora d i18n): el boto "desbloqueja-les
  totes" actua sobre l escola de la partida carregada i la desa. Boto nou
  "esborra la partida", amb discardCareer (que fa copia abans).

Consequencia tecnica de l E4, nomes registrada: el tip antic de la llico 7
(school.tip.flare, "des de 50 ft segueix la barra d arrodoniment") deia al
jugador que seguis una barra que ja no surt. El tip nou de la V/S el
substitueix i la clau antiga surt d en.js i ca.js.

## 2026-09-30 - C5: punt de partida en graduar-se, base i copia en continuar

Decisions d en Marc despres de revisar el PR #27.

- Saldo en graduar-se. graduate deixa la partida exactament al punt de
  partida de tools/balance.mjs. La logica es una sola funcio,
  startingCompany (career/finance.js): company.cash = BALANCE.startingCash
  (400.000 EUR, que ja inclouen el credit, DESIGN.md: 150 k propis + 250 k
  de credit), un prestec 'L0' fet amb makeLoan(startingLoan.principal,
  startingLoan.ratePerFlight, startingLoan.termFlights) i reputacio =
  BALANCE.reputation.start. El harness ja no te codi propi de graduacio:
  crida graduate de career/ amb totes les llicons aprovades (startState).
  npm run balance --seeds 50 dona exactament la mateixa sortida que abans.
  La pantalla de graduacio mostra el saldo i diu que inclou el credit.
- Base. El harness escrivia la base a ma ('LEBL'). Ara es
  BALANCE.startingBase = 'LEBL' (on es fa l escola): startingCompany la posa
  a company.bases i el harness la fa servir tambe per a la ubicacio dels
  avions. El harness no posa cap airportsUnlocked, aixi que graduate tampoc.
  Com la resta de BALANCE abans del primer merge d Airline a main, no puja
  version (seccio 6).
- Continuar amb una altra versio d economia (balanceMismatch): com fins ara,
  balanceVersion passa a BALANCE.version i es desa, pero primer
  backupCareer(). Com discardCareer, si la copia falla i hi havia partida
  desada, no se sobreescriu res i la UI ho diu.

## 2026-09-30 - D2+D5: flota, mercat d'ocasio i categories

Decisions d en Marc per a D2 (Fleet) i D5 (Market).

- G1. Lloguer fora d aquest PR: va amb el D3+D4, quan hi hagi cobrament per
  vol. A la pestanya Market no surt cap boto de lloguer.
- G2. Categories. Cada avio te una categoria que l acompanya sempre
  (Airframe.tier): 'basic', 'standard', 'premium' o 'deluxe'. No es nomes
  l estat: es tot el paquet d un avio de segona ma real (edat, estat,
  historial de manteniment i cabina). Efectes, com a dades a
  BALANCE.market.tiers: preu (tram propi sobre usedPrice, priceFactor), edat
  i estat inicial (ageYears, condition), ingressos per vol (revenueMult, la
  cabina) i desgast (wearMult, construccio i historial). La categoria no
  canvia amb el desgast: un deluxe gastat continua sent deluxe, pero val menys
  en vendre'l (G9).
- G3. Preu dins de la categoria, funcio pura priceOf(typeId, tier, ageYears,
  condition): ageN i condN (mitjana dels 4 sistemes) retallats a [0, 1] dins
  dels trams de la categoria; score = ageWeight * (1 - ageN) + (1 -
  ageWeight) * condN; preu = round(usedPrice * lerp(priceFactor, score)).
- G4. Mercat = { epoch, listings }, epoch = floor(clock.minute /
  regenMinutes). refreshMarket(state) es pura: genera una llista nova si falta
  o si l epoch calculat es mes gran que el desat. Mai Date ni hora real: fins
  a l E1 el rellotge no avanca i el mercat nomes canvia amb el boto DEV. Tot
  l atzar surt d un flux derivat de (rngSeed, epoch) que no toca rngCounter
  (derivedRng, afegit a rng.js sense canviar draw). Grups de tipus segons
  pilot.ratings i l ordre de BALANCE.ratings (rated, next, other), amb el
  mapa fleetTypes[..].rating. Composicio: primer les garanties (per a cada
  habilitacio del pilot, un basic i un standard d un tipus d aquella
  habilitacio, preferint tipus no coberts; despres, un anunci per a cada
  tipus rated que no en tingui), i despres fins a n amb els pesos de mix i
  tierWeights. Generacio de cada anunci: edat i estat uniformes dins dels
  trams, hores i cicles de l edat, revisions A i C que vencen entre 1 hora i
  un interval sencer, matricula EC- unica, preu de G3.
- G5. Pagament a triar: financat (BALANCE.financing, 30 % d entrada, prestec
  amb makeLoan) o al comptat (preu sencer, loanId null).
- G6. Regla de compra, una sola funcio (purchaseRule de career/finance.js)
  que criden el joc i el harness. Q = suma de les quotes per vol de tots els
  prestecs despres de la compra. Financat: cash - entrada >= reserveFlights *
  Q. Al comptat: cash - preu >= reserveFlights * Q. Retorna el motiu quan no
  es pot ('cash' o 'reserve').
- G7. Nomes es pot comprar si pilot.ratings inclou l habilitacio del tipus.
  Els altres anuncis es veuen amb el boto desactivat i l habilitacio que falta.
- G8. L avio comprat queda a company.bases[0], 'ready', groundedUntilMinute 0,
  amb la categoria i els camps de l anunci, finance { purchasePrice, loanId
  (o null), leaseId: null } i value = preu. L anunci surt de la llista.
- G9. Venda: nomes status 'ready'. Cotitzacio = round(priceOf(typeId, tier,
  referenceYear - yearBuilt, estat actual) * (1 - sellFee)). Es cancel.la el
  capital pendent del prestec de l avio; net = cotitzacio - pendent. Si cash
  + net < 0, no es pot vendre. Airframe.value es el preu pagat (sense
  depreciacio de moment).
- G10. revenueMult (economy.js) i wearMult (wear.js), parametres opcionals que
  valen 1 per defecte: amb 1 el resultat es identic. El joc aplicara el
  revenueMult quan liquidi cada vol, al D3+D4.
- G11. CareerState.market i Airframe.tier son camps nous sense pujar
  schemaVersion ni migracio (Airline encara no es a main). La validacio
  accepta una partida sense market (en carregar-la, refreshMarket la genera)
  i un Airframe sense tier (es tracta com 'standard').
- G12. Quatre idees noves a docs/BACKLOG.md: especialitzacio dels avions,
  branques de carrera i millores, superjumbo amb cabina premium i aspecte
  visual per categoria.

Valors: els de l encarrec, sense cap ajust. BALANCE.market sencer i
financing.reserveFlights = 10; revenueMult / wearMult: basic 0,90 / 1,25,
standard 1 / 1, premium 1,08 / 0,90, deluxe 1,15 / 0,80. revenueMult es
estrictament creixent i wearMult estrictament decreixent (prova a
balance.test.js).

Harness (decisions validades per en Marc despres de la primera passada):

- Mode per defecte com fins ara: el primer avio es paga al comptat i la
  resta financats, a usedPrice, estat 100 i multiplicadors 1. La regla de G6
  s aplica sobre el cash que queda despres de pagar l habilitacio del tipus.
  Amb reserveFlights 0 la sortida es identica a la d abans del D2+D5; aleshores
  16 de les 50 llavors baixaven de 0 despres d una compra (minim -1.759.447
  EUR). Amb R = 10: cap.
- Als modes --tier totes les compres son financades, tambe la primera (un
  Mi-9 deluxe, 455.000 EUR, no es pot pagar al comptat amb el capital
  inicial).
- Criteri B (substitueix el de l encarrec). Per a cada categoria, respecte de
  --tier standard: mediana de cada salt a +-8 vols; p90 de cada salt com a
  molt 5 vols per sobre del p90 del mateix salt a standard (substitueix el
  limit absolut de 60: els salts limitats pel rang ja hi toquen amb
  standard; amb basic o deluxe el G-72 es compra en arribar al rang private
  i el salt fins al M-200 depen de l XP que falta per a commercial, 61 vols
  al p90 fes el que fes revenueMult); menys del 12 % de vols en negatiu.
- La condicio de 0 llavors amb cash < 0 es nomes del mode per defecte
  (criteri A). Als modes --tier les llavors amb cash < 0 i el cash minim
  s imprimeixen com a informacio, pero no formen part del criteri B. Motiu:
  la regla de compra evita que comprar deixi el cash en negatiu; el cas de la
  llavor 20260932 es una cua de tres aterratges molt dolents (notes 19, 22 i
  24) just despres de comprar el jumbo, igual a totes les categories (tambe
  a standard), i cap multiplicador no el corregeix.

Resultat final (npm run balance -- --tiers, 50 llavors; salts en vols,
mediana / p90):

| Mode | Salts | Vols en negatiu | Cash < 0 (llavors) | Criteri |
| --- | --- | --- | --- | --- |
| defecte | 51,5/59, 43/49, 43,5/48, 42,5/57 | 4,5 % | 0 | A compleix |
| basic | 36,5/47, 46,5/61, 39,5/53, 44/63 | 8,5 % | 1 | B compleix |
| standard | 36,5/47, 46,5/61, 40/53, 44/63 | 4,5 % | 1 | referencia |
| premium | 36,5/47, 45,5/61, 42/53, 43/57 | 4 % | 0 | B compleix |
| deluxe | 39/47, 46/61, 47,5/53, 44/58 | 4 % | 0 | B compleix |

Extres del mateix PR:

- X1. Boto Settings al menu principal: obre el mateix panell que Esc dins
  d un vol (so, grafics, mesclador, controls, guia), sense els botons del
  vol, i en tancar-lo es torna al menu principal. Sense duplicar HTML ni
  logica.
- X2. El tip de la V/S de la llico 7 diu el valor de la Vref, i la guia de
  consulta te una entrada Vref amb el valor del Mi-9. Tots dos surten de
  FlightModel.vspeeds() (core/), la mateixa font que el PFD, amb la massa amb
  que Game.spawn posa l avio (97 kt al Mi-9). El calcul ja era a core/: no ha
  calgut cap refactor.

## 2026-10-01 - Informe d aterratge: els rebots curts es compten

- Problema. flight-model.js nomes feia touchdown.bounces++ (sense esdeveniment)
  en un retoc de menys de 2 s despres d un contacte de mes de 0,5 s, i l informe
  (Game.report.bounces) nomes pujava dins onTouchdown(), que no llegia mai
  f.touchdown.bounces: els dos comptes eren disjunts i aquests rebots no
  arribaven a la nota.
- Solucio. LandingWatch.step compta la vora de pujada de mainWow (nomes rodes
  principals) amb l informe obert i la retorna a Game ({ touchdown, bounce });
  Game fa report.bounces++. La vora del pas en que es crea l informe no es
  compta (w.landed() la marca). onTouchdown ja no incrementa: no es compta dues
  vegades. flight-model.js i test/snapshot.json no es toquen.
- Efecte en la nota. Cada rebot curt que abans no es comptava resta 8 punts a
  l aterratge (el mateix pes que ja tenia scoreReport per rebot). Les notes
  d aterratge baixen, doncs, 8 punts per cada rebot curt que abans quedava fora.

## 2026-10-01 - F3: meteo procedimental pura, sense cablejar
world/weather.js (weatherFor, toGameWeather) fa servir nomes hash2: mateixa entrada, mateixa sortida. Distribucio objectiu: vent apreciable un 20 %, condicions dures (severity >= 0,7) un 6,7 %. Els patrons locals son una taula de dades. Game no es toca: encara no accepta rafegues, visibilitat ni sostre, i Game.updateGusts continua amb Math.random.

## 2026-10-01 - F1+F2: aeroports

Decisions d en Marc per a F1+F2 (aeroports de les fases 1 i 2, amb
taxiways i portes procedimentals, i desti lliure a Free Flight).

- H1. Abast: fases 1 i 2, que caben a la graella actual: LEGE, LERS, LEIB,
  LEMH, LELL, LEDA, LESU. La fase 3 (LEVC, LEAL, LECH, LFMP) necessita
  ampliar la graella i la costa (geo.js acaba a lat 39,95, i el relleu tracta
  com a illa n < -120000): va a una tasca nova, F1b (seccio 12).
- H2. Dades. tools/airports-ourairports.mjs baixa runways.csv i airports.csv
  d OurAirports (davidmegginson/ourairports-data, branca main) i genera
  src/world/airport-data.js, comitejat, amb la capcalera "generat per
  tools/airports-ourairports.mjs, no editar a ma". El joc i les proves no fan
  mai cap peticio de xarxa. Fora les pistes amb closed=1; peus a metres; si
  falta el rumb, es calcula de les coordenades dels dos llindars; ids amb
  sufix L/R/C via ids. El que no surt d OurAirports (ILS, noms curts, terreny)
  es una taula de l script.
- H3. ILS per cap de pista, camp nou nomes als aeroports nous: LEGE 20, LERS
  25, LEIB 24, LEMH 01, LEDA 31; LELL i LESU, cap. ils.js nomes sintonitza
  els caps marcats. LEBL i LEPA es queden com ara (tots els caps amb ILS).
- H4. Marques i llums segons el cap. Amb ILS: com ara (precisio, ALS de
  900 m). Sense ILS: llindar, designacio, eix, punt de mira i PAPI, sense ALS
  ni marques de zona de toc. LEBL i LEPA no canvien.
- H5. Taxiways, aprons i portes procedimentals (F2), de la pista i de
  BALANCE.airportSize: plataforma al costat de l eix on cau el punt de
  referencia (ARP) d airports.csv (si cau sobre l eix, a l esquerra del
  primer cap); mida petita, un connector de la plataforma a la pista (es
  rodola per la pista); mitjana o mes, paral.lela amb connectors als dos caps
  i un al mig; plataforma, terminal, torre i portes al costat triat, portes
  per mida al fitxer generat (petit 3, mitja 6, gran 10); bounds calculats
  perque tot hi capiga. Proves: cami de cada porta a cada cap, res fora de
  bounds, cap solapament amb la pista fora dels connectors, com a minim una
  porta.
- H6. Terreny. Radi d aplanament per aeroport (dades) als aeroports nous;
  LEBL i LEPA amb el mateix terreny d ara. Per a cada cap nou, la senda de
  3 graus fins a 10 km del llindar passa com a minim 300 ft per sobre del
  terreny, i el pendent maxim de la transicio de l aeroport al relleu no passa
  del 25 %. Si el relleu no ho permet, es rebaixa en un passadis d aproximacio
  sobre l eix allargat.
- H7. Dificultat: RUNWAY_SCALE.hard nomes a pistes de 2.000 m o mes. Les mes
  curtes (LESU, LELL) no s escurcen.
- H8. Rendiment: l escenografia d un aeroport es construeix a menys de 60 km
  de l avio i s allibera (geometria i materials) a mes de 80 km. Es mesura al
  Chromium headless abans i despres (descripcio del PR).
- H9. Free Flight: selector de desti (tots els aeroports menys l origen). El
  mode route funciona amb qualsevol parell: desti a Game.opts.dest, ruta del
  ND directa de l origen al desti, selAlt segons la distancia (taula al lloc
  del valor fix) i text del mode amb la distancia i el rumb calculats. Els
  best continuen per aeroport.
- H10. LEBL i LEPA no canvien en res: geometria, fotografia de LEBL,
  llicons, startingBase, test/threshold.test.js i test/taxi.test.js. No es
  toca test/snapshot.json.

Com s ha aplicat (sense trencar cap contracte d ENGINEERING.md):

- LEGE: vegeu l entrada seguent (02/20, ILS al 20).
- world/ no pot importar career/ (seccio 3): la mida surt de
  BALANCE.airportSize a l script (tools/ si que pot) i queda escrita al
  fitxer generat (size, layout, gates). Una prova comprova que coincideix.
- Mides com a dades: small -> petit, regional -> mitja, major i hub -> gran.
- Aeroports petits: la xarxa de rodatge inclou el tram de pista (backtrack,
  no es pinta), perque taxiRoute arribi als dos caps rodant per la pista. Al
  llindar s arriba encarat al reves i cal girar a la capcalera (no hi ha
  plataforma de gir: BACKLOG).
- Les taxiways dels aeroports nous es generen a makeAirport a partir de la
  pista ja escalada (els connectors cauen als caps a qualsevol dificultat);
  plataforma, portes, edificis i bounds son fixos. La plataforma es centra a
  l ARP, sense sortir del tram de pista que queda a hard.
- Terreny dels aeroports nous (world/terrain.js, _airportShape): nomes
  retalla el relleu natural amb superficies de pendent acotat, aixi el pendent
  de la transicio queda limitat per construccio: anell pla de flatR m (petit
  400, mitja 600, gran 800), despres un con del 20 %, i un passadis en V per
  cap amb el fons 120 m sota la senda i les parets al 20 %. Sense passadis cap
  dels set compleix la senda (LESU, 1.353 m per sota; LEDA, 248 m; fins i tot
  LEMH, per 2,6 m): tots en porten. El passadis arriba a 20 km, no a 10,
  perque l inici en final de Free Flight es a 10 nm i a LESU el relleu hi
  tornava a passar per sobre de la senda.
- Prova de la senda: entre el llindar i el punt on la senda es a 300 ft
  (uns 1,3 km) el terreny no pot passar de l elevacio de l aeroport; d alla a
  10 km, 300 ft sota la senda. A l eix i a 150 m a cada costat.
- Prova del pendent: es transicio una parella de punts veins on el terreny
  difereix del natural (heightRaw) als dos punts: com a molt 25 %. A la vora,
  la transicio no pot ser mes abrupta que el relleu natural de la mateixa
  parella. Els pics llunyans que el con retalla (Pirineu a 13 km de LESU) son
  relleu natural escarpat i no compten com a transicio. El fons del mar no
  compta.
- LEBL i LEPA: alcades identiques a 7.442 mostres preses abans del canvi
  (test/fixtures/terrain-lebl-lepa.json). No es regenera.
- Ciutat: urbanAt no posa edificis a menys de 150 m del rectangle dels
  aeroports nous (LELL es dins de Sabadell).
- Free Flight: dropSpawnOpts no cal tocar-lo. Nomes esborra els camps spawn*
  que deixa una llico; dest es una opcio de Free Flight com airport, i les
  llicons no la fan servir. Altitud del vol cronometrat: fins a 80 km, 8.000 /
  6.000 ft (jet / turbohelix); fins a 150 km, 15.000 / 11.000; fins a 260 km,
  24.000 / 17.000 (LEBL-LEPA, com abans); mes, 30.000 / 20.000.

## 2026-10-01 - F1: LEGE 02/20, taula d excepcions de designacio

Decisio d en Marc despres de revisar el PR #31. OurAirports te la numeracio
antiga de LEGE (01/19); la pista real es 02/20 (AIP i diverses fonts) i l ILS
es al 20, com deia H3.

- tools/airports-ourairports.mjs te una taula IDS_OVERRIDE d excepcions de
  designacio: nomes canvia els ids dels caps; la geometria (llindars, rumb,
  llargada, amplada) continua sortint d OurAirports. Si una excepcio ja no
  coincideix amb cap pista oberta d OurAirports, l script falla.
- LEGE: 01/19 -> 02/20, ILS al 20. airport-data.js regenerat.
- Comprovades la resta de designacions contra les reals: LERS 07/25, LEIB
  06/24, LEMH 01/19, LEDA 13/31, LELL 13/31, LESU 03/21. Totes coincideixen
  amb OurAirports: LEGE es l unica excepcio. Una prova fixa les set.

## 2026-10-01 - F1: pista d arribada del vol cronometrat de Free Flight

Decisio d en Marc dins del PR #31 (mode 'route' de Free Flight). No toca la
fisica ni test/snapshot.json.

- Pista d arribada: al desti, el cap de pista amb ILS; si n hi ha diversos o
  cap, el que tingui mes vent de cara amb el vent del vol; si no hi ha vent,
  el de la pista mes llarga. Funcio pura arrivalEnd(A, windDir, windKt) a
  world/ils.js, amb proves (test/arrival-end.test.js). Empat: el primer cap
  de l aeroport. Sense vent vol dir windKt <= 0.
- Ruta del ND: final de la pista de sortida (amb el nom de l origen) -> punt
  d aproximacio final a 10 nm del llindar d arribada, sobre l eix allargat,
  amb el nom FF + pista (FF25) -> llindar (RW25). Els noms es dibuixen com
  els de la resta de punts de ruta.
- ILS: en mode 'route', l ILS sintonitzat es el de la pista d arribada des de
  l enlairament, no el de l aeroport mes proper. El PFD en mostra el nom, el
  curs i la distancia encara que no hi hagi senyal (mes enlla de 25 nm); les
  agulles surten quan n hi ha. Si la pista d arribada no te ILS (LELL, LESU,
  o un cap sense ILS), no se sintonitza cap ILS en tot el vol. Fora del mode
  'route', com ara (auto-sintonia del cap amb que estas alineat).
- Les distancies a l aeroport de desti (Game.destEnd) prefereixen l ILS
  sintonitzat i despres la pista d arribada.
- UI.modeText afegeix la pista d arribada ("LERS 25") i s actualitza si es
  canvia el vent al menu.

## 2026-10-01 - F1: H11-H15, la pista d arribada sempre al ND

Decisions d en Marc despres de provar el PR #31 al navegador. Substitueixen
l entrada anterior sobre la pista d arribada (en conserven el que encaixa).
Volant cap a LESU, les muntanyes tapaven l aeroport i el ND no deia ni on era
la pista ni per on enfilar-la; en mode ruta la linia magenta anava d aeroport
a aeroport, l ILS sintonitzat era el de l aeroport mes proper, i la linia
continua (ruta) i la discontinua (localitzador) no s entenien. Objectiu: que
el pilot sapiga sempre, nomes mirant el ND, on es la pista d arribada i per on
l ha d enfilar, encara que no la vegi. Sense tocar la fisica de
core/flight-model.js ni test/snapshot.json.

- H11. Pista d arribada (arrivalEnd i flightApproach, world/ils.js, purs): al
  desti, el cap amb ILS; si n hi ha diversos o cap, el de mes vent de cara amb
  el vent del vol; sense vent, el de la pista mes llarga (empat: el primer
  cap). En mode 'route', la del desti; a l inici "en final", la de la propia
  arrencada; a la resta de Free Flight, la de l aeroport triat.
- H12. Aproximacio a tots els caps: en.kind 'ILS' als caps de H3 i 'RNP' a la
  resta dels aeroports nous; LEBL i LEPA, tots 'ILS'. Mateixa interficie que
  l ILS (ILS.nav: curs i senda de 3 graus); el PFD mostra "ILS 25" o "RNP 21"
  amb les mateixes escales. Marques i llums segueixen H4. El pilot automatic
  segueix la RNP a traves de world/ils.js sense tocar core/ (llegeix nomes la
  geometria de nav).
- H13. Sintonia: en mode 'route', des de l enlairament, l aproximacio de la
  pista d arribada; a l inici "en final", la de la pista de l arrencada. Fora
  d aixo, com abans (l auto-sintonia, que nomes tria ILS).
- H14. Ruta del ND: en mode 'route', final de la pista de sortida -> FF (10 nm
  sobre l eix allargat de la pista d arribada, nom "FF" + designacio) ->
  llindar; a l inici "en final" i a Free Flight sense ruta, FF -> llindar. La
  pista d arribada i el FF es dibuixen sempre. Al costat del desti, la
  distancia i el temps fins al FF. UI.modeText diu la pista d arribada.
- H15. Un estil per a cada cosa al ND: ruta magenta continua i gruixuda; curs
  sintonitzat cian discontinu, del llindar fins mes enlla del FF, amb
  l etiqueta "ILS 25" o "RNP 21" a l extrem; pista d arribada en verd amb el
  nom; FF en rombe amb el nom. Cap altra linia magenta. Llegenda petita amb
  els quatre elements.

Com s ha aplicat:

- Mode 'route' amb inici en final: mana la ruta (la pista d arribada es la
  del desti).
- Llicons: res no canvia. Game.step nomes fa la sintonia d H13 fora de les
  llicons, el ND de les llicons no rep la ruta ni la pista d arribada, i la
  distancia a la pista no prefereix la pista d arribada. Comprovat al
  Chromium amb les llicons ils, landing i taxi: el mateix ILS i el mateix cap
  que a dev.
- El curs cian i el nom al PFD surten encara que no hi hagi senyal (mes
  enlla de 25 nm); les agulles, nomes amb senyal.
- La linia del rumb seleccionat del pilot automatic (abans magenta
  discontinua) passa a gris; el requadre del rumb seleccionat continua
  magenta, perque no es una linia.
- Textos nous de la llegenda a i18n (nd.legend.*). Els identificadors (FF21,
  RW21, RNP 21) i les unitats (NM, MIN) son els del ND.
- Terreny: conca de 4 km (terrain.corridor.basin) al voltant del FF de cada
  cap nou, 120 m sota la senda al FF i parets al 20 %. Al Prat -> La Seu (03,
  sense vent) el tram final creuava la paret del passadis a 1.854 m, per
  sobre del FF (1.793 m), i el gir al FF entrava a les parets. Amb la conca,
  el turbohelix hi aterra seguint la ruta.
- Limit conegut, sense resoldre: Prat -> La Seu quan la pista d arribada es
  la 21 (vent del sud-oest). El tram directe fins al FF21 creua relleu natural
  de 2.700-2.800 m entre 13 i 8 nm abans del FF, per sobre d un descens de
  3 graus cap al FF; seguint la ruta tal com la defineix H14 no s hi pot
  baixar. Proposta per a en Marc (no implementada perque canvia H14): un punt
  intermedi sobre l eix allargat mes enlla del FF (per exemple a 20 nm), o
  que H11 descarti un cap si el tram fins al seu FF no es pot volar des de
  l origen.

## 2026-10-01 - F1: H16, punt intermedi, caps no volables i terreny natural

Decisio d en Marc per resoldre el Prat -> La Seu 21, i condicio sobre el
terreny: res de crateres ni formes artificials.

- H16. Altitud minima de cada punt: FF a l alcada de la senda de 3 graus a
  10 nm; IF a l alcada de la senda allargada a 20 nm. Un tram es volable si la
  recta entre l altitud del punt anterior i la del seguent (a l origen,
  l altitud de creuer de la ruta) queda com a minim 1.000 ft per sobre del
  terreny, amb 1 nm de marge a cada costat. Ruta en mode 'route': origen -> FF
  -> llindar si origen -> FF es volable; si no, origen -> IF -> FF -> llindar
  si origen -> IF i IF -> FF ho son. Si cap de les dues no ho es, H11 descarta
  aquell cap i tria el seguent amb la mateixa regla; si cap cap no ho es, el de
  mes vent de cara, amb un avis a la consola en mode DEV. Al ND, al costat de
  l IF i del FF, l altitud minima de pas en ft. Funcions pures a
  world/route.js.
- Terreny: si cal modificar-lo, ha de semblar natural: forma allargada
  seguint l eix d aproximacio (com una vall), mai circular; vores amples i
  suaus (pendent maxim del 12 % a la transicio), barrejades amb el soroll del
  relleu, sense vores rectes ni fons plans visibles. El mateix criteri per al
  passadis d H6. LEBL i LEPA identics.

Com s ha aplicat:

- Altitud minima al ND: l alcada de la senda arrodonida cap amunt a 100 ft
  (IF03 9100, FF03 5900): es un minim, no s arrodoneix avall.
- Origen: el final de la pista de sortida, a l altitud de creuer de la taula
  del vol cronometrat (Game.ROUTE_ALT, la que ja feia servir selAlt; jet o
  turbohelix).
- "La mateixa regla" d H11 vol dir tornar a aplicar arrivalEnd als caps que
  queden (si en queda un sol amb ILS, aquest; si no, vent de cara; sense vent,
  la pista mes llarga). Sense cap cap volable: el de mes vent de cara sense
  mirar l ILS (sense vent, la pista mes llarga).
- Terreny dels aeroports nous: en lloc del con del 20 % (que a LESU i LEDA
  feia un crater al voltant de l aeroport), del passadis en V (franja recta
  amb el fons pla) i de la conca circular del FF, una sola vall al llarg de
  l eix de pista (world/terrain.js, VALLEY): fons a l elevacio de l aeroport
  al costat de la pista i, cap enfora, per sota de la senda (130 m a prop,
  340 m a partir de 9 km, perque el tram IF -> FF tingui els 1.000 ft) fins a
  22 nm, on fa un capcal; amplada que creix amb la distancia i ondula amb
  soroll; vores al 8 % amb arrencada suau i unio suau amb el relleu natural;
  relleu de soroll al fons (fins a 80 m, escala de 6 km, nomes rebaixa). Les depressions al voltant de l aeroport es
  reomplen amb el mateix pendent. Pendent de la transicio (dins la vall):
  maxim 11,4 % (LESU); la prova en mira el 12 % a 55 km de cada aeroport.
  On la vall s uneix amb relleu natural mes escarpat, mai no hi es mes
  abrupta que el natural.
- La conca del FF ja no cal: amb la vall i l IF, totes les rutes que es fan
  servir son volables sense ella. S ha tret.
- Prat -> La Seu amb vent del sud-oest: la 21 no es volable per cap de les
  dues rutes. El tram IF -> FF de la 21 si que ho es (1.135 ft), pero el tram
  origen -> IF21 creua relleu natural del Pirineu fora de l eix d aproximacio
  (l IF21 es a 37 km al nord-est de LESU): marge de -333 ft amb el creuer del
  turbohelix (11.000 ft) i de 646 ft amb el del jet (15.000 ft). Fer-lo
  volable voldria dir rebaixar el massis fora de l eix, que es justament una
  forma artificial. Per H16, la 21 es descarta i es fa servir la 03 per l IF
  (IF03 -> FF03), que es volable. Amb 12 kt de vent del sud-oest, la 03 te
  uns 12 kt de vent de cua (pista de 1.270 m).
