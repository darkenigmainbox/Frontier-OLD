// 2D gradient (Perlin-style) noise, seeded from an Rng.
export function makeNoise2D(rng) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = rng.next() * Math.PI * 2;
    gx[i] = Math.cos(a); gy[i] = Math.sin(a);
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const h00 = p[(p[X] + Y) & 255];
    const h10 = p[(p[(X + 1) & 255] + Y) & 255];
    const h01 = p[(p[X] + Y + 1) & 255];
    const h11 = p[(p[(X + 1) & 255] + Y + 1) & 255];
    const d00 = gx[h00] * xf + gy[h00] * yf;
    const d10 = gx[h10] * (xf - 1) + gy[h10] * yf;
    const d01 = gx[h01] * xf + gy[h01] * (yf - 1);
    const d11 = gx[h11] * (xf - 1) + gy[h11] * (yf - 1);
    const u = fade(xf), v = fade(yf);
    const a = d00 + (d10 - d00) * u;
    const b = d01 + (d11 - d01) * u;
    return a + (b - a) * v;
  }
  /** fractal sum, roughly in [-1,1] */
  noise.fbm = (x, y, oct = 4) => {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      s += amp * noise(x * f, y * f);
      norm += amp; amp *= 0.5; f *= 2.03;
    }
    return s / norm;
  };
  return noise;
}
