// Deterministic, hierarchical random numbers.
// The same seed string always yields the same city. `fork(label)` derives an
// independent child stream, so every lot / facade / tree gets its own sequence
// and changing one building never reshuffles the others.

function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.seed = String(seed);
    const h = cyrb128(this.seed);
    this._f = sfc32(h[0], h[1], h[2], h[3]);
    for (let i = 0; i < 12; i++) this._f();
  }
  /** uniform in [0,1) */
  next() { return this._f(); }
  /** uniform in [a,b) */
  range(a, b) { return a + (b - a) * this.next(); }
  /** integer in [a,b] inclusive */
  int(a, b) { return Math.min(b, Math.floor(a + (b - a + 1) * this.next())); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  /** weighted pick; accepts [[value, weight], ...] or {value: weight} */
  weighted(entries) {
    const list = Array.isArray(entries) ? entries : Object.entries(entries);
    let total = 0;
    for (const [, w] of list) total += w;
    let t = this.next() * total;
    for (const [v, w] of list) { if ((t -= w) <= 0) return v; }
    return list[list.length - 1][0];
  }
  /** standard normal (Box-Muller) */
  gauss() {
    const u = Math.max(this.next(), 1e-12), v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  fork(label) { return new Rng(this.seed + '/' + label); }
}
