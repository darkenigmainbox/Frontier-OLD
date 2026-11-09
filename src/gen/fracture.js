// Physically motivated crack growth (no Voronoi).
//
// A solid carries a 2D stress tensor field sigma(x,y). Every crack tip is a
// small particle that:
//   * advances perpendicular to the maximum principal TENSILE stress
//     (maximum-tangential-stress criterion, Erdogan & Sih 1963) — this is why
//     cracks radiate from impacts, bend around stress concentrations and run
//     parallel to load paths;
//   * arrests when the local driving stress drops below its own fracture
//     toughness (each tip draws its own toughness, so cracks stop irregularly);
//   * branches when the driving stress greatly exceeds toughness;
//   * stops when it meets an existing crack (crack coalescence).
// Sources are point impacts with a 1/r^2 stress field (Boussinesq-like:
// compressive radial, tensile hoop); the background field can be any function.

import { wrapPi, clamp } from './math.js';

/** Principal maximum stress and its direction for a symmetric 2D tensor. */
export function principal(sxx, syy, sxy) {
  const m = 0.5 * (sxx + syy);
  const R = Math.hypot(0.5 * (sxx - syy), sxy);
  return { s1: m + R, th: 0.5 * Math.atan2(2 * sxy, sxx - syy) };
}

/**
 * Stress tensor at (x,y).
 * sources:    [{x, y, amp, soft}] — amp sets reach: tensile hoop stress = 0.5*amp/r^2
 * background: (x,y) => [sxx, syy, sxy]  (optional)
 */
export function stressAt(sources, background, x, y) {
  let sxx = 0, syy = 0, sxy = 0;
  for (let k = 0; k < sources.length; k++) {
    const s = sources[k];
    const dx = x - s.x, dy = y - s.y;
    const r2 = dx * dx + dy * dy + s.soft * s.soft;
    const r = Math.sqrt(r2);
    const c = dx / r, sn = dy / r;
    const srr = -s.amp / r2;          // compressive radial
    const stt = 0.5 * s.amp / r2;     // tensile hoop
    sxx += srr * c * c + stt * sn * sn;
    syy += srr * sn * sn + stt * c * c;
    sxy += (srr - stt) * c * sn;
  }
  if (background) {
    const b = background(x, y);
    sxx += b[0]; syy += b[1]; sxy += b[2];
  }
  return [sxx, syy, sxy];
}

/**
 * Grow cracks.
 * @param o.rng       Rng
 * @param o.inside    (x,y) => bool   domain (crack stops on leaving)
 * @param o.sources   impact sources (see stressAt); each spawns `count` tips on a ring of radius r0
 * @param o.tips      explicit tips [{x,y,h,len,kc}] (background seeds)
 * @param o.background optional background stress field
 * @returns Array<{pts:[[x,y]...], gen:number, id:number}>
 */
export function growCracks(o) {
  const {
    rng, inside, sources = [], tips = [], background = null,
    stepLen = 0.5, maxLen = 10, maxGen = 3, branchP = 0.03,
    kc = 0.5, maxCracks = 300, maxSteps = 200000, joinDist = 0,
  } = o;
  const cell = Math.max(joinDist, 0.3);
  const cracks = [];
  const hash = new Map();
  const keyOf = (ix, iy) => ix * 73856093 ^ iy * 19349663;   // numeric hash key
  const insertPt = (x, y, id) => {
    const k = keyOf(Math.floor(x / cell), Math.floor(y / cell));
    let a = hash.get(k);
    if (!a) { a = []; hash.set(k, a); }
    a.push(x, y, id);
  };
  const nearOther = (x, y, id) => {
    if (!joinDist) return false;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const jd2 = joinDist * joinDist;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const a = hash.get(keyOf(cx + dx, cy + dy));
      if (!a) continue;
      for (let i = 0; i < a.length; i += 3) {
        if (a[i + 2] === id) continue;
        const ex = a[i] - x, ey = a[i + 1] - y;
        if (ex * ex + ey * ey < jd2) return true;
      }
    }
    return false;
  };
  const newCrack = (x, y, gen) => {
    const c = { pts: [[x, y]], gen, id: cracks.length };
    cracks.push(c);
    insertPt(x, y, c.id);
    return c;
  };

  const stack = [];
  for (const s of sources) {
    const n = s.count || 0;
    for (let k = 0; k < n; k++) {
      const th = (k / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const x = s.x + Math.cos(th) * s.r0, y = s.y + Math.sin(th) * s.r0;
      if (!inside(x, y)) continue;
      const c = newCrack(x, y, 0);
      stack.push({ x, y, h: th, gen: 0, crack: c, len: 0, maxLen: s.len || maxLen,
        kc: (s.kc || kc) * Math.exp(rng.gauss() * 0.2), fails: 0 });
    }
  }
  for (const t of tips) {
    if (!inside(t.x, t.y)) continue;
    const c = newCrack(t.x, t.y, 0);
    stack.push({ x: t.x, y: t.y, h: t.h, gen: 0, crack: c, len: 0, maxLen: t.len || maxLen,
      kc: (t.kc || kc) * Math.exp(rng.gauss() * 0.2), fails: 0 });
  }

  let steps = 0;
  function advance(tip) {
    const c = tip.crack;
    while (steps++ < maxSteps) {
      const [sxx, syy, sxy] = stressAt(sources, background, tip.x, tip.y);
      const pr = principal(sxx, syy, sxy);
      // Crack normal aligns with the max principal stress => crack runs along
      // the direction perpendicular to it. Pick the branch closest to heading.
      let d = wrapPi(pr.th + Math.PI / 2 - tip.h);
      if (d > Math.PI / 2) d -= Math.PI; else if (d < -Math.PI / 2) d += Math.PI;
      tip.h += clamp(d, -0.3, 0.3) + (rng.next() - 0.5) * 0.12;   // bounded turning + micro roughness

      if (pr.s1 < tip.kc) { if (++tip.fails > 3) return; } else tip.fails = 0;

      if (tip.gen < maxGen && pr.s1 > tip.kc * 2 && cracks.length < maxCracks && rng.next() < branchP) {
        const sgn = rng.chance(0.5) ? 1 : -1;
        const nc = newCrack(tip.x, tip.y, tip.gen + 1);
        stack.push({ x: tip.x, y: tip.y, h: tip.h + sgn * rng.range(0.5, 1.0), gen: tip.gen + 1,
          crack: nc, len: 0, maxLen: tip.maxLen * 0.6, kc: tip.kc * 1.15, fails: 0 });
      }

      const nx = tip.x + stepLen * Math.cos(tip.h), ny = tip.y + stepLen * Math.sin(tip.h);
      if (!inside(nx, ny)) return;
      if (nearOther(nx, ny, c.id)) { c.pts.push([nx, ny]); return; }
      tip.x = nx; tip.y = ny;
      c.pts.push([nx, ny]);
      insertPt(nx, ny, c.id);
      tip.len += stepLen;
      if (tip.len > tip.maxLen) return;
    }
  }
  while (stack.length && steps < maxSteps) advance(stack.pop());
  return cracks.filter((c) => c.pts.length >= 2);
}
