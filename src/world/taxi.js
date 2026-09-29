/* Xarxa de calles de rodatge d un aeroport i cami mes curt per ella. NOU:
 * llico 3 de l escola (docs/DECISIONS.md, 29/09/2026). Headless: nomes llegeix
 * A.paved (makeAirport, airports.js), no redibuixa ni canvia cap taxiway.
 *
 * EXPORTA: buildTaxiGraph taxiRoute nearestOnPolyline
 *
 * IMPORTA: res (treballa en coordenades locals (a, c) de l aeroport).
 *
 * INTERFICIE (no la canviis, app/lesson-run.js i test/taxi.test.js en depenen):
 *   buildTaxiGraph(A) -> { nodes: [[a, c]], adj: [[{ to, w }]] }   graf no
 *     dirigit dels trams 'twy' d A.paved. Nodes als extrems de cada tram, i
 *     cruilles on:
 *       - dos extrems coincideixen (a menys de SNAP_M),
 *       - l extrem d un tram cau sobre el paviment d un altre (a menys de la
 *         seva mitja amplada de l eix, cruilla en T): el tram es parteix pel
 *         punt projectat (si no es un dels seus extrems) i s uneix amb
 *         l extrem,
 *       - dos trams es creuen.
 *     w = longitud en metres. Es calcula un sol cop per objecte aeroport
 *     (makeAirport en fa un de nou si canvia la dificultat o l escenari).
 *   taxiRoute(A, from, to) -> [[a, c], ...] | null   cami mes curt (A*) per la
 *     xarxa des de from fins a to, tots dos [a, c]. Comenca a from, va en
 *     linia recta fins al punt mes proper de la xarxa, la segueix, en surt pel
 *     punt de la xarxa mes proper a to i acaba a to. null si la xarxa es buida
 *     o els dos punts queden en trossos no connectats.
 *   nearestOnPolyline(pts, p, fromSeg = 0) -> { dist, seg, point }   punt de
 *     la polilinia mes proper a p, mirant nomes des del tram fromSeg (tram i =
 *     pts[i] -> pts[i + 1]). dist en metres. Infinity si no hi ha cap tram.
 */

const SNAP_M = 1;

function closestOnSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  const q = [a[0] + dx * t, a[1] + dy * t];
  return { t, point: q, dist: Math.hypot(p[0] - q[0], p[1] - q[1]) };
}

/** parametres (0..1) del creuament propi de dos trams, o null */
function crossing(p, q, r, s) {
  const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [s[0] - r[0], s[1] - r[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-9) return null;
  const w = [r[0] - p[0], r[1] - p[1]];
  const t = (w[0] * d2[1] - w[1] * d2[0]) / den, u = (w[0] * d1[1] - w[1] * d1[0]) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? [t, u] : null;
}

const GRAPHS = new WeakMap();

export function buildTaxiGraph(A) {
  if (GRAPHS.has(A)) return GRAPHS.get(A);
  const segs = A.paved.filter(s => s.kind === 'twy').map(s => ({ p: [s.a1, s.c1], q: [s.a2, s.c2], hw: s.hw, L: s.L, cuts: [0, 1] }));
  const nodes = [], adj = [], grid = new Map(), cell = SNAP_M * 4;
  const nodeAt = pt => {
    const gx = Math.floor(pt[0] / cell), gy = Math.floor(pt[1] / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const k of grid.get((gx + i) + ',' + (gy + j)) || []) {
        if (Math.hypot(nodes[k][0] - pt[0], nodes[k][1] - pt[1]) <= SNAP_M) return k;
      }
    }
    const k = nodes.length; nodes.push([pt[0], pt[1]]); adj.push([]);
    const key = gx + ',' + gy; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(k);
    return k;
  };
  const link = (i, j) => {
    if (i === j || adj[i].some(e => e.to === j)) return;
    const w = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]);
    adj[i].push({ to: j, w }); adj[j].push({ to: i, w });
  };
  const at = (s, t) => [s.p[0] + (s.q[0] - s.p[0]) * t, s.p[1] + (s.q[1] - s.p[1]) * t];
  const joins = [];            // [extrem, punt projectat] de les cruilles en T
  for (let i = 0; i < segs.length; i++) {
    for (let j = 0; j < segs.length; j++) {
      if (i === j) continue;
      const S = segs[i], O = segs[j];
      for (const end of [O.p, O.q]) {
        const c = closestOnSegment(end, S.p, S.q);
        if (c.dist > Math.max(S.hw, SNAP_M)) continue;
        if (c.t > 0 && c.t < 1) S.cuts.push(c.t);
        joins.push([end, c.point]);
      }
      if (j > i) {
        const x = crossing(S.p, S.q, O.p, O.q);
        if (x) { S.cuts.push(x[0]); O.cuts.push(x[1]); }
      }
    }
  }
  for (const S of segs) {
    const ids = [...new Set(S.cuts)].sort((x, y) => x - y).map(t => nodeAt(at(S, t)));
    for (let k = 0; k + 1 < ids.length; k++) link(ids[k], ids[k + 1]);
  }
  for (const [end, pt] of joins) link(nodeAt(end), nodeAt(pt));
  const G = { nodes, adj };
  GRAPHS.set(A, G);
  return G;
}

