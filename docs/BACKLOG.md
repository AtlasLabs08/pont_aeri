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
