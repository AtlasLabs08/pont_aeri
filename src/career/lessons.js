/* Lliçons de l escola de vol i check-rides de les habilitacions de tipus
 * (DESIGN.md, "Escola de vol" i "Habilitacions de tipus"). NOU: tasca C1
 * d ENGINEERING.md, ampliat a C3+C4 (docs/DECISIONS.md, 27/09/2026, D4-D8).
 * Nomes dades: els avalua school.js (criteris) o app/lesson-run.js i
 * app/debrief.js (la resta de camps, llegits en viu durant el vol).
 *
 * EXPORTA: SCHOOL_PASS CONTROL_KEYS LESSONS CHECK_RIDES
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
 *       controlKeys     (llico 'cockpit') CONTROL_KEYS: { comandament:
 *                        [codis KeyboardEvent.code] }, amb almenys cada
 *                        element de controls. El primer codi es la
 *                        tecla que l instructor anomena. Premer qualsevol
 *                        d aquests codis identifica el comandament, abans de
 *                        cap comprovacio de Game (correccio del PR #22).
 *                        Nomes compten els comandaments de controls.
 *       tips            (qualsevol llico) explicacions de l instructor, en
 *                        ordre: [{ key, keys?, params? }]. key es la clau
 *                        i18n; keys es { parametre: comandament de
 *                        CONTROL_KEYS }: el parametre val la primera tecla
 *                        del comandament (app/lesson-run.js, LessonRun.tips);
 *                        params, valors numerics presos d altres dades
 *                        d aquest fitxer (mai escrits al text i18n).
 *       taxi            (llico 'taxi') { maxDistToThrM, maxLatOffsetM,
 *                        maxGroundKt, rerouteM }: els tres primers son els
 *                        llindars de reachedThreshold; rerouteM, metres que
 *                        l avio es pot allunyar del cami per les calles de
 *                        rodatge abans de recalcular-lo (LessonRun.taxiPath).
 *       durationS       (llico 'maneuvers') segons de D5 abans d avaluar.
 *       finalStabilized (llico 'circuit') llindars de D6 per a
 *                        stabilizedOnFinal: { maxDistNm, aglFt, sustainedS,
 *                        hdgToleranceDeg, sinkMaxFpm, vrefLowKt, vrefHighKt }.
 *       guidance        (llico 'ils') { locAliveDots, alignedDeg } per a la
 *                        guia de la intercepcio (app/lesson-run.js,
 *                        ilsGuidance): el localitzador es viu a locAliveDots
 *                        punts o menys; alignedDeg, diferencia amb el rumb de
 *                        pista per considerar-se al rumb d aproximacio.
 *       guidance        (llico 'circuit') llindars de la guia per fases de
 *                        l instructor (app/lesson-run.js, circuitGuidance),
 *                        tots respecte de la pista assignada: { baseTurnDeg,
 *                        finalTurnLatM, alignedDeg }. baseTurnDeg: angle a
 *                        que el llindar queda enrere de la linia del travers
 *                        per girar a base. finalTurnLatM: distancia lateral a
 *                        l eix per girar a final. alignedDeg: diferencia de
 *                        rumb per considerar-se establert en un tram (base o
 *                        final).
 *       ilsTolerance    (llico 'ils') { locDots, gsDots, topAglFt,
 *                        bottomAglFt } per a ilsFlown: seguit si, entre
 *                        topAglFt i bottomAglFt, la desviacio no passa mai de
 *                        locDots (localitzador) ni de gsDots (senda).
 *       flareBar        (llico 'landing') llindars de D7 de la barra
 *                        d arrodoniment: { startAglFt, sinkAtStartFpm,
 *                        sinkAtContactFpm }.
 *       aids            (llico 'landing') { flareBar, autoDebrief }: marques
 *                        de D8, mai condicions al codi. flareBar es false
 *                        des de l E4 (30/09/2026): la barra no surt.
 *       spawn           (llicons 'maneuvers', 'circuit', 'landing', 'ils') posicio inicial
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
 *                        Llicons 'landing' i 'ils' (mode 'final', correccio
 *                        del 29/09): { distNm } per a 'landing' (distNm abans
 *                        del llindar, sobre l eix i la senda, configuracio
 *                        d aterratge); { distNm, lateralNm, interceptDeg,
 *                        aglFt, flaps } per a 'ils' (distNm abans del
 *                        llindar, lateralNm a l esquerra de l eix, rumb de
 *                        pista mes interceptDeg cap a l eix, anivellat a
 *                        aglFt, per sota de la senda, tren amunt).
 *   CHECK_RIDES: clau = id d habilitacio de BALANCE.ratings (sense commuter,
 *     que es la graduacio), cadascun { aircraftTypeId, titleKey, setup,
 *     criteria }. setup es informacio per a qui prepara el vol (C3, D3):
 *     school.js no l interpreta.
 */

