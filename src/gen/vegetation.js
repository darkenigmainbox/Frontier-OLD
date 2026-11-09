// Plants: vines that climb or hang on facades, branching trees (broadleaf,
// conifer, dead), shrubs and grass tufts. All emitted into the shared buckets.
import { M, tint, UNIT_SPHERE, UNIT_CONE, col } from './geom.js';

const LEAF = ['#3f6b2e', '#4e7a35', '#2f5a2a', '#6b8a3a', '#5a6e2c', '#7a8a3a', '#355f3a'];
const BARK = ['#4a3b2e', '#5b4a3a', '#3e3a36', '#6a5a4a'];
const FOLIAGE = ['#3d6a33', '#4f7a3b', '#2e5a30', '#5f7f38', '#6d7d3a', '#8a7d3c'];

const pick = (r, a) => a[Math.floor(r.next() * a.length)];

/**
 * Vines on one facade. Runs inside the facade's local transform (u,v,d).
 * Strands climb from the plinth or hang from the roofline; leaves are small
 * diamonds on the wall; openings are avoided only partially (vines do grow over windows).
 * Returns the number of strands drawn.
 */
export function vinesOnFacade(b, r, noise, F, coverage) {
  const { W, y0, top, openings } = F;
  const H = Math.max(1, top(W / 2) - y0);
  const count = Math.min(14, Math.round(coverage * (W / 2.6) * Math.min(1.3, H / 9)));
  const seed = r.range(0, 99);
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    const u0 = r.range(0.2, Math.max(0.3, W - 0.2));
    const climb = r.chance(0.7);
    const v0 = climb ? y0 + r.range(0, 1.0) : top(u0) - r.range(0.2, 1.2);
    const dir = climb ? 1 : -1;
    const len = Math.min(H * 0.95, r.range(H * 0.3, H * 0.9));
    const pts = [];
    let u = u0, v = v0, L = 0;
    const step = r.range(0.45, 0.6);
    while (L < len && v > y0 + 0.05 && v < top(u) - 0.05 && u > 0.05 && u < W - 0.05) {
      pts.push([u, v]);
      u += (noise(u * 0.7 + seed, v * 0.45) * 0.9 + r.gauss() * 0.1) * step;
      u = Math.min(W - 0.05, Math.max(0.05, u));
      v += dir * step;
      L += step;
    }
    if (pts.length < 3) continue;
    drawn++;
    const stemCol = [0.22, 0.34, 0.16];
    b.ribbon('vine', pts, pts.map((_, k) => (k % 3 === 0 ? 0.07 : 0.05)), stemCol, 0.07);
    for (let k = 0; k < pts.length; k++) {
      if (r.next() < 0.55) continue;
      const [pu, pv] = pts[k];
      const cu = pu + r.range(-0.15, 0.15), cv = pv + r.range(-0.12, 0.12);
      const s = r.range(0.11, 0.2), a = r.range(0, Math.PI * 2);
      const ca = Math.cos(a), sa = Math.sin(a);
      const leafCol = col(pick(r, LEAF));
      const d = 0.12 + r.range(0, 0.06);
      const p = (x, y) => [cu + ca * x - sa * y, cv + sa * x + ca * y, d];
      b.quad('leaf', p(0, s), p(s * 0.55, 0), p(0, -s * 0.8), p(-s * 0.55, 0), leafCol, [0, 0, 1]);
    }
  }
  void openings;
  return drawn;
}

/** A branching tree whose base sits at the origin of the current transform. */
export function tree(b, r, { species = 'broad', height = 8, trunk = 0.25 }) {
  const bark = col(pick(r, BARK));
  const trunkH = height * (species === 'conifer' ? 0.25 : 0.42);
  const dead = species === 'dead';
  if (species === 'conifer') {
    b.cyl('bark', [0, 0, 0], [0, height, 0], trunk * 0.7, bark);
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const y = trunkH + t * (height - trunkH);
      const rad = (1 - t) * height * 0.22 + 0.6;
      const h = height * 0.22;
      b.geom('foliage', UNIT_CONE, M([0, y + h / 2, 0], [0, r.range(0, 1), 0], [rad, h, rad]), tint(pick(r, FOLIAGE), 0.9 + 0.2 * r.next()));
    }
    return;
  }
  branch(b, r, [0, 0, 0], [0, 1, 0], trunkH, trunk, 4, species, bark, height);
  void dead;
}

