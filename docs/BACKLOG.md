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
| Unificar la funcio eur (duplicada a economy.js, wear.js i damage.js) en un modul compartit de career/ | Refactor, no es funcionalitat: va en un PR a part. |
| Models 3D definitius per al llancament: primer GLB parametrics generats des d aircraft-data.js (nodes amb noms fixos, UV per a la lliurea, prova automatica contra la fisica), despres un artista en refa l aspecte | Va despres de M2: primer el render ha de sortir d index.html. |
| Modes de spawn 'airborne' i 'downwind' (afegits per a les llicons 5 i 6) al menu de Free Flight | Nomes te sentit un cop hi hagi manera de triar posicio/altitud/velocitat des del menu; ara son numeros fixos de lessons.js. |
| Freecam per al trailer, nomes en mode DEV: camera lliure (teclat i ratoli, velocitat ajustable), punts clau de camera (posicio, direccio, zoom) amb interpolacio suau, control de l hora i de la meteo, amagar HUD i cabina, pausa. Es filma sobre repeticions desades, no en viu. Renderitzat fotograma a fotograma amb temps fix (per exemple a 4K) exportant imatges, i muntatge amb ffmpeg | Va despres de M2 i dels models 3D definitius: primer el render ha de sortir d index.html i l aspecte dels avions ha de ser el final. |
| Avio gairebe supersonic de mid-endgame, d aspecte tipus Concorde (llarg, prim, ala en delta). Model nou: no substitueix el Xaloc X-90, que omple el buit entre turbohelix i narrowbody. Nom amb un vent lliure (Gregal o Ponent) | Demana fisica nova (efectes de Mach, resistencia transsonica) i un lloc a la corba de balanc de balance.js. Es el contrari d un canvi barat: no abans que el midgame estigui provat. |
| Especialitzacio dels avions: cada tipus d una classe amb un paper propi (pista curta, capacitat, velocitat, abast), amb restriccions d aeroports i rutes perque la tria compti | Pendent d una sessio de disseny (D2+D5, G12). |
| Branques de carrera i millores dels avions (configuracio de cabina, motors, winglets, avionica, ETOPS). Condicio d en Marc: nomes opcions que ofereixen els fabricants i les aerolinies reals, i una de cada; res que converteixi l avio en un "frankenstein". Cal simular cada branca al harness | Pendent d una sessio de disseny (D2+D5, G12). |
| Superjumbo amb cabina premium: suites i primera classe, pocs seients molt cars, demanda nomes en llarg radi entre hubs, molt sensible a la reputacio. Variant escalada del T-4, sense fisica nova; vent lliure (Gregal o Ponent) | Es decideix despres del mid game (D2+D5, G12). |
| Aspecte visual per categoria d avio: pintura gastada (basic), normal (standard), fresca (premium), lliurea nova i brillant (deluxe) | Amb el poliment grafic o els models definitius; la categoria ja es desa (D2+D5, G12). |