/** punt de la xarxa mes proper a p: { i, j, t, point, dist } sobre l aresta i-j */
function nearestEdge(G, p) {
  let best = null;
  G.adj.forEach((edges, i) => {
    for (const { to: j } of edges) {
      if (j < i) continue;
      const c = closestOnSegment(p, G.nodes[i], G.nodes[j]);
      if (!best || c.dist < best.dist) best = { i, j, t: c.t, point: c.point, dist: c.dist };
    }
  });
  return best;
}

/** A* sobre el graf amb dos nodes virtuals (sortida s i arribada g). Retorna la llista d ids o null */
function aStar(nodes, neighbours, s, g) {
  const h = k => Math.hypot(nodes[k][0] - nodes[g][0], nodes[k][1] - nodes[g][1]);
  const dist = new Map([[s, 0]]), prev = new Map(), done = new Set();
  const heap = [[h(s), s]];
  const push = item => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [, k] = pop();
    if (done.has(k)) continue;
    if (k === g) {
      const path = [g]; while (path[0] !== s) path.unshift(prev.get(path[0]));
      return path;
    }
    done.add(k);
    for (const { to, w } of neighbours(k)) {
      const d = dist.get(k) + w;
      if (d < (dist.has(to) ? dist.get(to) : Infinity)) { dist.set(to, d); prev.set(to, k); push([d + h(to), to]); }
    }
  }
  return null;
}

export function taxiRoute(A, from, to) {
  const G = buildTaxiGraph(A);
  const a = nearestEdge(G, from), b = nearestEdge(G, to);
  if (!a || !b) return null;
  // nodes virtuals al punt d entrada (S) i de sortida (T) de la xarxa
  const nodes = [...G.nodes, a.point, b.point], S = G.nodes.length, T = S + 1;
  const len = (x, y) => Math.hypot(nodes[x][0] - nodes[y][0], nodes[x][1] - nodes[y][1]);
  const extra = new Map();
  const add = (x, y) => {
    for (const [u, v] of [[x, y], [y, x]]) { if (!extra.has(u)) extra.set(u, []); extra.get(u).push({ to: v, w: len(u, v) }); }
  };
  add(S, a.i); add(S, a.j); add(T, b.i); add(T, b.j);
  // entrada i sortida a la mateixa aresta: tambe directe
  if ((a.i === b.i && a.j === b.j)) add(S, T);
  const neighbours = k => [...(k < S ? G.adj[k] : []), ...(extra.get(k) || [])];
  const ids = aStar(nodes, neighbours, S, T);
  if (!ids) return null;
  const pts = [from, ...ids.map(k => nodes[k]), to];
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > SNAP_M / 10);
}

export function nearestOnPolyline(pts, p, fromSeg = 0) {
  let best = { dist: Infinity, seg: -1, point: null };
  for (let i = Math.max(0, fromSeg); i + 1 < pts.length; i++) {
    const c = closestOnSegment(p, pts[i], pts[i + 1]);
    if (c.dist < best.dist) best = { dist: c.dist, seg: i, point: c.point };
  }
  return best;
}