function branch(b, r, p, d, len, rad, depth, species, bark, H) {
  const q = [p[0] + d[0] * len, p[1] + d[1] * len, p[2] + d[2] * len];
  b.cyl('bark', p, q, Math.max(rad, 0.03), bark);
  if (depth === 0 || len < 0.9) {
    if (species !== 'dead') foliage(b, r, q, Math.max(1.1, H * 0.16 * r.range(0.8, 1.3)));
    return;
  }
  const kids = depth >= 3 ? 2 : r.chance(0.6) ? 2 : 3;
  for (let i = 0; i < kids; i++) {
    const nd = perturb(r, d, r.range(0.4, 0.95));
    branch(b, r, q, nd, len * r.range(0.62, 0.78), rad * 0.62, depth - 1, species, bark, H);
  }
  if (species !== 'dead' && depth <= 2 && r.chance(0.5)) foliage(b, r, q, Math.max(0.9, H * 0.09));
}

function foliage(b, r, c, rad) {
  const n = 1 + (r.next() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const o = [c[0] + r.range(-0.4, 0.4), c[1] + r.range(-0.2, 0.4), c[2] + r.range(-0.4, 0.4)];
    const rr = rad * r.range(0.8, 1.2);
    b.geom('foliage', UNIT_SPHERE, M(o, [r.range(0, 3), r.range(0, 3), 0], [rr, rr * 0.8, rr]), tint(pick(r, FOLIAGE), 0.85 + 0.3 * r.next()));
  }
}

function perturb(r, d, spread) {
  let x = d[0] + r.gauss() * spread, y = d[1] * 0.6 + r.gauss() * spread * 0.5 + 0.25, z = d[2] + r.gauss() * spread;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** Shrub: a cluster of foliage spheres. Base at the origin of the current transform. */
export function bush(b, r, center, size) {
  b.push(M(center, [0, 0, 0], [1, 1, 1]));
  const n = 3 + Math.floor(r.next() * 3);
  for (let i = 0; i < n; i++) {
    const rr = size * r.range(0.45, 0.75);
    const o = [r.range(-size * 0.5, size * 0.5), rr * 0.5, r.range(-size * 0.5, size * 0.5)];
    b.geom('foliage', UNIT_SPHERE, M(o, [0, 0, 0], [rr, rr * 0.75, rr]), tint(pick(r, FOLIAGE), 0.9 + 0.2 * r.next()));
  }
  b.pop();
}

/** Grass tuft at world/local point (x,y,z), `h` metres tall. */
export function grassTuft(b, r, x, y, z, h = 0.35, colour = null) {
  const c = colour || tint(pick(r, ['#5d7a3a', '#6e8a40', '#4b6a30', '#8a8a4a', '#7a7040']), 1);
  const a = r.range(0, Math.PI * 2);
  const dx = Math.cos(a) * 0.08, dz = Math.sin(a) * 0.08;
  for (let k = 0; k < 3; k++) {
    const aa = a + (k - 1) * 0.5;
    const tip = [x + Math.cos(aa) * 0.12 * r.range(0.5, 1.2), y + h * r.range(0.6, 1.1), z + Math.sin(aa) * 0.12];
    b.tri('grass', [x - dx * 0.5 + Math.cos(aa + 1.57) * 0.03, y, z - dz * 0.5 + Math.sin(aa + 1.57) * 0.03],
      tip, [x + dx * 0.5 - Math.cos(aa + 1.57) * 0.03, y, z + dz * 0.5 - Math.sin(aa + 1.57) * 0.03], c, [0, 1, 0]);
  }
}
