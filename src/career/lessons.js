/* Lliçons de l escola de vol i check-rides de les habilitacions de tipus
 * (DESIGN.md, "Escola de vol" i "Habilitacions de tipus"). NOU: tasca C1
 * d ENGINEERING.md. Nomes dades: els avalua school.js. Els llindars de
 * pilotatge (ft, vistes, notes dels check-rides) viuen aqui, excepcio a la
 * regla 4 de la seccio 0; passScore, mercyScore i mercyAttempt de l escola
 * continuen a BALANCE.school (docs/DECISIONS.md, 27/09/2026).
 *
 * EXPORTA: SCHOOL_PASS LESSONS CHECK_RIDES
 *
 * INTERFICIE (no la canviis, school.js, el C3, el C5, el D3 i els tests en depenen):
 *   Criteri: { metric, op, value }. metric es un nom de METRICS (school.js);
 *     op = 'gte' | 'lte' | 'eq'. value = SCHOOL_PASS vol dir el llindar de
 *     nota de l escola, que school.js resol amb BALANCE.school.
 *   LESSONS: array en ordre, cadascuna { id, aircraftTypeId, titleKey,
 *     goalKey, criteria, mercy? }. mercy: true vol dir que, a partir de
 *     l intent BALANCE.school.mercyAttempt, SCHOOL_PASS val mercyScore.
 *     Afegir una llico es afegir-la aqui, sense tocar codi.
 *   CHECK_RIDES: clau = id d habilitacio de BALANCE.ratings (sense commuter,
 *     que es la graduacio), cadascun { aircraftTypeId, titleKey, setup,
 *     criteria }. setup es informacio per a qui prepara el vol (C3, D3):
 *     school.js no l interpreta.
 */

/** Marca del llindar de nota de l escola, resolt per school.js. */
export const SCHOOL_PASS = 'schoolPass';

export const LESSONS = [
  { id: 'exterior', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.exterior.title', goalKey: 'school.lesson.exterior.goal',
    criteria: [{ metric: 'viewsVisited', op: 'gte', value: 4 }] },
  { id: 'cockpit', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.cockpit.title', goalKey: 'school.lesson.cockpit.goal',
    criteria: [{ metric: 'controlsIdentified', op: 'gte', value: 6 }] },
  { id: 'taxi', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.taxi.title', goalKey: 'school.lesson.taxi.goal',
    criteria: [{ metric: 'reachedThreshold', op: 'eq', value: true }] },
  { id: 'takeoff', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.takeoff.title', goalKey: 'school.lesson.takeoff.goal',
    criteria: [{ metric: 'maxAltFt', op: 'gte', value: 3000 },
               { metric: 'gearUp', op: 'eq', value: true }] },
  { id: 'maneuvers', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.maneuvers.title', goalKey: 'school.lesson.maneuvers.goal',
    criteria: [{ metric: 'altDeviationMaxFt', op: 'lte', value: 200 }] },
  { id: 'circuit', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.circuit.title', goalKey: 'school.lesson.circuit.goal',
    criteria: [{ metric: 'stabilizedOnFinal', op: 'eq', value: true }] },
  { id: 'landing', aircraftTypeId: 'commuter', mercy: true,
    titleKey: 'school.lesson.landing.title', goalKey: 'school.lesson.landing.goal',
    criteria: [{ metric: 'landed', op: 'eq', value: true },
               { metric: 'score', op: 'gte', value: SCHOOL_PASS }] },
  { id: 'ils', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.ils.title', goalKey: 'school.lesson.ils.goal',
    criteria: [{ metric: 'landed', op: 'eq', value: true },
               { metric: 'onRunway', op: 'eq', value: true }] }
];

export const CHECK_RIDES = {
  turboprop: { aircraftTypeId: 'tp', titleKey: 'checkride.turboprop.title',
    setup: { crosswindKt: 12 },
    criteria: [{ metric: 'landed', op: 'eq', value: true },
               { metric: 'score', op: 'gte', value: 70 }] },
  narrowbody: { aircraftTypeId: 'nb', titleKey: 'checkride.narrowbody.title',
    setup: { ils: true, engineIdleOnApproach: true },
    criteria: [{ metric: 'ilsFlown', op: 'eq', value: true },
               { metric: 'landed', op: 'eq', value: true },
               { metric: 'onRunway', op: 'eq', value: true }] },
  widebody: { aircraftTypeId: 'wb', titleKey: 'checkride.widebody.title',
    setup: { longHaul: true },
    criteria: [{ metric: 'landed', op: 'eq', value: true },
               { metric: 'fuelWithinPlan', op: 'eq', value: true }] },
  quad: { aircraftTypeId: 'jumbo', titleKey: 'checkride.quad.title',
    setup: { landingMass: 'MLW' },
    criteria: [{ metric: 'landed', op: 'eq', value: true },
               { metric: 'score', op: 'gte', value: 80 }] }
};
