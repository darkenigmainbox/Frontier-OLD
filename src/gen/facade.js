// Facade builder: one wall plane with real openings (window styles), balconies
// with railings, fire escapes with stairs, stoops, shopfronts, pilasters,
// cornices, buttresses, porticos — and fracture: cracks are grown by the stress
// solver (fracture.js) and fragments/craters become actual holes in the wall.
import * as THREE from 'three';
import { M, mul, col, tint, UNIT_CYL } from './geom.js';
import { contours } from './contour.js';
import { growCracks } from './fracture.js';
import { pointInPoly } from './math.js';

export const WALL_DEPTH = 0.35;

/** Outline points (u,v) of an opening. `grow` expands it uniformly (for frames). */
export function openingPts(op, grow = 0) {
  const hw = op.w / 2 + grow, hh = op.h / 2 + grow;
  const cu = op.u, cv = op.v;
  const x0 = cu - hw, x1 = cu + hw, y0 = cv - hh, y1 = cv + hh;
  const pts = [];
  switch (op.shape) {
    case 'arch': {
      const r = Math.min(hw, y1 - y0 - 0.2);
      const cy = y1 - r;
      pts.push([x0, y0], [x1, y0], [x1, cy]);
      for (let k = 1; k <= 12; k++) {
        const a = (k / 12) * Math.PI;
        pts.push([cu + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      break;
    }
    case 'lancet': {
      const vs = Math.max(y0, y1 - hw * 1.1);
      pts.push([x0, y0], [x1, y0], [x1, vs], [cu + hw * 0.45, vs + (y1 - vs) * 0.7], [cu, y1],
        [cu - hw * 0.45, vs + (y1 - vs) * 0.7], [x0, vs]);
      break;
    }
    case 'round': {
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        pts.push([cu + hw * Math.cos(a), cv + hh * Math.sin(a)]);
      }
      break;
    }
    default:
      pts.push([x0, y0], [x1, y0], [x1, y1], [x0, y1]);
  }
  return pts;
}

function winDims(shape, bw, fh, r) {
  switch (shape) {
    case 'arch': { const w = bw * r.range(0.42, 0.55); return { w, h: Math.min(fh - 1.1, Math.max(w + 0.35, fh * 0.66)), dv: 0.75 }; }
    case 'lancet': { const w = Math.min(bw * 0.34, 1.3); return { w, h: Math.min(fh - 1.0, fh * 0.74), dv: 0.8 }; }
    case 'round': { const d = Math.min(bw * 0.42, fh * 0.42, 2.4); return { w: d, h: d, dv: (fh - d) / 2 }; }
    case 'ribbon': { const h = Math.max(0.7, Math.min(fh * 0.38, 1.3)); return { w: bw * 0.84, h, dv: fh * 0.42 }; }
    case 'curtain': return { w: bw * 0.92, h: fh * 0.84, dv: fh * 0.08 };
    case 'industrial': { const w = Math.min(bw * 0.3, 1.1); return { w, h: Math.min(fh * 0.66, 4.2), dv: fh * 0.16 }; }
    case 'slit': return { w: bw * 0.9, h: 0.9, dv: 0.55 };
    default: {
      const h = Math.min(fh - 1.3, Math.max(1.0, fh * r.range(0.5, 0.62)));
      return { w: bw * r.range(0.42, 0.56), h, dv: Math.min(0.95, (fh - h) * 0.55) + 0.2 };
    }
  }
}

const DEFAULT_GLASS = [['intact', 66], ['broken', 14], ['boarded', 11], ['void', 9]];

/**
 * Build one facade.
 * ctx: { r, noise, W, y0, top0, floors:[{y0,y1}], S (style), dmg, impacts:[{u,v,amp,R}],
 *        isStreet, face:{M}, wallColor, seedU }
 * Geometry is emitted into the builder with facade-local coordinates (u,v,d).
 * Returns { openings, topFn, holes }.
 */
export function buildFacade(b, ctx) {
  const { r, noise, W, y0, top0, floors, S, dmg, impacts, isStreet, face, wallColor } = ctx;
  const bayN = Math.max(1, Math.round(W / S.bayW));
  const bw = W / bayN;
  const shape = (S.openShapes && r.chance(0.35)) ? r.pick(S.openShapes) : S.openShape;
  const glassW = dmg === 0 ? DEFAULT_GLASS : [['intact', 45], ['broken', 30], ['boarded', 15], ['void', 10]];
  const seedU = r.range(0, 100);
  
  // ---- top profile (jagged after damage) ----
  const chipAmp = dmg === 0 ? 0 : r.range(0.15, 0.5);
  const drops = impacts.map((im) => ({ u: im.u, d: im.amp, w: r.range(1.5, 3.0) }));
  const topFn = (u) => {
    let t = top0;
    if (dmg > 0) {
      t -= chipAmp * (0.5 + 0.5 * noise(u * 0.9 + seedU, 3.1));
      for (const d of drops) t -= d.d * Math.exp(-(((u - d.u) / d.w) ** 2));
    }
    return Math.max(y0 + 0.6, t);
  };

  // ---- openings ----
  const openings = [];
  const doorBay = Math.floor(bayN / 2);
  for (let f = 0; f < floors.length; f++) {
    const fy0 = floors[f].y0, fy1 = floors[f].y1, fh = fy1 - fy0;
    if (f === 0 && isStreet && S.shopfront && bayN >= 2) {
      const doorU = bw * 0.5;
      openings.push({ shape: 'rect', u: doorU, v: fy0 + 1.15, w: Math.min(1.15, bw * 0.6), h: 2.3, kind: 'door', glass: 'door' });
      const u0 = bw * 1.0, u1 = W - 0.2;
      openings.push({ shape: 'rect', u: (u0 + u1) / 2, v: (fy0 + 0.35 + fy1 - 0.9) / 2, w: u1 - u0, h: fy1 - 0.9 - (fy0 + 0.35), kind: 'shop', glass: 'shop' });
      continue;
    }
    if (f === 0 && isStreet && S.rollerDoor) {
      const k = doorBay;
      const w = Math.min(bw * 1.9, W * 0.7), h = Math.min(fh * 0.8, 4.2);
      openings.push({ shape: 'rect', u: (k + 0.5) * bw, v: fy0 + h / 2 + 0.05, w, h, kind: 'gate', glass: 'slats' });
      continue;
    }
    for (let k = 0; k < bayN; k++) {
      const cu = (k + 0.5) * bw;
      if (f === 0 && isStreet && S.stoop && k === doorBay) {
        openings.push({ shape: 'rect', u: cu, v: fy0 + 1.1, w: Math.min(1.0, bw * 0.5), h: 2.2, kind: 'door', glass: 'door' });
        continue;
      }
      if (f === 0 && S.portico && isStreet) continue;   // columns stand in front of the wall
      if (r.chance(S.blindP || 0)) continue;
      const shp = (S.openShape === 'slit' || S.openShape === 'curtain') ? S.openShape : shape;
      const dm = winDims(shp, bw, fh, r);
      const v0 = Math.min(fy0 + dm.dv, fy1 - dm.h - 0.25);
      const op = {
        shape: shp, u: cu, v: v0 + dm.h / 2, w: dm.w, h: dm.h, kind: 'window',
        glass: r.weighted(dmg > 0 ? glassW : DEFAULT_GLASS),
        shutters: !!S.shutters && r.chance(0.55) && (shp === 'rect' || shp === 'arch'),
        mullion: shp === 'curtain' ? Math.max(1, Math.round(dm.w / 1.4)) : shp === 'ribbon' ? Math.max(1, Math.round(dm.w / 1.6)) : 1,
        floorBase: fy0,
      };
      openings.push(op);
    }
  }
  // drop openings that would poke through a damaged top edge
  const safe = openings.filter((op) => {
    const u0 = op.u - op.w / 2, u1 = op.u + op.w / 2;
    let minTop = Infinity;
    for (let s = 0; s <= 8; s++) minTop = Math.min(minTop, topFn(u0 + ((u1 - u0) * s) / 8));
    return op.v + op.h / 2 < minTop - 0.35;
  });
  openings.length = 0; openings.push(...safe);

  // ---- cracks: real stress-driven propagation on the wall plane ----
  const H = top0 - y0;
  const impactSrc = impacts.map((im) => ({ x: im.u, y: im.v, amp: 2 * 0.5 * im.R * im.R, soft: 0.2, r0: 0.35, count: 9, len: 6 }));
  const cornerSrc = [];
  for (const op of openings) {
    if (!(op.kind === 'window' || op.kind === 'shop') || !r.chance(0.5 * (S.crackiness ?? 0.5))) continue;
    const hw = op.w / 2, hh = op.h / 2;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      cornerSrc.push({ x: op.u + sx * hw, y: op.v + sy * hh, amp: 2 * 0.5 * 0.55 * 0.55, soft: 0.05, r0: 0.05, count: 2, len: 1.6 });
    }
  }
  const A = 0.2 + 0.7 * (S.crackiness ?? 0.5) + (dmg * 0.25);
  const s1 = r.range(0, 50), s2 = r.range(0, 50), s3 = r.range(0, 50);
  const bg = (u, v) => [
    A * noise(u * 0.32 + s1, v * 0.32),
    A * 0.6 * noise(u * 0.3 + s2, v * 0.3 + 5),
    A * 0.5 * noise(u * 0.28 + s3, v * 0.28 + 9),
  ];
  const tipCount = Math.round((S.crackiness ?? 0.5) * 4);
  const tips = [];
  for (let k = 0; k < tipCount; k++) {
    const u = r.range(0.3, W - 0.3), v = r.range(y0 + 0.5, top0 - 0.5);
    tips.push({ x: u, y: v, h: r.range(0, Math.PI * 2), len: r.range(2, 5) });
  }
  const insideWall = (u, v) => {
    if (u < 0.05 || u > W - 0.05 || v < y0 + 0.05 || v > topFn(u) - 0.05) return false;
    for (const op of openings) {
      if (Math.abs(u - op.u) < op.w / 2 + 0.08 && Math.abs(v - op.v) < op.h / 2 + 0.08) return false;
    }
    return true;
  };
  const cracks = growCracks({
    rng: r.fork('crack'), inside: insideWall,
    sources: [...impactSrc, ...cornerSrc], tips,
    background: bg, stepLen: 0.22, maxLen: 6, maxGen: 2, branchP: 0.02,
    kc: 0.5, maxCracks: 60, joinDist: 0.35, maxSteps: 40000,
  });

  // ---- holes: fragments that fall out + craters around impacts ----
  const holes = fractureHoles({
    W, y0, topFn, openings, cracks, impacts, cs: 0.16, noise, r,
    fallP: dmg === 0 ? 0 : dmg === 1 ? 0.3 : 0.65,
  });

  // ---- wall geometry (outline with real holes) ----
  const N = Math.max(4, Math.ceil(W / 0.25));
  const outline = [new THREE.Vector2(0, y0), new THREE.Vector2(W, y0)];
  for (let k = N; k >= 0; k--) {
    const u = (W * k) / N;
    outline.push(new THREE.Vector2(u, topFn(u)));
  }
  const shp2 = new THREE.Shape(outline);
  for (const op of openings) shp2.holes.push(new THREE.Path(openingPts(op).map(([u, v]) => new THREE.Vector2(u, v))));
  for (const h of holes) shp2.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
  const wallGeo = new THREE.ExtrudeGeometry(shp2, { depth: WALL_DEPTH, bevelEnabled: false, curveSegments: 4 });
  wallGeo.translate(0, 0, -WALL_DEPTH);
  b.geom(S.wall, wallGeo, null, tint(wallColor, 1));

  // ---- cracks as dark ribbons on the face ----
  const crackCol = [0.07, 0.06, 0.05];
  for (const c of cracks) {
    const widths = c.pts.map((_, i) => (c.gen === 0 ? 0.035 : 0.022) * (0.6 + 0.8 * Math.abs(Math.sin(i * 1.7 + c.id))));
    b.ribbon('crack', c.pts, widths, crackCol, 0.035);
  }

  // ---- window contents and frames ----
  for (const op of openings) drawOpening(b, op, S, r, dmg);

  // ---- decorations (only drawn on sound facades; damaged ones keep their wounds) ----
  const wc = tint(wallColor, 1.0);
  if (S.pilasters && bayN > 1) {
    for (let k = 1; k < bayN; k++) {
      b.box(S.wall, [k * bw, (y0 + top0) / 2, 0.12], [0.42, top0 - y0, 0.26], [0, 0, 0], wc);
      b.box(S.wall, [k * bw, top0 + 0.08, 0.16], [0.56, 0.2, 0.42], [0, 0, 0], wc);
    }
  }
  if (S.buttress) {
    for (let k = 0; k <= bayN; k++) {
      b.box('stone', [k * bw, (y0 + top0 * 0.75) / 2, 0.6], [0.9, top0 * 0.75 - y0, 1.2], [0, 0, 0], tint(S.trim, 1));
      b.box('stone', [k * bw, top0 * 0.75 + 0.2, 0.6], [1.0, 0.5, 1.0], [0, 0, 0], tint(S.trim, 1));
    }
  }
  if (S.stringCourse) {
    for (let f = 1; f < floors.length; f++) {
      b.box('trim', [W / 2, floors[f].y0, 0.1], [W + 0.1, 0.16, 0.2], [0, 0, 0], tint(S.trim, 1));
    }
  }
  if (S.cornice && dmg === 0) {
    b.box('trim', [W / 2, top0 + 0.22, 0.24], [W + 0.4, 0.44, 0.5], [0, 0, 0], tint(S.trim, 1));
    for (let k = 0; k < bayN; k++) b.box('trim', [(k + 0.5) * bw, top0 - 0.08, 0.5], [0.2, 0.28, 0.3], [0, 0, 0], tint(S.trim, 1));
  }
  if (S.downpipe) {
    const top = dmg === 0 ? top0 : topFn(0.25);
    const bottom = y0 + 0.2;
    b.cyl('metal', [0.22, bottom, 0.14], [0.22, top, 0.14], 0.065, tint(S.metal, 0.8));
    for (let v = bottom + 3; v < top - 1; v += 3.2) b.box('metal', [0.22, v, 0.12], [0.16, 0.08, 0.16], [0, 0, 0], tint(S.metal, 0.9));
  }

  // balconies and fire escapes
  if (S.balcony && dmg < 2) {
    for (let f = 1; f < floors.length; f++) {
      for (let k = 0; k < bayN; k++) {
        if (!r.chance(S.balconyP)) continue;
        balcony(b, { cu: (k + 0.5) * bw, bwid: bw * 0.84, fy0: floors[f].y0, kind: S.balcony, S, r, dmg });
      }
    }
  }
  if (S.fireEscape && dmg < 2) {
    const cu = (bayN - 0.5) * bw;
    for (let f = 1; f < floors.length; f++) fireEscapeFlight(b, { cu, bw, fy0: floors[f - 1].y0 + (f === 1 ? 0.2 : 0), fy1: floors[f].y0, S, dir: f % 2 ? 1 : -1 });
    for (let f = 1; f < floors.length; f++) platform(b, { cu, bw, fy0: floors[f].y0, S });
  }
  if (S.stoop && isStreet && floors.length) {
    const doorU = (doorBay + 0.5) * bw;
    const n = 3;
    for (let i = 0; i < n; i++) {
      const top = -(i + 1) * (0.5 / n);
      const dc = 0.2 + 0.35 * i + 0.175;
      b.box('stone', [doorU, (top - 0.5) / 2, dc], [1.6, top + 0.5, 0.35], [0, 0, 0], tint(S.trim, 1));
    }
  }
  if (S.shopfront && isStreet && floors.length && dmg < 2) {
    const fy0 = floors[0].y0, fy1 = floors[0].y1;
    if (S.awning) {
      const ang = Math.atan2(0.5, 1.3);
      b.box('trim', [W * 0.5 + 0.2, fy1 - 0.65, 0.7], [W * 0.78, 0.05, 1.45], [ang, 0, 0], tint(S.awningColor, 1));
      for (const ux of [W * 0.12, W * 0.88]) {
        b.cyl('metal', [ux, fy1 - 0.35, 0.05], [ux, fy1 - 1.0, 1.25], 0.035, tint(S.metal, 0.8));
      }
    }
    if (S.signboard) {
      b.box('trim', [W * 0.5, fy1 - 0.2, 0.2], [W * 0.5, 0.6, 0.12], [0, 0, 0], tint(S.signboard, 1));
    }
  }
  if (S.portico && isStreet && floors.length && dmg < 2) {
    portico(b, { W, fy0: floors[0].y0, fy1: floors[0].y1, S, r });
  }
  return { openings, topFn, holes, cracks: cracks.length };
}

/** Frame, glass or fill for one opening, all in facade-local coordinates. */
function drawOpening(b, op, S, r, dmg) {
  const frameCol = tint(S.frame, 1);
  const pts = openingPts(op);
  // frame ring
  const outer = openingPts(op, 0.1), inner = openingPts(op, 0);
  const fshape = new THREE.Shape(outer.map(([u, v]) => new THREE.Vector2(u, v)));
  fshape.holes.push(new THREE.Path(inner.map(([u, v]) => new THREE.Vector2(u, v))));
  const fg = new THREE.ExtrudeGeometry(fshape, { depth: 0.12, bevelEnabled: false, curveSegments: 3 });
  fg.translate(0, 0, -0.14);
  b.geom('trim', fg, null, frameCol);
  // sill
  if (op.kind === 'window' && (op.shape === 'rect' || op.shape === 'arch' || op.shape === 'ribbon')) {
    b.box('trim', [op.u, op.v - op.h / 2 - 0.06, 0.1], [op.w + 0.3, 0.1, 0.24], [0, 0, 0], frameCol);
  }
  const glassTone = tint(S.glass, 0.7 + 0.5 * ((op.u * 7.3 + op.v * 3.1) % 1));
  const glassMat = 'glass';
  if (op.kind === 'door') {
    b.box('wood', [op.u, op.v, -0.1], [op.w * 0.92, op.h * 0.96, 0.08], [0, 0, 0], tint(S.door, 1));
    b.box('trim', [op.u, op.v + op.h * 0.2, -0.06], [op.w * 0.5, op.h * 0.25, 0.04], [0, 0, 0], tint(S.door, 0.8));
    return;
  }
  if (op.glass === 'slats') {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const v = op.v - op.h / 2 + 0.2 + (i * (op.h - 0.4)) / (n - 1);
      if (dmg > 0 && r.chance(0.2)) continue;
      b.box('metal', [op.u, v, -0.1], [op.w * 0.97, 0.17, 0.08], [0, 0, 0], tint(S.metal, 0.6));
    }
    return;
  }
  if (op.glass === 'void') return;                  // see straight into the dark interior
  if (op.glass === 'door' || op.glass === 'shop' || op.glass === 'intact') {
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v))), 2);
    g.translate(0, 0, -0.22);
    b.geom(glassMat, g, null, glassTone);
  }
  if (op.glass === 'broken') {
    // partial glazing: a few shards left in the frame
    const ng = 3 + Math.floor(r.next() * 3);
    for (let i = 0; i < ng; i++) {
      const a = r.range(0, Math.PI * 2);
      const cx = op.u + Math.cos(a) * op.w * 0.35, cy = op.v + Math.sin(a) * op.h * 0.35;
      const s = r.range(0.12, 0.28);
      b.tri(glassMat, [cx, cy, -0.22], [cx + s, cy + r.range(-0.1, 0.1), -0.22], [cx + r.range(-0.1, 0.1), cy + s, -0.22], glassTone);
    }
  }
  if (op.glass === 'boarded') {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const v = op.v - op.h / 2 + ((i + 0.5) * op.h) / n;
      const tilt = r.range(-0.12, 0.12);
      b.box('wood', [op.u, v, -0.12], [op.w + 0.12, 0.2, 0.05], [0, 0, tilt], tint(S.wood, r.range(0.75, 1.1)));
    }
  }
  // mullions / transoms
  const mc = frameCol;
  if (op.shape === 'rect' || op.shape === 'arch') {
    if (op.kind === 'window' && op.shape === 'rect' && !op.shutters) {
      b.box('trim', [op.u, op.v, -0.05], [0.07, op.h, 0.12], [0, 0, 0], mc);
      b.box('trim', [op.u, op.v, -0.05], [op.w, 0.07, 0.12], [0, 0, 0], mc);
    } else if (op.shape === 'arch') {
      b.box('trim', [op.u, op.v, -0.05], [0.07, op.h, 0.12], [0, 0, 0], mc);
    }
  }
  if (op.shape === 'round') {
    b.box('trim', [op.u, op.v, -0.05], [0.07, op.h, 0.12], [0, 0, 0], mc);
    b.box('trim', [op.u, op.v, -0.05], [op.w, 0.07, 0.12], [0, 0, 0], mc);
  }
  if (op.shape === 'ribbon' || op.shape === 'curtain') {
    for (let i = 1; i < op.mullion; i++) {
      const u = op.u - op.w / 2 + (i * op.w) / op.mullion;
      b.box('trim', [u, op.v, -0.05], [0.07, op.h, 0.12], [0, 0, 0], mc);
    }
  }
  if (op.shape === 'industrial') {
    for (let i = 1; i < 4; i++) {
      const v = op.v - op.h / 2 + (i * op.h) / 4;
      b.box('trim', [op.u, v, -0.05], [op.w, 0.06, 0.12], [0, 0, 0], mc);
    }
  }
  if (op.shutters) {
    for (const sx of [-1, 1]) {
      b.box('wood', [op.u + sx * (op.w / 2 + 0.22), op.v, 0.05], [0.4, op.h * 0.96, 0.05], [0, 0, sx * 0.04], tint(S.shutter, r.range(0.85, 1.1)));
    }
  }
}

