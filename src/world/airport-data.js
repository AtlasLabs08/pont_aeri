/* generat per tools/airports-ourairports.mjs, no editar a ma.
 * Pistes d OurAirports (davidmegginson/ourairports-data), metres i graus
 * veritables. ILS, noms i terreny: taula EXTRA de l script. Mida: BALANCE.airportSize.
 *
 * EXPORTA: AIRPORT_DATA GATES_BY_LAYOUT
 */

export const GATES_BY_LAYOUT = {"small":3,"medium":6,"large":10};

export const AIRPORT_DATA = {
  LEGE: {"icao":"LEGE","name":"Girona-Costa Brava","city":"Girona","ref":[41.904639,2.761774],"elev":142.6,"size":"regional","layout":"medium","gates":6,"ils":["20"],"terrain":{"flatR":600,"corridor":{"len":20000}},"runways":[{"ids":["02","20"],"hdg":14,"len":2400,"wid":45,"le":[41.894901,2.75826],"he":[41.915699,2.76612]}]},
  LERS: {"icao":"LERS","name":"Reus","city":"Reus","ref":[41.147509,1.168354],"elev":71,"size":"regional","layout":"medium","gates":6,"ils":["25"],"terrain":{"flatR":600,"corridor":{"len":20000}},"runways":[{"ids":["07","25"],"hdg":68.9,"len":2455,"wid":45,"le":[41.1441,1.15586],"he":[41.152,1.18315]}]},
  LEIB: {"icao":"LEIB","name":"Eivissa","city":"Eivissa","ref":[38.872898,1.37312],"elev":7.3,"size":"major","layout":"large","gates":10,"ils":["24"],"terrain":{"flatR":800,"corridor":{"len":20000}},"runways":[{"ids":["06","24"],"hdg":62.1,"len":2800,"wid":45,"le":[38.866901,1.35887],"he":[38.8787,1.38738]}]},
  LEMH: {"icao":"LEMH","name":"Menorca","city":"Maó","ref":[39.862598,4.21865],"elev":92,"size":"regional","layout":"medium","gates":6,"ils":["01"],"terrain":{"flatR":600,"corridor":{"len":20000}},"runways":[{"ids":["01","19"],"hdg":8,"len":2550,"wid":45,"le":[39.851257,4.216322],"he":[39.872166,4.220619]}]},
  LELL: {"icao":"LELL","name":"Sabadell","city":"Sabadell","ref":[41.520901,2.10508],"elev":147.8,"size":"small","layout":"small","gates":3,"ils":[],"terrain":{"flatR":400,"corridor":{"len":20000}},"runways":[{"ids":["13","31"],"hdg":127.2,"len":1049,"wid":30,"le":[41.523346,2.100731],"he":[41.517643,2.110748]}]},
  LEDA: {"icao":"LEDA","name":"Lleida-Alguaire","city":"Lleida","ref":[41.728185,0.535023],"elev":351.1,"size":"small","layout":"small","gates":3,"ils":["31"],"terrain":{"flatR":400,"corridor":{"len":20000}},"runways":[{"ids":["13","31"],"hdg":133,"len":2500,"wid":61,"le":[41.735657,0.524481],"he":[41.720768,0.545544]}]},
  LESU: {"icao":"LESU","name":"La Seu d'Urgell","city":"La Seu d'Urgell","ref":[42.3386,1.40917],"elev":800.1,"size":"small","layout":"small","gates":3,"ils":[],"terrain":{"flatR":400,"corridor":{"len":20000}},"runways":[{"ids":["03","21"],"hdg":31,"len":1267,"wid":28,"le":[42.336159,1.406678],"he":[42.345936,1.4146]}]}
};