/** Marca del llindar de nota de l escola, resolt per school.js. */
export const SCHOOL_PASS = 'schoolPass';

/** Tecles de cada comandament (KeyboardEvent.code), les mateixes que llegeixen
 * Input i Game.onKey (index.html). El primer codi es el que anomena
 * l instructor. cameraReset torna la camera a l angle per defecte
 * (docs/DECISIONS.md, 29/09/2026): Home, l unica tecla que no fa servir cap
 * altre comandament. El mateix fa un doble clic amb el boto dret (Input a
 * index.html), que es el que ensenya l instructor a la llico 1; Home queda
 * com a alternativa. */
export const CONTROL_KEYS = {
  flaps: ['KeyF', 'KeyV'], gear: ['KeyG'], parkBrake: ['KeyP'],
  throttle: ['ShiftLeft', 'ShiftRight', 'NumpadAdd', 'NumpadSubtract'],
  reverse: ['KeyR'], spoiler: ['KeyK'],
  cameraReset: ['Home'],
  // rodatge: Q i E fan girar la roda de morro a terra (Input.update: ctl.steer = yaw)
  steerLeft: ['KeyQ'], steerRight: ['KeyE'],
  // throttleDown: Input llegeix el '-' per e.key (qualsevol teclat); 'Minus' en dona el nom
  throttleUp: ['ShiftLeft', 'ShiftRight', 'NumpadAdd'], throttleDown: ['Minus', 'NumpadSubtract'],
  brake: ['KeyB'],
  // vol (Input.update): W i S mouen el morro (W avall, S amunt), A i D inclinen; les fletxes fan el mateix
  pitchDown: ['KeyW', 'ArrowUp'], pitchUp: ['KeyS', 'ArrowDown'],
  rollLeft: ['KeyA', 'ArrowLeft'], rollRight: ['KeyD', 'ArrowRight'],
  // guia de consulta (E5, docs/DECISIONS.md 30/09/2026): la resta de tecles que llegeixen Input i
  // Game.onKey, perque la guia no n escrigui cap al text. Nomes dades: Input no les llegeix d aqui.
  flapsDown: ['KeyF'], flapsUp: ['KeyV'],
  trimDown: ['KeyZ'], trimUp: ['KeyX'], autoTrim: ['KeyU'], mouseYoke: ['KeyM'],
  autopilot: ['KeyJ'], autothrottle: ['KeyT'], approach: ['KeyY'], timeAccel: ['KeyN'],
  landingLights: ['KeyL'], camera: ['KeyC'], hudToggle: ['KeyO'], sound: ['Digit0', 'Numpad0'],
  brightnessDown: ['Comma'], brightnessUp: ['Period'], help: ['KeyH'], debug: ['KeyI'],
  pause: ['Escape'], replayExit: ['Escape', 'Space', 'Enter']
};

