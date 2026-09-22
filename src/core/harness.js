/* Banc de proves headless: vola maniobres guionades amb el model real i
 * compara els resultats amb rangs publicats per categoria.
 * ORIGEN: linies 1058-1271 de l'original (SECTION 7).
 *
 * EXPORTA: Harness newCtl
 *
 * IMPORTA: ./constants.js, ./aircraft-data.js, ./flight-model.js,
 *          ./trim.js, ./autopilot.js
 *
 * INTERFICIE (no la canviis, el test en depen):
 *   Harness.run(id)  -> { id, name, rows, pass, detail }
 *                       rows[] = { name, val, range, unit, pass }
 *   Harness.runAll() -> array del mateix, un per avio
 *
 * Viu a core/ i no a test/ perque el panell de depuracio del joc tambe l'importa.
 */

// ...
