/* Debrief detallat d un aterratge: tradueix el Touchdown d un FlightRecord i
 * els punts maxims de Game.scoreReport en files per component. NOU: tasca
 * C4 d ENGINEERING.md. Logica pura, sense i18n ni DOM: index.html hi posa
 * els textos (a la llico 7, el panell s obre sol despres de cada intent).
 * Sense frase final generada: nomes les files.
 *
 * EXPORTA: debriefRows BOUNCE_PENALTY_PTS TAIL_STRIKE_PENALTY_PTS
 *
 * INTERFICIE (no la canviis, index.html i els tests en depenen):
 *   debriefRows(touchdown, { tailStrike, ptsMax })
 *     touchdown: el camp touchdown d un FlightRecord (score i pts inclosos).
 *     ptsMax: { sink, g, zone, center, attitude }, els punts maxims de cada
 *       component tal com els calcula Game.scoreReport. NO es copien a ma:
 *       si Game.scoreReport no els exposa, index.html no pot cridar aixo
 *       (vegeu la descripcio del PR).
 *     Retorna un array de 7 files, en aquest ordre:
 *       { component: 'sink', ok, pts, ptsMax, measured: touchdown.fpm }
 *       { component: 'g', ok, pts, ptsMax, measured: touchdown.g }
 *       { component: 'zone', ok, pts, ptsMax, measured: touchdown.tdzDist }
 *         (measured null si onRunway es fals: touchdown.tdzDist ja ho es)
 *       { component: 'center', ok, pts, ptsMax, measured: touchdown.center }
 *       { component: 'attitude', ok, pts, ptsMax, measured: touchdown.roll }
 *       { component: 'bounces', count, penaltyPts }
 *       { component: 'tailStrike', present, penaltyPts }
 *     Els 5 primers son OK si pts / ptsMax >= 0.7 (OK_RATIO); si no,
 *     'Needs improvement' (index.html tria el text amb i18n, aqui nomes ok).
 *     bounces: penaltyPts = count * BOUNCE_PENALTY_PTS (8, com scoreReport).
 *     tailStrike: penaltyPts = present ? TAIL_STRIKE_PENALTY_PTS (15) : 0.
 */

const OK_RATIO = 0.7;
export const BOUNCE_PENALTY_PTS = 8;
export const TAIL_STRIKE_PENALTY_PTS = 15;

const gradedRow = (component, pts, ptsMax, measured) =>
  ({ component, ok: ptsMax > 0 && pts / ptsMax >= OK_RATIO, pts, ptsMax, measured });

export function debriefRows(touchdown, { tailStrike, ptsMax }) {
  const td = touchdown, p = td.pts;
  return [
    gradedRow('sink', p.sink, ptsMax.sink, td.fpm),
    gradedRow('g', p.g, ptsMax.g, td.g),
    gradedRow('zone', p.zone, ptsMax.zone, td.tdzDist),
    gradedRow('center', p.center, ptsMax.center, td.center),
    gradedRow('attitude', p.attitude, ptsMax.attitude, td.roll),
    { component: 'bounces', count: td.bounces, penaltyPts: td.bounces * BOUNCE_PENALTY_PTS },
    { component: 'tailStrike', present: !!tailStrike, penaltyPts: tailStrike ? TAIL_STRIKE_PENALTY_PTS : 0 }
  ];
}
