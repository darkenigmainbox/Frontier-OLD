export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const wrapPi = (a) => {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
};

/** Signed area (shoelace). Positive = counter-clockwise. */
export function polyArea(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/** Even-odd point-in-polygon test. */
export function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Point-in-axis-aligned-rotated rect test in the rect's own frame. */
export function rotRectContains(cx, cz, angle, w, d, x, z) {
  const dx = x - cx, dz = z - cz;
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const lx = dx * c + dz * s;   // inverse of R_y(angle)
  const lz = -dx * s + dz * c;
  return Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2;
}
