# Backlog

Idees aparcades. No es toca res d aqui fins que el bucle economic hagi demostrat que enganxa.

| Idea | Per que ara no |
| --- | --- |
| Mercat d avions enorme, altres vehicles aeris | Explosio d abast. Quatre avions basten per provar el bucle. |
| Transit amb IA que es mou | Pathing, separacio i conflictes. Quan falla, arruina partides. |
| Aerolinies competidores que roben pilots | Endgame d un joc que encara no te midgame. |
| Perdre l avio per accident | Mata la retencio. Asseguranca amb franquicia. |
| Passatgers pujant i baixant renderitzats | Car i aporta poc. Barra d embarcament que consumeix temps real. |
| Suport per comandament | Mes endavant. |
| Models 3D definitius per al llancament: primer GLB parametrics generats des d aircraft-data.js (nodes amb noms fixos, UV per a la lliurea, prova automatica contra la fisica), despres un artista en refa l aspecte | Va despres de M2: primer el render ha de sortir d index.html. |
| Modes de spawn 'airborne' i 'downwind' (afegits per a les llicons 5 i 6) al menu de Free Flight | Nomes te sentit un cop hi hagi manera de triar posicio/altitud/velocitat des del menu; ara son numeros fixos de lessons.js. |
| Freecam per al trailer, nomes en mode DEV: camera lliure (teclat i ratoli, velocitat ajustable), punts clau de camera (posicio, direccio, zoom) amb interpolacio suau, control de l hora i de la meteo, amagar HUD i cabina, pausa. Es filma sobre repeticions desades, no en viu. Renderitzat fotograma a fotograma amb temps fix (per exemple a 4K) exportant imatges, i muntatge amb ffmpeg | Va despres de M2 i dels models 3D definitius: primer el render ha de sortir d index.html i l aspecte dels avions ha de ser el final. |
| Avio gairebe supersonic de mid-endgame, d aspecte tipus Concorde (llarg, prim, ala en delta). Model nou: no substitueix el Xaloc X-90, que omple el buit entre turbohelix i narrowbody. Nom amb un vent lliure (Gregal o Ponent) | Demana fisica nova (efectes de Mach, resistencia transsonica) i un lloc a la corba de balanc de balance.js. Es el contrari d un canvi barat: no abans que el midgame estigui provat. |
| Especialitzacio dels avions: cada tipus d una classe amb un paper propi (pista curta, capacitat, velocitat, abast), amb restriccions d aeroports i rutes perque la tria compti | Pendent d una sessio de disseny (D2+D5, G12). |
| Branques de carrera i millores dels avions (configuracio de cabina, motors, winglets, avionica, ETOPS). Condicio del projecte: nomes opcions que ofereixen els fabricants i les aerolinies reals, i una de cada; res que converteixi l avio en un "frankenstein". Cal simular cada branca al harness | Pendent d una sessio de disseny (D2+D5, G12). |
| Superjumbo amb cabina premium: suites i primera classe, pocs seients molt cars, demanda nomes en llarg radi entre hubs, molt sensible a la reputacio. Variant escalada del T-4, sense fisica nova; vent lliure (Gregal o Ponent) | Es decideix despres del mid game (D2+D5, G12). |
| Aspecte visual per categoria d avio: pintura gastada (basic), normal (standard), fresca (premium), lliurea nova i brillant (deluxe) | Amb el poliment grafic o els models definitius; la categoria ja es desa (D2+D5, G12). |
| Plataformes de gir als caps de les pistes dels aeroports petits (LESU, LELL, LEDA), on es rodola per la pista (F2) | Ara s arriba al llindar encarat al reves i cal girar sobre la pista. No ho demana F2. |
| Text d inici en final de Free Flight en un cap sense ILS (ara diu "Ten miles out on the ILS"); passar-lo a i18n | Text antic d index.html: es migra al bloc M (seccio 9). |
| Cabina: ND clar i present a totes les vistes; millora grafica dels instruments | Poliment grafic; ara no bloqueja cap sistema. |
| X-90: proporcions de jet regional compactes i estabilitzador mes petit, al model definitiu de Blender | Va amb els models definitius; la geometria actual (F6) es provisional. |
| Vent de cua de mes de 10 kt sense alternativa: proposar desviament (D3+D4) | Cal el despatx i el briefing (D3+D4) i la meteo cablejada al joc. |
| Rendiment: mesurar arrencada i menus (s ha notat lentitud) | Primer cal mesurar-ho; no es toca res sense dades. |
| Market: varietat de la barreja (ara rated 0,50 / next 0,35 / other 0,15) | Es decideix despres de jugar-hi mes; tocar-la mou el balanç (B5). |
| Terreny real, fases B-D: colors segons usos del sol (ESA WorldCover o Corine), arbres 3D a les zones de bosc (models de Blender), ortofotos de l ICGC | La fase A es una altra tasca. Les ortofotos s han de baixar des d un ordinador amb acces a l ICGC. |
| Contracte de model d aeroport per als edificis de Blender: unitats, origen al punt de referencia, orientacio, fitxer de posicions | Cal definir-lo abans de rebre els models. |
| Script pont_aeri_escenari.py de l escenari fotografic de LEBL: no es al repositori | Cal afegir-lo al repositori; sense ell l escenari no es pot regenerar. |
