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
 * EXPORTA: LandingWatch
 *
 * INTERFICIE (index.html i test/landing-watch.test.js en depenen):
 *   const w = new LandingWatch()
 *   w.reset()                  en cada Game.spawn()
 *   w.step(f, { reportOpen, crashed }) -> { touchdown, bounce }
 *       un cop per pas, DESPRES de processar els esdeveniments del model.
 *       bounce: true si en aquest pas les rodes principals tornen a tocar amb
 *       l informe obert (rebot curt o llarg del mateix aterratge). Ho compta
 *       Game (report.bounces++): el model nomes en compta els de menys de 2 s
 *       i sense esdeveniment, i l informe no els llegia. La vora del pas en que
 *       es crea l informe (w.landed()) no es compta: es el primer contacte.
 *       reportOpen: Game te un informe creat i encara sense mostrar;
 *       crashed: Game ja ha declarat un accident. touchdown es un objecte amb
 *       la forma de FlightModel.touchdown (o null) quan cal registrar un aterratge que el model no
 *       ha anunciat; Game l assigna a f.touchdown i crida onTouchdown().
 *         - en tocar les rodes principals (qualsevol ordre de contacte);
 *         - xarxa de seguretat: a terra per sota de 35 kt, amb les dades del
 *           primer contacte de les principals (o les del moment, si no n hi ha).
 *       Nomes actua si l avio ha volat (airTime > 2 en l aire) des del darrer
 *       aterratge registrat, no hi ha cap informe obert ni cap accident. Els
 *       rebots amb l informe obert, per llargs que siguin, son del mateix
 *       aterratge i no el tornen a activar.
 *   w.landed()                 Game ha creat l informe d un aterratge
 */

/** mateixos camps que FlightModel.touchdown (flight-model.js, seccio 8); vs en m/s cap avall */
function touchdownFrom(f) {
  const o = f.out;
  return { t: f.time, vs: Math.max(f.vdF || f.vd, 0), nzPeak: f.nz, n: f.n, e: f.e, hdg: o.hdg, track: o.track, gs: o.gs,
    ias: o.ias, pitch: o.pitch, roll: o.roll, bounces: 0 };
}

const NET_GS_KT = 35;           // el mateix llindar que tanca l aterratge a Game.step

export class LandingWatch {
  constructor() { this.reset(); }
  reset() { this.pending = false; this.mainWas = false; this.contact = null; this.skipEdge = false; }
  landed() { this.pending = false; this.contact = null; this.skipEdge = true; }
  step(f, { reportOpen, crashed }) {
    const rising = f.mainWow && !this.mainWas; this.mainWas = f.mainWow;
    // landed() marca la vora d aquest pas (o, si l informe el crea el vigilant, la del seguent, que ja no hi es): es el
    // primer contacte, no un rebot
    const bounce = rising && reportOpen && !this.skipEdge; this.skipEdge = false;
    if (!f.wow && f.airTime > 2) this.pending = true;
    // amb un informe obert, qualsevol rebot (encara que passi mes de 2 s a l aire) es part del mateix aterratge: ja esta
    // registrat. Es neteja aqui i no a cada cami de Game.onTouchdown, perque cap cami nou no el pugui oblidar
    if (reportOpen) { this.pending = false; this.contact = null; return { touchdown: null, bounce }; }
    if (!this.pending || crashed) return { touchdown: null, bounce };
    if (rising) { this.contact = touchdownFrom(f); return { touchdown: this.contact, bounce }; }
    if (f.wow && f.out.gs < NET_GS_KT) return { touchdown: this.contact || touchdownFrom(f), bounce };
    return { touchdown: null, bounce };
  }
}