function balcony(b, { cu, bwid, fy0, kind, S, r, dmg }) {
  const depth = 1.05;
  b.box('concrete', [cu, fy0 + 0.06, depth / 2], [bwid, 0.14, depth], [0, 0, 0], tint(S.wallTint, 1));
  if (kind === 'solid') {
    b.box('concrete', [cu, fy0 + 0.56, depth - 0.06], [bwid, 0.95, 0.14], [0, 0, 0], tint(S.wallTint, 1.05));
    b.box('concrete', [cu, fy0 + 1.04, depth - 0.02], [bwid + 0.06, 0.08, 0.2], [0, 0, 0], tint(S.trim, 1));
    return;
  }
  const bucket = kind === 'wood' ? 'wood' : 'metal';
  const mcol = kind === 'wood' ? tint(S.wood, 1) : tint(S.metal, 0.9);
  b.box(bucket, [cu, fy0 + 1.0, depth - 0.02], [bwid, 0.05, 0.05], [0, 0, 0], mcol);
  b.box(bucket, [cu, fy0 + 0.12, depth - 0.02], [bwid, 0.04, 0.04], [0, 0, 0], mcol);
  const spacing = kind === 'wood' ? 0.2 : 0.16;
  const n = Math.max(3, Math.floor(bwid / spacing));
  const broken = dmg > 0 && r.chance(0.4);
  for (let i = 0; i < n; i++) {
    if (broken && r.chance(0.25)) continue;
    const x = cu - bwid / 2 + ((i + 0.5) * bwid) / n;
    b.box(bucket, [x, fy0 + 0.56, depth - 0.02], [0.03, 0.86, 0.03], [0, 0, 0], mcol);
  }
  for (const sx of [-1, 1]) {
    b.box(bucket, [cu + sx * bwid / 2, fy0 + 0.56, depth - 0.02], [0.05, 0.9, 0.05], [0, 0, 0], mcol);
    b.box(bucket, [cu + sx * bwid / 2, fy0 + 1.0, depth / 2], [0.05, 0.05, depth], [0, 0, 0], mcol);
  }
  if (broken) b.box('metal', [cu, fy0 + 0.6, depth * 0.5], [bwid * 0.5, 0.05, 0.3], [0.4, 0, 0], tint(S.metal, 0.5));
}

