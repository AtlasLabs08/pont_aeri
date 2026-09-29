/* Vigilant de l aterratge: garanteix que Game registri cada aterratge encara que
 * el FlightModel no n emeti l esdeveniment 'touchdown'.
 *
 * El model nomes l emet quan les rodes principals toquen amb airTime > 2, i
 * airTime torna a 0 despres de 0,5 s amb QUALSEVOL roda a terra. Si el morro
 * toca primer i s hi queda (o fa bots curts que sumen 0,5 s), quan arriben les
 * principals no hi ha esdeveniment, Game no crea l informe i no surt mai
 * (docs/DECISIONS.md, 29/09/2026). El model no es toca: el comptatge de rebots
 * i les metriques de contacte del harness queden igual.
 *
 * EXPORTA: LandingWatch touchdownFrom
 *
 * INTERFICIE (index.html i test/landing-watch.test.js en depenen):
 *   const w = new LandingWatch()
 *   w.reset()                  en cada Game.spawn()
 *   w.step(f, { reportOpen, crashed }) -> touchdown | null
 *       un cop per pas, DESPRES de processar els esdeveniments del model.
 *       reportOpen: Game te un informe creat i encara sense mostrar;
 *       crashed: Game ja ha declarat un accident. Torna un objecte amb la forma
 *       de FlightModel.touchdown quan cal registrar un aterratge que el model no
 *       ha anunciat; Game l assigna a f.touchdown i crida onTouchdown().
 *         - en tocar les rodes principals (qualsevol ordre de contacte);
 *         - xarxa de seguretat: a terra per sota de 35 kt, amb les dades del
 *           primer contacte de les principals (o les del moment, si no n hi ha).
 *       Nomes actua si l avio ha volat (airTime > 2 en l aire) des del darrer
 *       aterratge registrat, no hi ha cap informe obert ni cap accident.
 *   w.landed()                 Game ha creat l informe d un aterratge
 */

/** mateixos camps que FlightModel.touchdown (flight-model.js, seccio 8); vs en m/s cap avall */
export function touchdownFrom(f) {
  const o = f.out;
  return { t: f.time, vs: Math.max(f.vdF || f.vd, 0), nzPeak: f.nz, n: f.n, e: f.e, hdg: o.hdg, track: o.track, gs: o.gs,
    ias: o.ias, pitch: o.pitch, roll: o.roll, bounces: 0 };
}

export const NET_GS_KT = 35;           // el mateix llindar que tanca l aterratge a Game.step

export class LandingWatch {
  constructor() { this.reset(); }
  reset() { this.pending = false; this.mainWas = false; this.contact = null; }
  landed() { this.pending = false; this.contact = null; }
  step(f, { reportOpen, crashed }) {
    const rising = f.mainWow && !this.mainWas; this.mainWas = f.mainWow;
    if (!f.wow && f.airTime > 2) this.pending = true;
    if (!this.pending || reportOpen || crashed) return null;
    if (rising) { this.contact = touchdownFrom(f); return this.contact; }
    if (f.wow && f.out.gs < NET_GS_KT) return this.contact || touchdownFrom(f);
    return null;
  }
}
