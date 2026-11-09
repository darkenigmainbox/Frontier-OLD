// Geometry accumulation.
// Everything in the city is written into a small number of named "buckets"
// (one per material). Each bucket becomes one THREE.BufferGeometry, so the
// whole city renders with a few dozen draw calls. Vertex colours carry per-
// building tint; UVs are world-space (metres) so textures tile consistently.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
export const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false); // radius 1, height 1, along Y
export const UNIT_CONE = new THREE.ConeGeometry(1, 1, 8, 1);              // apex at +0.5
// Indexed sphere (IcosahedronGeometry is non-indexed and 3x larger for the same look).
export const UNIT_SPHERE = new THREE.SphereGeometry(1, 9, 7);
export const UNIT_DOME = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);

const _cache = new WeakMap();
/** Index a non-indexed geometry by merging identical vertices (cached per geometry). */
function mergeIdentical(g) {
  let m = _cache.get(g);
  if (!m) {
    m = mergeVertices(g.clone(), 1e-5);
    _cache.set(g, m);
  }
  return m;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _n = new THREE.Vector3(), _nm = new THREE.Matrix3();

/** Hex / CSS colour -> linear [r,g,b]. Arrays pass through. */
export function col(c) {
  if (Array.isArray(c)) return c;
  const k = new THREE.Color(c);
  return [k.r, k.g, k.b];
}
/** Multiply a colour by a scalar (and optional per-channel tint). */
export function tint(c, f, t = [1, 1, 1]) {
  const v = col(c);
  return [v[0] * f * t[0], v[1] * f * t[1], v[2] * f * t[2]];
}

/** Matrix from position, Euler rotation [rx,ry,rz] and scale. */
export function M(p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(p[0], p[1], p[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])),
    new THREE.Vector3(s[0], s[1], s[2]),
  );
  return m;
}
export function mul(a, b) { return new THREE.Matrix4().multiplyMatrices(a, b); }
/** Basis matrix from three axis vectors (arrays) and an origin (array). */
export function basis(u, v, n, o) {
  const m = new THREE.Matrix4();
  m.makeBasis(new THREE.Vector3(...u), new THREE.Vector3(...v), new THREE.Vector3(...n));
  m.setPosition(o[0], o[1], o[2]);
  return m;
}
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export class Builder {
  constructor() {
    this.buckets = new Map();
    this.M = new THREE.Matrix4();     // current local -> world transform
    this._stack = [];
  }
  bucket(name) {
    let b = this.buckets.get(name);
    if (!b) { b = { p: [], n: [], uv: [], c: [], i: [], nv: 0 }; this.buckets.set(name, b); }
    return b;
  }
  /** Set the current transform (world base). Resets the stack. */
  setBase(m) { this.M = m.clone(); this._stack = []; }
  push(m) { this._stack.push(this.M); this.M = mul(this.M, m); }
  pop() { this.M = this._stack.pop(); }

  _emit(bk, a, n, c) {
    // a: world Vector3, n: world Vector3 (unit)
    bk.p.push(a.x, a.y, a.z);
    bk.n.push(n.x, n.y, n.z);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    if (ax >= ay && ax >= az) bk.uv.push(a.z, a.y);
    else if (ay >= az) bk.uv.push(a.x, a.z);
    else bk.uv.push(a.x, a.y);
    bk.c.push(c[0], c[1], c[2]);
  }

  /** Add a triangle given in current-local coordinates. Per-vertex colours optional. */
  tri(name, pa, pb, pc, c, hint = null) {
    const bk = this.bucket(name);
    const M = this.M;
    // `c` is either one [r,g,b] for the whole triangle or [[r,g,b],[r,g,b],[r,g,b]].
    const perVertex = Array.isArray(c[0]);
    let cA = perVertex ? c[0] : c, cB = perVertex ? c[1] : c, cC = perVertex ? c[2] : c;
    const A = _a.set(pa[0], pa[1], pa[2]).applyMatrix4(M);
    let B = _b.set(pb[0], pb[1], pb[2]).applyMatrix4(M);
    let C = _c.set(pc[0], pc[1], pc[2]).applyMatrix4(M);
    const N = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
    if (N.lengthSq() < 1e-14) return; // degenerate, skip
    N.normalize();
    if (hint) {
      const h = new THREE.Vector3(hint[0], hint[1], hint[2]).transformDirection(M);
      if (N.dot(h) < 0) {          // winding disagrees with the hint: flip it
        [B, C] = [C, B];
        [cB, cC] = [cC, cB];
        N.negate();
      }
    }
    const base = bk.nv;
    this._emit(bk, A, N, cA);
    this._emit(bk, B.clone(), N, cB);
    this._emit(bk, C.clone(), N, cC);
    bk.i.push(base, base + 1, base + 2);
    bk.nv += 3;
  }
  quad(name, a, b, c, d, col_, hint = null) {
    this.tri(name, a, b, c, col_, hint);
    this.tri(name, a, c, d, col_, hint);
  }

  /** Add an indexed or non-indexed THREE geometry under the current transform (optionally extra transform). */
  geom(name, g0, extra = null, c = [0.8, 0.8, 0.8]) {
    const g = g0.index ? g0 : mergeIdentical(g0);
    const M = extra ? mul(this.M, extra) : this.M;
    const bk = this.bucket(name);
    const pos = g.attributes.position, nor = g.attributes.normal;
    const idx = g.index;
    _nm.getNormalMatrix(M);
    const flip = M.determinant() < 0;
    const base = bk.nv, count = pos.count;
    for (let k = 0; k < count; k++) {
      _a.fromBufferAttribute(pos, k).applyMatrix4(M);
      _n.fromBufferAttribute(nor, k).applyMatrix3(_nm).normalize();
      this._emit(bk, _a, _n, c);
    }
    const triCount = idx ? idx.count : count;
    for (let k = 0; k < triCount; k += 3) {
      const i0 = idx ? idx.getX(k) : k, i1 = idx ? idx.getX(k + 1) : k + 1, i2 = idx ? idx.getX(k + 2) : k + 2;
      if (flip) bk.i.push(base + i0, base + i2, base + i1);
      else bk.i.push(base + i0, base + i1, base + i2);
    }
    bk.nv += count;
  }

  box(name, center, size, rot = [0, 0, 0], c = [0.8, 0.8, 0.8]) {
    this.geom(name, UNIT_BOX, M(center, rot, size), c);
  }
  /** Cylinder between two points (current-local coords). */
  cyl(name, p0, p1, radius, c = [0.8, 0.8, 0.8]) {
    const d = sub(p1, p0);
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-6) return;
    const dir = new THREE.Vector3(d[0] / len, d[1] / len, d[2] / len);
    const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2), q,
      new THREE.Vector3(radius, len, radius));
    this.geom(name, UNIT_CYL, m, c);
  }

  /**
   * Flat ribbon along a 2D polyline in the local XY plane (z = zoff).
   * Used for cracks, vine stems and similar thin features.
   */
  ribbon(name, pts, widths, c, zoff = 0) {
    const n = pts.length;
    if (n < 2) return;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], pa = pts[Math.max(i - 1, 0)], pb = pts[Math.min(i + 1, n - 1)];
      let tx = pb[0] - pa[0], ty = pb[1] - pa[1];
      const len = Math.hypot(tx, ty) || 1;
      tx /= len; ty /= len;
      const w = (Array.isArray(widths) ? widths[i] : widths) / 2;
      const nx = -ty * w, ny = tx * w;
      L.push([p[0] + nx, p[1] + ny, zoff]);
      R.push([p[0] - nx, p[1] - ny, zoff]);
    }
    const hint = [0, 0, 1];
    for (let i = 0; i < n - 1; i++) {
      this.tri(name, L[i], R[i], R[i + 1], c, hint);
      this.tri(name, L[i], R[i + 1], L[i + 1], c, hint);
    }
  }

  /** Convex polygons with explicit outward hints: faces = [{pts:[[x,y,z]...], n:[nx,ny,nz]}] */
  poly(name, faces, c) {
    for (const f of faces) {
      const p = f.pts;
      for (let k = 1; k < p.length - 1; k++) this.tri(name, p[0], p[k], p[k + 1], c, f.n);
    }
  }

  /** Materialise all buckets into BufferGeometry objects. */
  finish() {
    const out = new Map();
    for (const [name, bk] of this.buckets) {
      if (!bk.nv) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(bk.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(bk.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(bk.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(bk.c, 3));
      g.setIndex(new THREE.Uint32BufferAttribute(bk.i, 1));
      g.computeBoundingSphere();
      out.set(name, g);
    }
    return out;
  }
  stats() {
    let verts = 0, tris = 0;
    for (const bk of this.buckets.values()) { verts += bk.nv; tris += bk.i.length / 3; }
    return { verts, tris, buckets: this.buckets.size };
  }
}