function fireEscapeFlight(b, { cu, bw, fy0, fy1, S, dir }) {
  const dx = bw * 0.82;
  const ps = [cu - (dir * dx) / 2, fy0 + 0.1];
  const pe = [cu + (dir * dx) / 2, fy1 - 0.02];
  const len = Math.hypot(pe[0] - ps[0], pe[1] - ps[1]);
  const ang = Math.atan2(pe[1] - ps[1], pe[0] - ps[0]);
  const mx = (ps[0] + pe[0]) / 2, my = (ps[1] + pe[1]) / 2;
  b.box('metal', [mx, my, 0.7], [len, 0.08, 0.7], [0, 0, ang], tint(S.metal, 0.85));
  // stringer rail on the outer side of the flight
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  b.box('metal', [mx + nx * 0.9, my + ny * 0.9, 1.1], [len, 0.05, 0.05], [0, 0, ang], tint(S.metal, 0.6));
}

function platform(b, { cu, bw, fy0, S }) {
  const w = bw * 0.9, d = 1.25;
  b.box('metal', [cu, fy0 + 0.03, d / 2], [w, 0.06, d], [0, 0, 0], tint(S.metal, 0.85));
  b.box('metal', [cu, fy0 + 1.0, d], [w, 0.05, 0.05], [0, 0, 0], tint(S.metal, 0.7));
  const n = Math.max(3, Math.floor(w / 0.2));
  for (let i = 0; i < n; i++) {
    const x = cu - w / 2 + ((i + 0.5) * w) / n;
    b.box('metal', [x, fy0 + 0.52, d], [0.03, 0.95, 0.03], [0, 0, 0], tint(S.metal, 0.7));
  }
  for (const sx of [-1, 1]) b.box('metal', [cu + sx * w / 2, fy0 + 0.52, d * 0.5], [0.05, 0.98, 0.05], [0, 0, 0], tint(S.metal, 0.6));
}

