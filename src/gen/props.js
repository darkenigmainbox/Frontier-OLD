// Street and block dressing: abandoned cars, fallen lamp posts, rubble,
// street trees in the corner gardens, courtyard planting, park benches.
import { M, tint, col, UNIT_CYL } from './geom.js';
import { toWorld, SIDEWALK_H } from './layout.js';
import { tree, bush, grassTuft } from './vegetation.js';

function edgesOf(bk) {
  const hw = bk.w / 2, hd = bk.d / 2;
  const defs = [
    { c: [0, -hd], n: [0, -1], t: [1, 0], len: bk.w },
    { c: [0, hd], n: [0, 1], t: [1, 0], len: bk.w },
    { c: [-hw, 0], n: [-1, 0], t: [0, 1], len: bk.d },
    { c: [hw, 0], n: [1, 0], t: [0, 1], len: bk.d },
  ];
  return defs.map((e) => {
    const [x, z] = toWorld(bk.cx, bk.cz, bk.angle, e.c[0], e.c[1]);
    const [nx, nz] = toWorld(0, 0, bk.angle, e.n[0], e.n[1]);
    const [tx, tz] = toWorld(0, 0, bk.angle, e.t[0], e.t[1]);
    return { x, z, nx, nz, tx, tz, len: e.len };
  });
}

const CAR_COLS = ['#7d2e25', '#2f4a5e', '#6e6a5e', '#c9c4b5', '#3a4c3a', '#8a7a4a', '#4a4a4f', '#a85a2a'];

function car(b, r, x, z, yaw) {
  const c = col(r.pick(CAR_COLS));
  const fallen = r.chance(0.05), tilt = r.chance(0.25) ? r.range(-0.12, 0.12) : 0;
  b.push(M([x, 0, z], [0, yaw, 0]));                     // car frame: +X along the car, +Y up
  if (fallen) b.push(M([0, 0.9, 0], [Math.PI / 2, 0, 0])); // rolled onto its side
  else if (tilt) b.push(M([0, 0, 0], [0, 0, tilt]));       // sagging suspension
  b.box('metal', [0, 0.55, 0], [4.3, 0.7, 1.8], [0, 0, 0], tint(c, 1));
  b.box('glass', [-0.2, 1.22, 0], [2.3, 0.62, 1.62], [0, 0, 0], tint('#2a3238', 1));
  for (const wx of [-1.45, 1.45]) for (const wz of [-0.86, 0.86]) {
    b.geom('interior', UNIT_CYL, M([wx, 0.33, wz], [Math.PI / 2, 0, 0], [0.33, 0.24, 0.33]), tint('#1d1d1c', 1));
  }
  if (fallen || tilt) b.pop();
  b.pop();
}

