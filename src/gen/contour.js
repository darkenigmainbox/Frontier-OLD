// Marching squares on a regular grid, returning closed iso-contours.
// Used to turn fragment masks (cells) into smooth-ish hole outlines that follow
// the real crack network instead of a grid staircase.

/**
 * @param nx,ny   grid size (nodes); data[j*nx+i] is node (i,j)
 * @param level   iso value
 * @param cs      node spacing
 * @param x0,y0   world coords of node (0,0)
 * @returns Array<Array<[x,y]>>  closed loops (last point not repeated)
 */
export function contours(nx, ny, data, level, cs, x0, y0) {
  const segs = [];
  const adj = new Map();
  const V = (i, j) => data[j * nx + i];
  const eidH = (i, j) => 2 * (j * nx + i);       // horizontal edge (i,j)-(i+1,j)
  const eidV = (i, j) => 2 * (j * nx + i) + 1;   // vertical edge   (i,j)-(i,j+1)
  const P = (i, j) => [x0 + i * cs, y0 + j * cs];
  const lerp = (p, q, vp, vq) => {
    const t = (level - vp) / (vq - vp);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  };
  const adjEdges = [[0, 3], [0, 1], [1, 2], [2, 3]]; // corner a,b,c,d -> its two edges

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
      const ia = a > level, ib = b > level, ic = c > level, id = d > level;
      if (ia === ib && ib === ic && ic === id) continue;
      const eid = [eidH(i, j), eidV(i + 1, j), eidH(i, j + 1), eidV(i, j)];
      const crossing = [ia !== ib, ib !== ic, id !== ic, ia !== id];
      const pts = [];
      if (crossing[0]) pts[0] = lerp(P(i, j), P(i + 1, j), a, b);
      if (crossing[1]) pts[1] = lerp(P(i + 1, j), P(i + 1, j + 1), b, c);
      if (crossing[2]) pts[2] = lerp(P(i, j + 1), P(i + 1, j + 1), d, c);
      if (crossing[3]) pts[3] = lerp(P(i, j), P(i, j + 1), a, d);
      const X = [0, 1, 2, 3].filter((k) => crossing[k]);
      const pairs = [];
      if (X.length === 2) pairs.push([X[0], X[1]]);
      else if (X.length === 4) {
        // saddle: isolate the corners on the opposite side of the cell centre
        const cIn = (a + b + c + d) / 4 > level;
        const corners = [ia, ib, ic, id];
        for (let k = 0; k < 4; k++) if (corners[k] !== cIn) pairs.push(adjEdges[k]);
      }
      for (const [ea, eb] of pairs) {
        const s = { ia: eid[ea], ib: eid[eb], pa: pts[ea], pb: pts[eb] };
        const idx = segs.length;
        segs.push(s);
        for (const e of [s.ia, s.ib]) {
          let l = adj.get(e);
          if (!l) { l = []; adj.set(e, l); }
          l.push(idx);
        }
      }
    }
  }

  const used = new Uint8Array(segs.length);
  const loops = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const loop = [segs[s].pa, segs[s].pb];
    const startId = segs[s].ia;
    let exitId = segs[s].ib;
    let closed = false;
    for (let guard = 0; guard <= segs.length; guard++) {
      if (exitId === startId) { closed = true; break; }
      let nxt = -1;
      for (const t of adj.get(exitId) || []) if (!used[t]) { nxt = t; break; }
      if (nxt < 0) break;
      used[nxt] = 1;
      const sg = segs[nxt];
      if (sg.ia === exitId) { loop.push(sg.pb); exitId = sg.ib; }
      else { loop.push(sg.pa); exitId = sg.ia; }
    }
    if (closed) { loop.pop(); if (loop.length >= 3) loops.push(loop); }
  }
  return loops;
}
