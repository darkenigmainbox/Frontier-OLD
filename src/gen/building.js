// Assembles one planned building: volumes -> interior floors & stairs ->
// facades (with fracture) -> roofs -> plants -> ruin debris.
import * as THREE from 'three';
import { M, tint, UNIT_CONE, UNIT_DOME, cross } from './geom.js';
import { buildFacade } from './facade.js';
import { vinesOnFacade, tree, bush } from './vegetation.js';
import { PLINTH } from './archetypes.js';

const PAD = 0.3;
const FACE_DEFS = {
  front: { n: [0, 0, -1], a: (v) => [v.x0, 0, v.z0], b: (v) => [v.x1, 0, v.z0] },
  back: { n: [0, 0, 1], a: (v) => [v.x0, 0, v.z1], b: (v) => [v.x1, 0, v.z1] },
  left: { n: [-1, 0, 0], a: (v) => [v.x0, 0, v.z0], b: (v) => [v.x0, 0, v.z1] },
  right: { n: [1, 0, 0], a: (v) => [v.x1, 0, v.z0], b: (v) => [v.x1, 0, v.z1] },
};
const Y = [0, 1, 0];

/** Facade frame in lot-local coordinates: facade (u,v,d) -> origin + u*U + v*Y + d*n. */
export function faceFrame(v, name) {
  const def = FACE_DEFS[name];
  const U = cross(Y, def.n);                       // right-handed, so the basis has det > 0
  const a = def.a(v), bq = def.b(v);
  const pa = a[0] * U[0] + a[2] * U[2], pb = bq[0] * U[0] + bq[2] * U[2];
  const origin = pa <= pb ? a : bq;
  const W = Math.hypot(bq[0] - a[0], bq[2] - a[2]);
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...U), new THREE.Vector3(0, 1, 0), new THREE.Vector3(...def.n));
  m.setPosition(origin[0], origin[1], origin[2]);
  return { M: m, W, n: def.n, U };
}

const FLOOR_BUCKETS = { wood: 'wood', tile: 'tile', concrete: 'concrete', stone: 'stone' };

