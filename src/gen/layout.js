// City layout: districts (convex cells around seed points), a rotated street
// grid per district, blocks with a courtyard, and building lots along every
// block edge. Coordinates: world X/Z in metres, Y up.
import { rotRectContains } from './math.js';

export const SIDEWALK_H = 0.12;

export const DISTRICT_KINDS = {
  old_town:    { label: 'Old town',     destruction: 0.9, vegetation: 0.9, spacing: [46, 56], street: [8, 10],  archetypes: { rowhouse: 5, shopfront: 4, apartment: 3, civic: 1, gothic: 1 } },
  commercial:  { label: 'Commercial',   destruction: 1.1, vegetation: 0.6, spacing: [52, 62], street: [10, 12], archetypes: { shopfront: 4, office: 4, modernist: 1, apartment: 2 } },
  residential: { label: 'Housing',      destruction: 0.8, vegetation: 1.1, spacing: [48, 58], street: [8, 10],  archetypes: { apartment: 5, rowhouse: 3, modernist: 2, parkade: 1 } },
  industrial:  { label: 'Industrial',   destruction: 1.3, vegetation: 0.7, spacing: [62, 76], street: [12, 14], archetypes: { industrial: 5, parkade: 2, office: 1 } },
  civic:       { label: 'Civic centre', destruction: 0.9, vegetation: 0.9, spacing: [56, 66], street: [11, 13], archetypes: { civic: 3, gothic: 2, office: 2, apartment: 1 } },
  suburb:      { label: 'Suburb',       destruction: 0.5, vegetation: 1.5, spacing: [44, 52], street: [7, 9],   archetypes: { rowhouse: 5, apartment: 2, shopfront: 1 } },
};

/** Rotate local (x,z) by block/district angle a, R_y convention used throughout. */
export function toWorld(cx, cz, a, x, z) {
  return [cx + x * Math.cos(a) + z * Math.sin(a), cz - x * Math.sin(a) + z * Math.cos(a)];
}

export function planLayout(rng, o) {
  const S = o.size;
  const kinds = rng.shuffle(Object.keys(DISTRICT_KINDS));
  const nD = Math.max(3, Math.min(6, o.districts));
  const seeds = [];
  for (let i = 0; i < nD; i++) {
    let p = null;
    for (let t = 0; t < 300; t++) {
      p = { x: rng.range(0.12, 0.88) * S, z: rng.range(0.12, 0.88) * S };
      if (seeds.every((s) => Math.hypot(s.x - p.x, s.z - p.z) > S * 0.2)) break;
    }
    seeds.push(p);
  }
  // The seed nearest the centre is the civic centre.
  let centre = 0;
  seeds.forEach((s, i) => { if (Math.hypot(s.x - S / 2, s.z - S / 2) < Math.hypot(seeds[centre].x - S / 2, seeds[centre].z - S / 2)) centre = i; });
  const districts = seeds.map((s, i) => {
    const kind = i === centre ? 'civic' : kinds[i % kinds.length];
    const k = DISTRICT_KINDS[kind];
    return {
      id: i, kind, label: k.label, x: s.x, z: s.z,
      angle: (kind === 'old_town' ? rng.range(0.25, 0.5) : rng.range(-0.06, 0.06)) * (rng.chance(0.3) ? -1 : 1),
      spacing: k.spacing, street: rng.range(k.street[0], k.street[1]),
      destruction: k.destruction * rng.range(0.8, 1.2),
      vegetation: k.vegetation * rng.range(0.8, 1.2),
      archetypes: k.archetypes,
    };
  });
  const nearest = (x, z) => {
    let best = 0, bd = Infinity;
    for (const d of districts) {
      const dd = (d.x - x) ** 2 + (d.z - z) ** 2;
      if (dd < bd) { bd = dd; best = d.id; }
    }
    return best;
  };

  const blocks = [];
  const margin = 2;
  for (const d of districts) {
    const Px = rng.range(d.spacing[0], d.spacing[1]);
    const Pz = rng.range(d.spacing[0], d.spacing[1]);
    const K = Math.ceil((S * 1.5) / Math.min(Px, Pz)) + 1;
    const bw = Px - d.street, bd = Pz - d.street;
    for (let i = -K; i <= K; i++) for (let j = -K; j <= K; j++) {
      const [cx, cz] = toWorld(d.x, d.z, d.angle, i * Px, j * Pz);
      const w = bw * rng.range(0.96, 1.02), dd = bd * rng.range(0.96, 1.02);
      if (cx < margin || cz < margin || cx > S - margin || cz > S - margin) continue;
      const corners = [[-w / 2, -dd / 2], [w / 2, -dd / 2], [w / 2, dd / 2], [-w / 2, dd / 2]]
        .map(([x, z]) => toWorld(cx, cz, d.angle, x, z));
      if (!corners.every(([x, z]) => x > 0 && z > 0 && x < S && z < S)) continue;
      if (!corners.every(([x, z]) => nearest(x, z) === d.id) || nearest(cx, cz) !== d.id) continue;
      const roll = rng.next();
      const kind = roll < 0.08 ? 'park' : roll < 0.16 ? 'ruin' : 'built';
      blocks.push({ id: blocks.length, district: d.id, cx, cz, angle: d.angle, w, d: dd, kind, corners, inset: null });
    }
  }

  const lots = [];
  for (const b of blocks) {
    if (b.kind === 'park') continue;
    const ldW = Math.min(b.w / 2 - 2, rng.range(10, 15));
    const ldE = Math.min(b.w / 2 - 2, rng.range(10, 15));
    const ldS = Math.min(b.d / 2 - 2, rng.range(10, 15));
    const ldN = Math.min(b.d / 2 - 2, rng.range(10, 15));
    b.inset = { w: ldW, e: ldE, s: ldS, n: ldN };   // courtyard = block minus lot depths
    const edges = [
      { n: [0, -1], along: 'x', from: -b.w / 2 + ldW, to: b.w / 2 - ldE, fixed: -b.d / 2, depth: ldS },
      { n: [0, 1], along: 'x', from: -b.w / 2 + ldW, to: b.w / 2 - ldE, fixed: b.d / 2, depth: ldN },
      { n: [-1, 0], along: 'z', from: -b.d / 2 + ldS, to: b.d / 2 - ldN, fixed: -b.w / 2, depth: ldW },
      { n: [1, 0], along: 'z', from: -b.d / 2 + ldS, to: b.d / 2 - ldN, fixed: b.w / 2, depth: ldE },
    ];
    for (const e of edges) {
      const span = e.to - e.from;
      if (span < 6) continue;
      const count = Math.max(1, Math.round(span / rng.range(9, 14)));
      const lw = span / count;
      for (let k = 0; k < count; k++) {
        const t = e.from + (k + 0.5) * lw;
        const lx = e.along === 'x' ? t : e.fixed;
        const lz = e.along === 'x' ? e.fixed : t;
        const [fx, fz] = toWorld(b.cx, b.cz, b.angle, lx, lz);
        const [nx, nz] = toWorld(0, 0, b.angle, e.n[0], e.n[1]);
        // R_y(theta) maps local (0,0,-1) onto the outward normal.
        const theta = Math.atan2(-nx, -nz);
        lots.push({
          id: lots.length, block: b.id, district: b.district,
          x: fx, z: fz, y: SIDEWALK_H, theta,
          lw, ld: e.depth, nx, nz,
          // Lots on blocks whose kind is 'ruin' start empty and get rubble instead.
          kind: b.kind,
        });
      }
    }
  }
  return { size: S, districts, blocks, lots };
}
