/* Lliçons de l escola de vol i check-rides de les habilitacions de tipus
 * (DESIGN.md, "Escola de vol" i "Habilitacions de tipus"). NOU: tasca C1
 * d ENGINEERING.md, ampliat a C3+C4 (docs/DECISIONS.md, 27/09/2026, D4-D8).
 * Nomes dades: els avalua school.js (criteris) o app/lesson-run.js i
 * app/debrief.js (la resta de camps, llegits en viu durant el vol).
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
 *     Camps nous de C3+C4, nomes llegits per app/lesson-run.js i
 *     app/debrief.js, mai per school.js:
 *       controls        (llico 'cockpit') llista ordenada dels comandaments
 *                        que l instructor demana un a un (noms d Input/Game).
 *       controlKeys     (llico 'cockpit') { comandament: [codis KeyboardEvent.code] }
 *                        de cada element de controls. El primer codi es la
 *                        tecla que l instructor anomena. Premer qualsevol
 *                        d aquests codis identifica el comandament, abans de
 *                        cap comprovacio de Game (correccio del PR #22).
 *       taxi            (llico 'taxi') { maxDistToThrM, maxLatOffsetM,
 *                        maxGroundKt }: llindars de reachedThreshold.
 *       durationS       (llico 'maneuvers') segons de D5 abans d avaluar.
 *       finalStabilized (llico 'circuit') llindars de D6 per a
 *                        stabilizedOnFinal: { maxDistNm, aglFt, sustainedS,
 *                        hdgToleranceDeg, sinkMaxFpm, vrefLowKt, vrefHighKt }.
 *       ilsTolerance    (llico 'ils') { locDots, gsDots, sustainedS } per a
 *                        ilsFlown.
 *       flareBar        (llico 'landing') llindars de D7 de la barra
 *                        d arrodoniment: { startAglFt, sinkAtStartFpm,
 *                        sinkAtContactFpm }.
 *       aids            (llico 'landing') { flareBar, autoDebrief }: marques
 *                        de D8, mai condicions al codi.
 *       spawn           (llicons 'maneuvers' i 'circuit') posicio inicial
 *                        que index.html passa a Game.spawn() via opts
 *                        (correccio del PR #22): { aglFt, offshoreNm,
 *                        flaps } per a 'maneuvers' (mode 'airborne': en
 *                        vol, anivellat, uns offshoreNm mar endins de
 *                        l aeroport, rumb de pista); { aglFt, lateralNm,
 *                        flaps } per a 'circuit' (mode 'downwind': al
 *                        travers del llindar, rumb contrari al de la
 *                        pista). flaps es 'clean' o 'approach': Game.spawn()
 *                        el tradueix a l index de flaps de l avio (0 o
 *                        cfg.flapTO), mai un index escrit a ma.
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
    criteria: [{ metric: 'controlsIdentified', op: 'gte', value: 6 }],
    controls: ['flaps', 'gear', 'parkBrake', 'throttle', 'reverse', 'spoiler'],
    controlKeys: { flaps: ['KeyF', 'KeyV'], gear: ['KeyG'], parkBrake: ['KeyP'],
      throttle: ['ShiftLeft', 'ShiftRight', 'NumpadAdd', 'NumpadSubtract'],
      reverse: ['KeyR'], spoiler: ['KeyK'] } },
  { id: 'taxi', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.taxi.title', goalKey: 'school.lesson.taxi.goal',
    criteria: [{ metric: 'reachedThreshold', op: 'eq', value: true }],
    taxi: { maxDistToThrM: 60, maxLatOffsetM: 25, maxGroundKt: 20 } },
  { id: 'takeoff', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.takeoff.title', goalKey: 'school.lesson.takeoff.goal',
    criteria: [{ metric: 'maxAltFt', op: 'gte', value: 3000 },
               { metric: 'gearUp', op: 'eq', value: true }] },
  { id: 'maneuvers', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.maneuvers.title', goalKey: 'school.lesson.maneuvers.goal',
    criteria: [{ metric: 'altDeviationMaxFt', op: 'lte', value: 200 },
               { metric: 'headingChangeDeg', op: 'gte', value: 180 }],
    durationS: 120,
    spawn: { aglFt: 4000, offshoreNm: 10, flaps: 'clean' } },
  { id: 'circuit', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.circuit.title', goalKey: 'school.lesson.circuit.goal',
    criteria: [{ metric: 'stabilizedOnFinal', op: 'eq', value: true }],
    finalStabilized: { maxDistNm: 3, aglFt: 500, sustainedS: 10,
      hdgToleranceDeg: 10, sinkMaxFpm: 1000, vrefLowKt: -5, vrefHighKt: 20 },
    spawn: { aglFt: 1500, lateralNm: 1.5, flaps: 'approach' } },
  { id: 'landing', aircraftTypeId: 'commuter', mercy: true,
    titleKey: 'school.lesson.landing.title', goalKey: 'school.lesson.landing.goal',
    criteria: [{ metric: 'landed', op: 'eq', value: true },
               { metric: 'score', op: 'gte', value: SCHOOL_PASS }],
    flareBar: { startAglFt: 50, sinkAtStartFpm: 500, sinkAtContactFpm: 150 },
    aids: { flareBar: true, autoDebrief: true } },
  { id: 'ils', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.ils.title', goalKey: 'school.lesson.ils.goal',
    criteria: [{ metric: 'landed', op: 'eq', value: true },
               { metric: 'onRunway', op: 'eq', value: true }],
    ilsTolerance: { locDots: 1, gsDots: 1, sustainedS: 10 } }
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
