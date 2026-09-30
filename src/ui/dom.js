/* Utilitats de DOM de ui/ i estil de taulell de sortides (DESIGN.md,
 * "Concepte visual del menu"): fons pissarra, tipografia condensada, files
 * fines, accents ambre i verd. Nomes fonts del sistema: cap font externa.
 * NOU: tasca C5+D1 d ENGINEERING.md (docs/DECISIONS.md, 30/09/2026, E8).
 *
 * EXPORTA: el ensureStyles
 *
 * INTERFICIE (no la canviis, la resta de ui/ en depen):
 *   el(tag, props, ...children) -> Element. props: class, style (cssText),
 *     on<event> (addEventListener), la resta com a atributs (true = buit,
 *     null/false = cap). Els fills de text entren com a text, mai com a HTML.
 *   ensureStyles()   afegeix el <style> de ui/ un sol cop.
 */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

const CSS = `
.pa-ui{--pa-slate:#161c21;--pa-slate2:#1e262d;--pa-line:#2c3842;--pa-text:#e6ebee;--pa-dim:#8a9aa6;
 --pa-amber:#f5b83d;--pa-green:#3ddc84;--pa-red:#ff6b6b;
 --pa-cond:"Roboto Condensed","Arial Narrow","Helvetica Neue Condensed","Liberation Sans Narrow","DejaVu Sans Condensed",Arial,sans-serif;
 --pa-mono:ui-monospace,"Cascadia Mono",Consolas,"DejaVu Sans Mono",monospace;
 position:fixed;z-index:22;color:var(--pa-text);font-family:var(--pa-cond);font-stretch:condensed;
 background:rgba(22,28,33,.95);box-shadow:12px 0 40px rgba(0,0,0,.45);overflow-y:auto}
.pa-ui.pa-side{top:0;left:0;bottom:0;width:min(600px,100vw);padding:28px 30px}
.pa-ui.pa-wide{inset:0;background:rgba(22,28,33,.9);padding:0}
.pa-ui *{box-sizing:border-box}
.pa-ui h1{margin:0;font-size:2.6rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;line-height:1}
.pa-ui h2{margin:0 0 .2rem;font-size:1.5rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.pa-ui .pa-sub{margin:.35rem 0 1.4rem;color:var(--pa-amber);letter-spacing:.2em;text-transform:uppercase;font-size:.85rem}
.pa-ui p{line-height:1.45;margin:.4rem 0 .9rem}
.pa-ui .pa-dim{color:var(--pa-dim)}
.pa-ui .pa-board{border-top:2px solid var(--pa-amber);margin:0 0 1.2rem}
.pa-ui .pa-head,.pa-ui .pa-row{display:grid;grid-template-columns:3.2rem 1fr 7.5rem;gap:0 .8rem;align-items:center;padding:.55rem .4rem;border-bottom:1px solid var(--pa-line)}
.pa-ui .pa-head{color:var(--pa-dim);font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;padding:.35rem .4rem}
.pa-ui .pa-row.pa-click{cursor:pointer}.pa-ui .pa-row.pa-click:hover,.pa-ui .pa-row.pa-click:focus-visible{background:var(--pa-slate2);outline:none}
.pa-ui .pa-code{font-family:var(--pa-mono);color:var(--pa-amber);font-size:.95rem}
.pa-ui .pa-name{font-size:1.2rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.pa-ui .pa-desc{display:block;color:var(--pa-dim);font-size:.9rem;font-weight:400;letter-spacing:0;text-transform:none;margin-top:.1rem}
.pa-ui .pa-status{font-family:var(--pa-mono);font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;text-align:right}
.pa-ui .pa-ok{color:var(--pa-green)}.pa-ui .pa-warn{color:var(--pa-amber)}.pa-ui .pa-off{color:var(--pa-dim)}.pa-ui .pa-bad{color:var(--pa-red)}
.pa-ui .pa-lessons .pa-head,.pa-ui .pa-lessons .pa-row{grid-template-columns:2rem 1fr 6.5rem 5.2rem}
.pa-ui .pa-row.pa-locked{opacity:.55}
.pa-ui button{font:inherit;font-stretch:condensed;letter-spacing:.1em;text-transform:uppercase;font-size:.85rem;cursor:pointer;
 border:1px solid var(--pa-line);background:var(--pa-slate2);color:var(--pa-text);padding:.55em 1em;border-radius:2px}
.pa-ui button:hover{border-color:var(--pa-amber);color:var(--pa-amber)}
.pa-ui button:focus-visible,.pa-ui input:focus-visible{outline:2px solid var(--pa-amber);outline-offset:2px}
.pa-ui button.pa-primary{background:var(--pa-amber);border-color:var(--pa-amber);color:#161c21;font-weight:700}
.pa-ui button.pa-primary:hover{background:#ffcb5c;color:#161c21}
.pa-ui button:disabled{opacity:.4;cursor:default}
.pa-ui .pa-btns{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}
.pa-ui label.pa-label{display:block;color:var(--pa-dim);font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;margin:0 0 .3rem}
.pa-ui input[type=text]{width:100%;font:inherit;font-size:1.4rem;letter-spacing:.06em;padding:.4em .5em;background:#0f1418;color:var(--pa-text);border:1px solid var(--pa-line);border-bottom:2px solid var(--pa-amber);border-radius:0}
.pa-ui .pa-msg{min-height:1.3em;font-size:.9rem;margin:.4rem 0 0}
.pa-ui .pa-kv{display:grid;grid-template-columns:1fr auto;border-bottom:1px solid var(--pa-line);padding:.55rem .4rem;align-items:baseline}
.pa-ui .pa-kv b{font-family:var(--pa-mono);font-size:1.15rem;color:var(--pa-green);font-weight:600}
.pa-topbar{display:flex;flex-wrap:wrap;align-items:stretch;border-bottom:2px solid var(--pa-amber);background:#0f1418}
.pa-topbar .pa-cell{padding:.5rem 1rem;border-right:1px solid var(--pa-line);display:flex;flex-direction:column;justify-content:center;min-width:6rem}
.pa-topbar .pa-cell i{font-style:normal;color:var(--pa-dim);font-size:.68rem;letter-spacing:.18em;text-transform:uppercase}
.pa-topbar .pa-cell b{font-family:var(--pa-mono);font-weight:600;font-size:1rem}
.pa-topbar .pa-pilot{flex:1 1 14rem}
.pa-topbar .pa-pilot b{font-family:var(--pa-cond);font-size:1.15rem;letter-spacing:.06em;text-transform:uppercase}
.pa-rank{display:inline-block;margin-left:.5rem;padding:.05em .45em;border:1px solid var(--pa-amber);color:var(--pa-amber);font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;vertical-align:middle}
.pa-xpbar{height:4px;background:var(--pa-line);margin-top:.35rem;min-width:9rem}.pa-xpbar span{display:block;height:4px;background:var(--pa-green)}
.pa-ops{padding:1.2rem 1.6rem}
.pa-tabs{display:flex;flex-wrap:wrap;border-bottom:1px solid var(--pa-line);margin:1rem 0 0}
.pa-ui .pa-tabs button{border:0;border-bottom:2px solid transparent;background:none;padding:.6em 1em;border-radius:0}
.pa-ui .pa-tabs button[aria-selected=true]{color:var(--pa-amber);border-bottom-color:var(--pa-amber)}
.pa-tabpanel{padding:2.2rem .4rem;font-family:var(--pa-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--pa-amber)}
.pa-guide .pa-head,.pa-guide .pa-row{grid-template-columns:9rem 1fr}
.pa-guide .pa-row{padding:.4rem .4rem}.pa-guide .pa-code{font-size:.85rem}
.pa-guide h3{margin:1.2rem 0 .3rem;font-size:.8rem;letter-spacing:.2em;text-transform:uppercase;color:var(--pa-amber)}
.pa-banner{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:80;background:#2a1215;color:#ffd7d7;border-left:3px solid #ff6b6b;
 padding:.55em 1.1em;font:600 .9rem system-ui,sans-serif;max-width:80vw}
.pa-banner.pa-good{background:#10281a;color:#c9f5da;border-left-color:#3ddc84}
.pa-backlink{display:inline-block;margin:0 0 .8rem;padding:0;background:none;border:0;color:#0f9aa0;text-decoration:underline;cursor:pointer;font-size:.9rem;letter-spacing:.02em}
@media (max-width:640px){.pa-ui.pa-side{padding:20px 16px}.pa-ui .pa-lessons .pa-head,.pa-ui .pa-lessons .pa-row{grid-template-columns:1.6rem 1fr 5.4rem}.pa-ui .pa-lessons .pa-status{display:none}}
`;

let injected = false;

export function ensureStyles() {
  if (injected) return;
  injected = true;
  document.head.append(el('style', { id: 'paUiStyles' }, CSS));
}