/** llindars de D7 de la barra d arrodoniment (llico 'landing') */
const FLARE_BAR = { startAglFt: 50, sinkAtStartFpm: 500, sinkAtContactFpm: 150 };
/** ilsFlown (llico 'ils'): haver seguit l ILS vol dir no passar de locDots ni de
 * gsDots punts de desviacio en tot el tram de topAglFt a bottomAglFt (AGL) */
const ILS_TOLERANCE = { locDots: 1, gsDots: 1, topAglFt: 1500, bottomAglFt: 500 };

export const LESSONS = [
  { id: 'exterior', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.exterior.title', goalKey: 'school.lesson.exterior.goal',
    criteria: [{ metric: 'viewsVisited', op: 'gte', value: 4 }],
    tips: [{ key: 'school.tip.cameraDrag', keys: { reset: 'cameraReset' } }] },
  { id: 'cockpit', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.cockpit.title', goalKey: 'school.lesson.cockpit.goal',
    criteria: [{ metric: 'controlsIdentified', op: 'gte', value: 6 }],
    controls: ['flaps', 'gear', 'parkBrake', 'throttle', 'reverse', 'spoiler'],
    controlKeys: CONTROL_KEYS },
  { id: 'taxi', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.taxi.title', goalKey: 'school.lesson.taxi.goal',
    criteria: [{ metric: 'reachedThreshold', op: 'eq', value: true }],
    taxi: { maxDistToThrM: 60, maxLatOffsetM: 25, maxGroundKt: 20, rerouteM: 40 },
    tips: [{ key: 'school.tip.taxi', keys: { left: 'steerLeft', right: 'steerRight', more: 'throttleUp',
      less: 'throttleDown', brake: 'brake', park: 'parkBrake' } }] },
  { id: 'takeoff', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.takeoff.title', goalKey: 'school.lesson.takeoff.goal',
    criteria: [{ metric: 'maxAltFt', op: 'gte', value: 3000 },
               { metric: 'gearUp', op: 'eq', value: true }],
    tips: [{ key: 'school.tip.flight', keys: { down: 'pitchDown', up: 'pitchUp', left: 'rollLeft', right: 'rollRight' } },
           { key: 'school.tip.rudder', keys: { left: 'steerLeft', right: 'steerRight' } }] },
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
    spawn: { aglFt: 1000, lateralNm: 1.5, flaps: 'approach' },
    guidance: { baseTurnDeg: 45, finalTurnLatM: 1000, alignedDeg: 30 } },
  { id: 'landing', aircraftTypeId: 'commuter', mercy: true,
    titleKey: 'school.lesson.landing.title', goalKey: 'school.lesson.landing.goal',
    criteria: [{ metric: 'landed', op: 'eq', value: true },
               { metric: 'score', op: 'gte', value: SCHOOL_PASS }],
    flareBar: FLARE_BAR,
    // barra d arrodoniment desactivada (E4, docs/DECISIONS.md 30/09/2026): el codi es queda
    aids: { flareBar: false, autoDebrief: true },
    // final curt: alineat, a la senda i en configuracio d aterratge; tot va de l arrodoniment
    spawn: { distNm: 3 },
    tips: [{ key: 'school.tip.verticalSpeed' }] },
  { id: 'ils', aircraftTypeId: 'commuter',
    titleKey: 'school.lesson.ils.title', goalKey: 'school.lesson.ils.goal',
    criteria: [{ metric: 'ilsFlown', op: 'eq', value: true },
               { metric: 'landed', op: 'eq', value: true },
               { metric: 'onRunway', op: 'eq', value: true }],
    ilsTolerance: ILS_TOLERANCE,
    // lluny, fora de l eix i per sota de la senda: cal interceptar el localitzador i despres la senda
    spawn: { distNm: 12, lateralNm: 2, interceptDeg: 25, aglFt: 2000, flaps: 'approach' },
    guidance: { locAliveDots: 2, alignedDeg: 10 },
    tips: [{ key: 'school.tip.ilsNeedles' }] }
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
