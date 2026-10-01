/* Proporcions visuals dels models 3D propis (F6): Mi-9 (commuter) i X-90 (jet regional).
 * Nomes dibuix: no es fa servir a la fisica.
 *
 * EXPORTA: modelGeom, legTopY, legLength, groundClearances
 *
 * Les mides principals (envergadura, superficie, llargada, radi del fuselatge, tren, posicio dels motors)
 * surten de la configuracio de l avio (aircraft-data.js). Aqui nomes hi ha ratios adimensionals
 * (fraccio del radi del fuselatge, de la llargada o de l envergadura), mai metres escrits a ma.
 * Els metres de cada camp surten de multiplicar un ratio per una mida de la configuracio.
 * Espai del model: +X dreta, +Y amunt, -Z endavant, origen al CG.
 */

const FUSE_TAIL_START = 0.64, FUSE_NOSE_FRAC = 0.12;      // valors per defecte de AircraftModel.fuselage

// ratios per avio; cada camp diu de quina mida de la configuracio es multiplica
const RATIOS = {
  commuter: {   // bimotor turbohelix de 19 places, ala alta recta, T de cua, gondoles que sobresurten per darrere de l ala
    taper: 0.62, dihedral: 1.5,
    wingPlaneR: 0.80,        // alcada del pla de l ala sobre el CG = radi * aixo (alineat amb l eix dels motors, que ve de engines.pos)
    hSpanB: 0.36,            // envergadura de l estabilitzador = b * aixo
    hChordL: 0.085,          // corda d arrel de l estabilitzador = llargada * aixo
    finHL: 0.16, finChordL: 0.15, finSweep: 34,
    nacR: 0.50, nacL: 6.4,   // radi de gondola = radi fuselatge * aixo; llargada = radi de gondola * aixo
    wheelR: 0.31, noseWheelR: 0.22, bogie: 1, winglet: 0,
    noseFrac: 0.10, tailStart: 0.70, blades: 4, mount: 'wing', dorsal: true
  },
  rj: {         // jet regional: ala baixa, motors a cua amb pilo al fuselatge, T de cua
    taper: 0.30, dihedral: 4.5,
    wingPlaneR: 0.50,        // pla de l ala sota el CG = radi * aixo
    hSpanB: 0.36, hChordL: 0.068, finHL: 0.135, finChordL: 0.135, finSweep: 36,
    nacR: 0.47, nacL: 4.2,
    wheelR: 0.30, noseWheelR: 0.20, bogie: 1, winglet: 0.04,   // winglet = b * aixo
    noseFrac: 0.105, tailStart: 0.68, blades: 0, mount: 'rear', dorsal: false
  }
};

/** Proporcions de dibuix d un avio amb geometria propia; undefined si l avio encara comparteix la d una categoria. */
export function modelGeom(cfg) {
  const r = RATIOS[cfg.id];
  if (!r) return undefined;
  const R = cfg.model.fuseR, L = cfg.model.length, b = cfg.geom.b, nacR = R * r.nacR;
  return {
    taper: r.taper, dihedral: r.dihedral,
    wingZ: (cfg.model.wing === 'high' ? -1 : 1) * R * r.wingPlaneR,
    hSpan: b * r.hSpanB, hChord: L * r.hChordL, finH: L * r.finHL, finChord: L * r.finChordL, finSweep: r.finSweep,
    nacR, nacL: nacR * r.nacL, wheelR: R * r.wheelR, noseWheelR: R * r.noseWheelR, bogie: r.bogie, winglet: b * r.winglet,
    noseFrac: r.noseFrac, tailStart: r.tailStart, blades: r.blades, mount: r.mount, dorsal: r.dorsal
  };
}

/** altura (model Y) on el tren surt del fuselatge o de l ala */
export function legTopY(cfg, G, isNose) {
  const M = cfg.model;
  return isNose ? -M.fuseR * 0.75 : (M.wing === 'high' ? -M.fuseR * 0.7 : -G.wingZ - 0.2);
}

/** longitud de la pota des del pivot fins a l eix de la roda: el contacte amb terra surt de zStatic + staticDefl, no de la geometria visual */
export function legLength(cfg, G, isNose) {
  const gz = cfg.gear.zStatic + cfg.gear.staticDefl;
  return gz + legTopY(cfg, G, isNose) - (isNose ? G.noseWheelR : G.wheelR);
}

/** distancies lliures a terra (m) amb l avio sobre el tren, per a la prova de coherencia (contracte del #18) */
export function groundClearances(cfg, G) {
  const gz = cfg.gear.zStatic + cfg.gear.staticDefl, M = cfg.model, b2 = cfg.geom.b / 2, wingY = -G.wingZ;
  const tipY = wingY + (b2 - M.fuseR * (M.wing === 'high' ? 0.35 : 0.72)) * Math.tan(G.dihedral * Math.PI / 180);
  const eng = cfg.engines.pos.map(p => -p[2] - G.nacR * 1.05);
  return {
    gz,
    mainLeg: legLength(cfg, G, false), noseLeg: legLength(cfg, G, true),
    wingtip: gz + tipY,
    nacelle: gz + Math.min(...eng),
    prop: cfg.type === 'jet' ? Infinity : gz + Math.min(...cfg.engines.pos.map(p => -p[2])) - G.nacR * 3.1452
  };
}