function portico(b, { W, fy0, fy1, S, r }) {
  const span = W * 0.8, n = 4;
  const u0 = W / 2 - span / 2;
  const h = fy1 - fy0 - 0.6;
  for (let i = 0; i <= n; i++) {
    const u = u0 + (i * span) / n;
    b.cyl('stone', [u, fy0, 1.2], [u, fy0 + h, 1.2], 0.28, tint(S.trim, 1));
    b.box('stone', [u, fy0 + 0.1, 1.2], [0.7, 0.2, 0.7], [0, 0, 0], tint(S.trim, 1));
    b.box('stone', [u, fy0 + h + 0.12, 1.2], [0.7, 0.24, 0.7], [0, 0, 0], tint(S.trim, 1));
  }
  b.box('stone', [W / 2, fy0 + h + 0.4, 1.35], [span + 0.6, 0.35, 2.4], [0, 0, 0], tint(S.trim, 0.95));
  const pl = [[u0 - 0.2, fy0 + h + 0.58, 1.2], [u0 + span + 0.2, fy0 + h + 0.58, 1.2], [W / 2, fy0 + h + 1.6, 1.2]];
  b.tri('stone', pl[0], pl[1], pl[2], tint(S.trim, 1), [0, 0, 1]);
  void r;
}

/**
 * Crack-bounded fragments + impact craters -> hole outlines (u,v).
 * Cracks are stamped onto a node grid as barriers; the regions they enclose are
 * fragments. Some fragments near an impact fall out; their outlines come from
 * marching squares, so they follow the actual crack paths.
 */
