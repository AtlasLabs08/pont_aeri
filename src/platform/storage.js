/* Persistencia: l unic modul de src/ que toca localStorage.
 * NOU: no ve de l original. Tasca A2 d ENGINEERING.md, seccio 8.
 *
 * EXPORTA: Storage
 *
 * IMPORTA: res. Llegeix globalThis.localStorage a cada crida, no en carregar
 * el modul: aixi les proves hi poden injectar un doble i treure l despres.
 *
 * INTERFICIE (no la canviis, app/ i els tests en depenen):
 *   Storage.load(key)       -> objecte o null. Null si la clau no hi es, si el
 *                              JSON es corrupte o si no hi ha localStorage
 *   Storage.save(key, obj)  -> true | false. False si el navegador ho refusa
 *                              (quota plena, mode privat) o si obj no es JSON
 *   Storage.remove(key)
 *   Cap dels tres llanca mai.
 */

/** localStorage o null. Accedir-hi ja pot llancar (SecurityError) en alguns navegadors. */
function backend() {
  try { return globalThis.localStorage || null; } catch (e) { return null; }
}

export const Storage = {
  load(key) {
    const ls = backend();
    if (!ls) return null;
    try {
      const v = JSON.parse(ls.getItem(key));
      return v !== null && typeof v === 'object' ? v : null;
    } catch (e) { return null; }
  },

  save(key, obj) {
    const ls = backend();
    if (!ls) return false;
    try {
      const text = JSON.stringify(obj);
      if (typeof text !== 'string') return false;
      ls.setItem(key, text);
      return true;
    } catch (e) { return false; }
  },

  remove(key) {
    const ls = backend();
    if (!ls) return;
    try { ls.removeItem(key); } catch (e) { /* res a fer */ }
  }
};