export function streetProps(b, L, r, noise) {
  for (const bk of L.blocks) {
    const rr = r.fork(`bk${bk.id}`);
    const es = edgesOf(bk);
    es.forEach((e, ei) => {
      // lamp posts along the curb
      for (let s = -e.len / 2 + 6; s < e.len / 2 - 4; s += 28 + rr.range(-4, 4)) {
        const x = e.x + e.tx * s + e.nx * 1.3, z = e.z + e.tz * s + e.nz * 1.3;
        if (rr.chance(0.18)) {
          // fallen post lying across the road
          b.cyl('metal', [x, 0.12, z], [x + e.nx * 6.5, 0.12, z + e.nz * 6.5], 0.09, tint('#5a5e5a', 1));
        } else {
          b.cyl('metal', [x, 0, z], [x, 6.6, z], 0.09, tint('#5a5e5a', 1));
          b.cyl('metal', [x, 6.5, z], [x - e.nx * 1.2, 6.7, z - e.nz * 1.2], 0.06, tint('#5a5e5a', 1));
          b.box('glass', [x - e.nx * 1.3, 6.45, z - e.nz * 1.3], [0.55, 0.22, 0.3], [0, Math.atan2(-e.tz, e.tx), 0], tint('#4a5150', 1));
        }
      }
      // abandoned cars parked in the street
      for (let s = -e.len / 2 + 8; s < e.len / 2 - 6; s += 9) {
        if (!rr.chance(0.32)) continue;
        const off = rr.range(-1.5, 1.5);
        const x = e.x + e.tx * (s + off) + e.nx * rr.range(2.6, 3.0), z = e.z + e.tz * (s + off) + e.nz * rr.range(2.6, 3.0);
        car(b, rr.fork(`car${ei}${s | 0}`), x, z, Math.atan2(-e.tz, e.tx) + (rr.chance(0.08) ? Math.PI : 0));
      }
      // rubble spilled from damaged neighbours
      if (bk.kind === 'ruin' || rr.chance(0.1)) {
        for (let k = 0; k < 6; k++) {
          const s = rr.range(-e.len / 2, e.len / 2), off = rr.range(1.3, 4.5);
          const x = e.x + e.tx * s + e.nx * off, z = e.z + e.tz * s + e.nz * off;
          const sz = rr.range(0.3, 1.1);
          b.box('rubble', [x, sz * 0.2, z], [sz, sz * 0.4, sz * rr.range(0.7, 1.3)], [0, rr.range(0, 6.28), rr.range(-0.2, 0.2)], tint('#8b8880', rr.range(0.8, 1.05)));
        }
      }
    });
  }
  // corner gardens and street trees
  for (const bk of L.blocks) {
    const rr = r.fork(`garden${bk.id}`);
    if (!bk.inset) continue;
    const iw = bk.inset.w, ie = bk.inset.e, is = bk.inset.s, inn = bk.inset.n;
    const corners = [
      [-bk.w / 2 + iw / 2, -bk.d / 2 + is / 2],
      [bk.w / 2 - ie / 2, -bk.d / 2 + is / 2],
      [-bk.w / 2 + iw / 2, bk.d / 2 - inn / 2],
      [bk.w / 2 - ie / 2, bk.d / 2 - inn / 2],
    ];
    for (const [lx, lz] of corners) {
      if (!rr.chance(0.7)) continue;
      const [x, z] = toWorld(bk.cx, bk.cz, bk.angle, lx, lz);
      if (rr.chance(0.6)) {
        b.push(M([x, SIDEWALK_H, z], [0, rr.range(0, 6), 0]));
        tree(b, rr.fork('t'), { species: rr.weighted([['broad', 5], ['conifer', 2], ['dead', 2]]), height: rr.range(6, 11), trunk: rr.range(0.18, 0.3) });
        b.pop();
      }
      bush(b, rr, [x + rr.range(-1.5, 1.5), SIDEWALK_H, z + rr.range(-1.5, 1.5)], rr.range(0.9, 1.6));
    }
    // courtyard planting
    const n = 1 + rr.int(0, 3);
    for (let k = 0; k < n; k++) {
      const lx = rr.range(-bk.w / 2 + iw + 2, bk.w / 2 - ie - 2), lz = rr.range(-bk.d / 2 + is + 2, bk.d / 2 - inn - 2);
      const [x, z] = toWorld(bk.cx, bk.cz, bk.angle, lx, lz);
      if (rr.chance(0.5)) {
        b.push(M([x, SIDEWALK_H, z], [0, rr.range(0, 6), 0]));
        tree(b, rr.fork('c'), { species: rr.weighted([['broad', 4], ['dead', 2], ['conifer', 1]]), height: rr.range(5, 9), trunk: rr.range(0.15, 0.25) });
        b.pop();
      } else bush(b, rr, [x, SIDEWALK_H, z], rr.range(1, 2));
    }
    for (let k = 0; k < 40; k++) {
      const lx = rr.range(-bk.w / 2 + iw, bk.w / 2 - ie), lz = rr.range(-bk.d / 2 + is, bk.d / 2 - inn);
      const [x, z] = toWorld(bk.cx, bk.cz, bk.angle, lx, lz);
      grassTuft(b, rr.fork(`g${k}`), x, SIDEWALK_H + 0.02, z, rr.range(0.25, 0.5));
    }
  }
  // parks: dense planting, benches, a broken fountain
  for (const bk of L.blocks) {
    if (bk.kind !== 'park') continue;
    const rr = r.fork(`park${bk.id}`);
    for (let k = 0; k < 9; k++) {
      const [x, z] = toWorld(bk.cx, bk.cz, bk.angle, rr.range(-bk.w / 2 + 2, bk.w / 2 - 2), rr.range(-bk.d / 2 + 2, bk.d / 2 - 2));
      b.push(M([x, SIDEWALK_H, z], [0, rr.range(0, 6), 0]));
      tree(b, rr.fork(`p${k}`), { species: rr.weighted([['broad', 5], ['conifer', 2], ['dead', 2]]), height: rr.range(6, 12), trunk: rr.range(0.2, 0.32) });
      b.pop();
    }
    for (let k = 0; k < 3; k++) {
      const [x, z] = toWorld(bk.cx, bk.cz, bk.angle, rr.range(-bk.w / 3, bk.w / 3), rr.range(-bk.d / 3, bk.d / 3));
      b.box('wood', [x, SIDEWALK_H + 0.25, z], [1.8, 0.08, 0.5], [0, bk.angle, 0], tint('#6b4f35', 1));
      b.box('metal', [x, SIDEWALK_H + 0.5, z - 0.25], [1.8, 0.45, 0.06], [0, bk.angle, 0], tint('#3c403d', 1));
    }
    if (rr.chance(0.5)) {
      const [x, z] = toWorld(bk.cx, bk.cz, bk.angle, 0, 0);
      b.cyl('stone', [x, SIDEWALK_H, z], [x, SIDEWALK_H + 0.5, z], 4.2, tint('#9a968c', 1));
      b.cyl('dirt', [x, SIDEWALK_H + 0.5, z], [x, SIDEWALK_H + 0.56, z], 3.6, tint('#3a4a2a', 1));
    }
  }
}