function fractureHoles({ W, y0, topFn, openings, cracks, impacts, cs, noise, r, fallP }) {
  if (!impacts.length && !cracks.length) return [];
  let yMax = y0;
  for (let k = 0; k <= 40; k++) yMax = Math.max(yMax, topFn((W * k) / 40));
  const nx = Math.ceil(W / cs) + 1, ny = Math.ceil((yMax - y0) / cs) + 1;
  const st = new Uint8Array(nx * ny);      // 0 free, 1 crack, 2 outside, 3 opening margin
  const idx = (i, j) => j * nx + i;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const u = i * cs, v = y0 + j * cs;
    let s = 0;
    if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1 || v > topFn(u)) s = 2;
    st[idx(i, j)] = s;
  }
  for (const op of openings) {
    const m = 2 * cs;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const u = i * cs, v = y0 + j * cs;
      if (Math.abs(u - op.u) < op.w / 2 + m && Math.abs(v - op.v) < op.h / 2 + m && st[idx(i, j)] === 0) st[idx(i, j)] = 3;
    }
  }
  for (const c of cracks) {
    for (let p = 0; p + 1 < c.pts.length; p++) {
      const [ax, ay] = c.pts[p], [bx, by] = c.pts[p + 1];
      const L = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.ceil(L / (cs * 0.5)));
      for (let s = 0; s <= n; s++) {
        const u = ax + ((bx - ax) * s) / n, v = ay + ((by - ay) * s) / n;
        const ci = Math.round(u / cs), cj = Math.round((v - y0) / cs);
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
          const du = i * cs - u, dv = y0 + j * cs - v;
          if (du * du + dv * dv <= (cs * 1.05) ** 2 && st[idx(i, j)] === 0) st[idx(i, j)] = 1;
        }
      }
    }
  }
  // Connected fragments made of free nodes.
  const comp = new Int32Array(nx * ny).fill(-1);
  const frags = [];
  const stack = [];
  for (let s0 = 0; s0 < nx * ny; s0++) {
    if (st[s0] !== 0 || comp[s0] >= 0) continue;
    const id = frags.length;
    const nodes = [];
    let edge = false;
    stack.push(s0); comp[s0] = id;
    while (stack.length) {
      const q = stack.pop();
      nodes.push(q);
      const i = q % nx, j = (q - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) { edge = true; continue; }
        const w = idx(ii, jj);
        if (st[w] === 2) edge = true;
        if (st[w] === 0 && comp[w] < 0) { comp[w] = id; stack.push(w); }
      }
    }
    frags.push({ id, nodes, edge, area: nodes.length * cs * cs });
  }
  // Which fragments fall: small, interior, close to an impact.
  const mask = new Uint8Array(nx * ny);
  for (const im of impacts) {
    const R = im.R;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const u = i * cs, v = y0 + j * cs;
      const du = u - im.u, dv = v - im.v;
      const rad = R * (0.75 + 0.5 * (noise(u * 1.3 + im.u, v * 1.3 + im.v) * 0.5 + 0.5));
      const q = idx(i, j);
      if (du * du + dv * dv < rad * rad && (st[q] === 0 || st[q] === 1)) mask[q] = 1;   // crater
    }
  }
  if (fallP > 0) {
    for (const f of frags) {
      if (f.edge || f.area < 0.2 || f.area > 3.5) continue;
      let near = false;
      for (const im of impacts) {
        const cx = f.nodes.reduce((a, q) => a + (q % nx), 0) / f.nodes.length * cs;
        const cy = y0 + (f.nodes.reduce((a, q) => a + Math.floor(q / nx), 0) / f.nodes.length) * cs;
        if (Math.hypot(cx - im.u, cy - im.v) < im.R * 1.6) { near = true; break; }
      }
      if (near && r.chance(fallP)) for (const q of f.nodes) mask[q] = 1;
    }
  }
  if (!mask.some((x) => x)) return [];
  const loops = contours(nx, ny, mask, 0.5, cs, 0, y0);
  // Accept only simple holes: no nesting, no swallowed openings.
  const ok = [];
  for (let a = 0; a < loops.length; a++) {
    const L = loops[a];
    let bad = false;
    for (let bI = 0; bI < loops.length && !bad; bI++) {
      if (bI === a) continue;
      if (pointInPoly(loops[bI][0][0], loops[bI][0][1], L) || pointInPoly(L[0][0], L[0][1], loops[bI])) bad = true;
    }
    for (const op of openings) if (pointInPoly(op.u, op.v, L)) bad = true;
    if (!bad) ok.push(L);
  }
  return ok;
}
