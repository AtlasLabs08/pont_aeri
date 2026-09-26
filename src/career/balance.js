/* Totes les constants economiques del mode Airline, en un sol objecte.
 * NOU: tasca A5 en deixa l esquelet; la tasca B1 l omple (ENGINEERING.md
 * seccio 6).
 *
 * EXPORTA: BALANCE
 *
 * INTERFICIE (no la canviis, state.js i els tests en depenen):
 *   BALANCE.version   s incrementa cada cop que canvia qualsevol valor, i
 *                     state.js ho detecta amb needsBalanceUpdate()
 */

export const BALANCE = { version: 1 };
