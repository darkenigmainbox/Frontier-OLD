// Ground: asphalt base with overgrown patches, block sidewalks, courtyard lawns,
// and a crack network grown over the street area with the same fracture solver
// used for walls (so road cracks branch and arrest like real pavement cracks).
import { Builder, M, tint, col } from './geom.js';
import { growCracks } from './fracture.js';
import { rotRectContains } from './math.js';
import { toWorld, SIDEWALK_H } from './layout.js';
import { grassTuft } from './vegetation.js';

const RX = () => M([0, 0, 0], [-Math.PI / 2, 0, 0]);

export function blockAt(blocks, x, z) {
  for (const bk of blocks) if (rotRectContains(bk.cx, bk.cz, bk.angle, bk.w + 0.2, bk.d + 0.2, x, z)) return bk;
  return null;
}

export function buildGround(b, L, r, noise) {
  const S = L.size;
  // ---- asphalt base with moss / dirt patches ----
  const cell = 4, n = Math.ceil(S / cell) + 1;
  const vcol = (x, z) => {
    const m = noise.fbm(x * 0.05 + 3, z * 0.05 + 8, 3);
    const p = noise.fbm(x * 0.2 + 11, z * 0.2 - 4, 2);
    let c = [0.23, 0.235, 0.22];
    c = [c[0] * (0.85 + 0.3 * p), c[1] * (0.85 + 0.3 * p), c[2] * (0.85 + 0.3 * p)];
    if (m > 0.12) {                           // overgrown: moss and weeds
      const t = Math.min(1, (m - 0.12) * 3.5);
      c = [c[0] * (1 - t) + 0.17 * t, c[1] * (1 - t) + 0.25 * t, c[2] * (1 - t) + 0.10 * t];
    } else if (m < -0.25) {                   // bare dirt
      const t = Math.min(1, (-0.25 - m) * 3);
      c = [c[0] * (1 - t) + 0.28 * t, c[1] * (1 - t) + 0.22 * t, c[2] * (1 - t) + 0.14 * t];
    }
    return c;
  };
  const grid = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = Math.min(S, i * cell), z = Math.min(S, j * cell);
    grid[j * n + i] = { p: [x, 0, z], c: vcol(x, z) };
  }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = grid[j * n + i], bb = grid[j * n + i + 1], c = grid[(j + 1) * n + i + 1], d = grid[(j + 1) * n + i];
    b.tri('asphalt', a.p, c.p, bb.p, [a.c, c.c, bb.c], [0, 1, 0]);
    b.tri('asphalt', a.p, d.p, c.p, [a.c, d.c, c.c], [0, 1, 0]);
  }

  // ---- blocks: sidewalks, courtyards, parks ----
  for (const bk of L.blocks) {
    const sc = r.range(0.82, 1.0);
    b.box('pavement', [bk.cx, SIDEWALK_H / 2, bk.cz], [bk.w, SIDEWALK_H, bk.d], [0, bk.angle, 0], tint('#8d8b84', sc));
    if (bk.kind === 'park') {
      b.box('dirt', [bk.cx, SIDEWALK_H + 0.012, bk.cz], [bk.w - 0.6, 0.02, bk.d - 0.6], [0, bk.angle, 0], col([0.25 + r.range(-0.03, 0.03), 0.36, 0.17]));
    } else if (bk.inset) {
      const { w: iw, e, s, n: nn } = bk.inset;
      const cw = bk.w - iw - e, cd = bk.d - s - nn;
      if (cw > 2 && cd > 2) {
        const [ox, oz] = toWorld(bk.cx, bk.cz, bk.angle, -bk.w / 2 + iw + cw / 2, -bk.d / 2 + s + cd / 2);
        b.box('dirt', [ox, SIDEWALK_H + 0.012, oz], [cw, 0.02, cd], [0, bk.angle, 0], col([0.22 + r.range(-0.03, 0.04), 0.3, 0.14]));
      }
    }
  }

  // ---- crack network on the street area ----
  const inside = (x, z) => x > 1 && z > 1 && x < S - 1 && z < S - 1 && !blockAt(L.blocks, x, z);
  const streets = [];
  for (let k = 0; streets.length < 6 && k < 4000; k++) {
    const x = r.range(2, S - 2), z = r.range(2, S - 2);
    if (inside(x, z)) streets.push([x, z]);
  }
  const A = 1.0;
  const bg = (x, z) => [
    A * noise(x * 0.16 + 3, z * 0.16),
    A * 0.7 * noise(x * 0.16 + 9, z * 0.16 + 4),
    A * 0.9 * noise(x * 0.14 - 5, z * 0.14 + 7),
  ];
  const sources = streets.map(([x, z]) => ({ x, y: z, amp: 2 * 0.5 * 8 * 8, soft: 0.6, r0: 1.0, count: 10, len: 14 }));
  const tips = [];
  for (let k = 0; tips.length < 420 && k < 40000; k++) {
    const x = r.range(2, S - 2), z = r.range(2, S - 2);
    if (inside(x, z)) tips.push({ x, y: z, h: r.range(0, Math.PI * 2), len: r.range(2, 6), kc: 0.55 });
  }
  const cracks = growCracks({
    rng: r.fork('cracks'), inside: (x, y) => inside(x, y), sources, tips, background: bg,
    stepLen: 0.45, maxLen: 8, maxGen: 2, branchP: 0.03, kc: 0.55, maxCracks: 1400,
    joinDist: 0.5, maxSteps: 400000,
  });
  b.push(RX());
  for (const c of cracks) {
    const pts = c.pts.map(([x, z]) => [x, -z]);
    const w = c.gen === 0 ? 0.09 : 0.05;
    b.ribbon('crack', pts, pts.map((_, i) => w * (0.5 + 0.7 * Math.abs(Math.sin(i * 0.9 + c.id)))), [0.05, 0.045, 0.04], 0.012);
  }
  b.pop();
  // weeds grow in the cracks
  const rw = r.fork('weeds');
  for (const c of cracks) {
    for (const [x, z] of c.pts) {
      if (rw.next() < 0.05) grassTuft(b, rw, x, 0.0, z, rw.range(0.2, 0.5));
    }
  }
  return { cracks: cracks.length, crackLength: cracks.reduce((a, c) => a + c.pts.length * 0.45, 0) };
}