export function buildBuilding(b, plan, noise, r) {
  const S = plan.style;
  const summary = { facades: [], vegetation: 0 };
  const floorTints = { wood: [0.9, 0.7, 0.5], tile: [0.92, 0.92, 0.9], concrete: [0.7, 0.7, 0.68], stone: [0.9, 0.86, 0.78] };

  plan.volumes.forEach((v, vi) => {
    const floors = v.bases.map((y0, k) => ({ y0, y1: k + 1 < v.bases.length ? v.bases[k + 1] : v.top }));

    // ---- interior floor slabs: each level has its own finish ----
    const inset = 0.32;
    for (let k = 0; k < floors.length; k++) {
      const fk = plan.floorStyles[(vi * 3 + k) % plan.floorStyles.length];
      const bk = FLOOR_BUCKETS[fk];
      const sx = v.x1 - v.x0 - 2 * inset, sz = v.z1 - v.z0 - 2 * inset;
      if (sx > 0.5 && sz > 0.5) {
        const yb = floors[k].y0;
        b.box(bk, [(v.x0 + v.x1) / 2, yb - 0.09, (v.z0 + v.z1) / 2], [sx, 0.18, sz], [0, 0, 0], tint(S.wallTint, 1.1, floorTints[fk]));
      }
    }
    // ---- interior stairs, visible through holes in damaged walls ----
    if (plan.damage > 0 && floors.length > 1 && v.z1 - v.z0 > 6) {
      for (let k = 0; k + 1 < floors.length; k++) {
        const y0 = floors[k].y0, y1 = floors[k + 1].y0, steps = 8;
        const rise = (y1 - y0) / steps, run = 0.3;
        const sx0 = v.x0 + 0.5, sz0 = v.z0 + 1.6;
        for (let s = 0; s < steps; s++) {
          // solid treads stack up from the floor, so the flight reads as stairs
          b.box('wood', [sx0 + 0.6, y0 + ((s + 1) * rise) / 2, sz0 + s * run], [1.2, (s + 1) * rise, run], [0, 0, 0], tint(S.door, 1.2));
        }
      }
    }

    // ---- facades ----
    for (const name of ['front', 'back', 'left', 'right']) {
      const fr = faceFrame(v, name);
      if (fr.W < 1.5) continue;
      const hit = plan.impacts.filter((im) => im.vol === vi && im.face === name);
      const impacts = hit.map((im) => ({
        u: im.uf * fr.W, v: v.y0 + im.vf * (v.top - v.y0), R: im.R, amp: im.amp,
      }));
      const fr2 = r.fork(`face${vi}${name}`);
      const wallColor = tint(S.wallTint, 0.9 + 0.2 * fr2.next());
      const isStreet = name === 'front' && v.z0 <= PAD + 0.01;
      b.push(fr.M);
      const res = buildFacade(b, {
        r: fr2, noise, W: fr.W, y0: v.y0, top0: v.top, floors, S, dmg: plan.damage,
        impacts, isStreet, face: fr, wallColor,
      });
      if (plan.vines > 0) {
        summary.vegetation += vinesOnFacade(b, fr2.fork('vine'), noise, {
          W: fr.W, y0: v.y0, top: res.topFn, openings: res.openings,
        }, plan.vines);
      }
      b.pop();
      summary.facades.push({ name, W: fr.W, openings: res.openings.length, cracks: res.cracks, holes: res.holes.length });
    }

    // ---- roof ----
    buildRoof(b, plan, v, S, r.fork(`roof${vi}`));

    // ---- pilotis columns below a raised volume ----
    if (v.pilotis) {
      const cols = [[v.x0 + 0.7, v.z0 + 0.7], [v.x1 - 0.7, v.z0 + 0.7], [v.x0 + 0.7, v.z1 - 0.7], [v.x1 - 0.7, v.z1 - 0.7],
        [(v.x0 + v.x1) / 2, v.z0 + 0.7], [(v.x0 + v.x1) / 2, v.z1 - 0.7]];
      for (const [cx, cz] of cols) b.cyl('concrete', [cx, -PLINTH, cz], [cx, v.y0, cz], 0.32, tint(S.wallTint, 0.95));
    }
  });

  // ---- ruin: collapsed heaps and exposed rebar ----
  if (plan.damage === 2) {
    const lw = plan.lot.lw, ld = plan.lot.ld;
    const n = 26 + r.int(0, 18);
    for (let i = 0; i < n; i++) {
      const x = r.range(-lw / 2 + 0.5, lw / 2 - 0.5), z = r.range(0.5, ld - 0.5);
      const s = r.range(0.25, 1.2);
      const h = s * r.range(0.3, 0.8);
      b.box('rubble', [x, h / 2 - PLINTH + 0.0, z], [s, h, s * r.range(0.6, 1.3)], [r.range(-0.3, 0.3), r.range(0, 6.28), r.range(-0.3, 0.3)],
        tint(S.wallTint, r.range(0.7, 1.0)));
    }
    for (let i = 0; i < 6; i++) {
      const x = r.range(-lw / 2 + 1, lw / 2 - 1), z = r.range(1, ld - 1);
      const top = r.range(2, 6);
      b.cyl('metal', [x, 0, z], [x + r.range(-0.4, 0.4), top, z + r.range(-0.4, 0.4)], 0.025, tint(S.metal, 0.6));
    }
  }
  return summary;
}

function roofPrism(b, name, prof, t0, t1, axis, c) {
  // prof: [[s,y],...] cross-section (s across the building), extruded along `axis`
  const P = (t, s, y) => (axis === 'x' ? [t, y, s] : [s, y, t]);
  for (let i = 0; i < prof.length - 1; i++) {
    const [s0, y0] = prof[i], [s1, y1] = prof[i + 1];
    const dS = s1 - s0, dY = y1 - y0;
    const nS = -dY, nY = dS;
    const l = Math.hypot(nS, nY) || 1;
    const hint = axis === 'x' ? [0, nY / l, nS / l] : [nS / l, nY / l, 0];
    b.quad(name, P(t0, s0, y0), P(t1, s0, y0), P(t1, s1, y1), P(t0, s1, y1), c, hint);
  }
  const ends = [[t0, axis === 'x' ? [-1, 0, 0] : [0, 0, -1]], [t1, axis === 'x' ? [1, 0, 0] : [0, 0, 1]]];
  for (const [t, hint] of ends) {
    const pts = prof.map(([s, y]) => P(t, s, y));
    for (let k = 1; k < pts.length - 1; k++) b.tri(name, pts[0], pts[k], pts[k + 1], c, hint);
  }
}

function buildRoof(b, plan, v, S, r) {
  if (v.roof === 'none') return;
  const cx = (v.x0 + v.x1) / 2, cz = (v.z0 + v.z1) / 2;
  const W = v.x1 - v.x0, D = v.z1 - v.z0, top = v.top;
  const rc = tint(S.roofTint, 1);
  switch (v.roof) {
    case 'flat': {
      b.box('concrete', [cx, top + 0.13, cz], [W + 0.2, 0.26, D + 0.2], [0, 0, 0], tint(S.wallTint, 1.05));
      if (plan.damage < 2) {
        // parapet, with some sections knocked out
        const parapets = [
          [cx, top + 0.5, v.z0 - 0.02, W, 0.22], [cx, top + 0.5, v.z1 + 0.02, W, 0.22],
        ];
        for (const [x, y, z, len] of parapets) {
          if (r.chance(0.2)) continue;
          b.box('concrete', [x, y, z], [len, 0.95, 0.22], [0, 0, 0], tint(S.wallTint, 1.0));
        }
        b.box('concrete', [v.x0 - 0.02, top + 0.5, cz], [0.22, 0.95, D], [0, 0, 0], tint(S.wallTint, 1.0));
        if (r.chance(0.8)) b.box('concrete', [v.x1 + 0.02, top + 0.5, cz], [0.22, 0.95, D], [0, 0, 0], tint(S.wallTint, 1.0));
      }
      if (v.water) {
        const tx = cx + W * 0.2, tz = cz - D * 0.15;
        for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
          b.cyl('metal', [tx + lx, top, tz + lz], [tx + lx, top + 1.6, tz + lz], 0.07, tint(S.metal, 0.8));
        }
        b.cyl('metal', [tx, top + 1.6, tz], [tx, top + 3.2, tz], 1.2, tint(S.metal, 0.9));
        b.geom('metal', UNIT_CONE, M([tx, top + 3.7, tz], [0, 0, 0], [1.25, 0.9, 1.25]), tint(S.metal, 0.7));
      }
      const acN = r.int(0, 2);
      for (let i = 0; i < acN; i++) {
        b.box('metal', [r.range(v.x0 + 1, v.x1 - 1), top + 0.6, r.range(v.z0 + 1, v.z1 - 1)], [1.3, 0.9, 1.0], [0, 0, 0], tint(S.metal, 0.9));
      }
      if (r.chance(0.35)) b.cyl('metal', [v.x1 - 1, top, v.z0 + 1.5], [v.x1 - 1, top + 5, v.z0 + 1.5], 0.03, tint(S.metal, 0.6));
      break;
    }
    case 'pitch': {
      const rise = v.roofRise || Math.min(W, D) * 0.4;
      const along = W >= D ? 'x' : 'z';
      const half = along === 'x' ? D : W;
      const prof = [[-half / 2 - 0.3, top], [0, top + rise], [half / 2 + 0.3, top]]
        .map(([s, y]) => [s + (along === 'x' ? cz : cx), y]);
      const t0 = along === 'x' ? v.x0 - 0.3 : v.z0 - 0.3, t1 = along === 'x' ? v.x1 + 0.3 : v.z1 + 0.3;
      roofPrism(b, 'roof', prof, t0, t1, along, rc);
      if (plan.archetype === 'rowhouse' || r.chance(0.5)) {
        const chX = v.x1 - 1.0, chZ = cz - D * 0.2;
        b.box('brick', [chX, top + rise * 0.7, chZ], [0.7, rise * 1.4, 0.7], [0, 0, 0], tint(S.wallTint, 1));
        b.box('brick', [chX, top + rise * 1.4 + 0.1, chZ], [0.9, 0.2, 0.9], [0, 0, 0], tint(S.trim, 1));
      }
      break;
    }
    case 'dome': {
      const R = Math.min(W, D) * 0.36;
      b.cyl('stone', [cx, top, cz], [cx, top + 1.4, cz], R * 1.05, tint(S.trim, 1));
      b.geom('metal', UNIT_DOME, M([cx, top + 1.4, cz], [0, 0, 0], [R, R * 0.95, R]), tint('#5f8a7a', 1));
      b.cyl('metal', [cx, top + 1.4 + R * 0.95, cz], [cx, top + 1.4 + R * 1.45, cz], 0.12, tint(S.metal, 0.7));
      break;
    }
    case 'spire': {
      const h = 9 + r.range(0, 4), rad = Math.min(W, D) * 0.3;
      b.geom('stone', UNIT_CONE, M([cx, top + h / 2, cz], [0, Math.PI / 4, 0], [rad, h, rad]), tint(S.roofTint, 1.1));
      break;
    }
    case 'sawtooth': {
      const n = Math.max(2, Math.round(D / 4.6));
      const t = (D + 0.6) / n, hgt = 2.0;
      const z0 = v.z0 - 0.3;
      const x0 = v.x0 - 0.3, x1 = v.x1 + 0.3;
      const prof = [[z0, top]];
      for (let i = 0; i < n; i++) {
        const zs = z0 + i * t;
        prof.push([zs, top + hgt], [zs + t, top]);
      }
      for (let i = 0; i < prof.length - 1; i++) {
        const [s0, y0] = prof[i], [s1, y1] = prof[i + 1];
        const vertical = Math.abs(s1 - s0) < 1e-6;
        const dS = s1 - s0, dY = y1 - y0, l = Math.hypot(dS, dY) || 1;
        const hint = [0, dS / l, -dY / l];
        const pts = [[x0, y0, s0], [x1, y0, s0], [x1, y1, s1], [x0, y1, s1]];
        const bucket = vertical ? 'glass' : 'metal';
        const c = vertical ? tint(S.glass, 1.1) : tint(S.metal, 1);
        b.quad(bucket, pts[0], pts[1], pts[2], pts[3], c, hint);
      }
      break;
    }
    case 'mech': {
      b.box('concrete', [cx, top + 0.13, cz], [W + 0.2, 0.26, D + 0.2], [0, 0, 0], tint(S.wallTint, 1.05));
      b.box('glass', [cx, top + 1.5, cz], [W * 0.55, 2.8, D * 0.5], [0, 0, 0], tint(S.glass, 1.2));
      b.box('metal', [cx, top + 3.05, cz], [W * 0.6, 0.12, D * 0.55], [0, 0, 0], tint(S.metal, 0.8));
      break;
    }
    default:
      b.box('concrete', [cx, top + 0.13, cz], [W + 0.2, 0.26, D + 0.2], [0, 0, 0], tint(S.wallTint, 1.05));
  }
}

/** Plants that live on the building: roof shrubs, ruin trees and tree-in-courtyard. */
export function plantsForBuilding(b, plan, r) {
  let n = 0;
  if (plan.rooftopPlants) {
    const top = plan.volumes[plan.volumes.length - 1];
    if (top.roof === 'flat' || top.roof === 'none') {
      const cx = (top.x0 + top.x1) / 2, cz = (top.z0 + top.z1) / 2;
      for (let i = 0; i < 3; i++) {
        bush(b, r, [cx + r.range(-3, 3), top.top + 0.2, cz + r.range(-2, 2)], r.range(0.9, 1.6));
        n++;
      }
    }
  }
  if (plan.ruinTree) {
    const lw = plan.lot.lw, ld = plan.lot.ld;
    b.push(M([r.range(-lw / 4, lw / 4), 0, ld * 0.5], [0, r.range(0, 6), 0], [1, 1, 1]));
    tree(b, r.fork('rt'), { species: r.pick(['broad', 'broad', 'dead']), height: r.range(7, 11), trunk: 0.2 });
    b.pop();
    n++;
  }
  return n;
}
