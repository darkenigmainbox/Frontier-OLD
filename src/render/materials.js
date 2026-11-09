// Procedural canvas textures + materials for every geometry bucket.
// Textures are grey-scale detail maps; per-building colour comes from vertex colours.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, rng(size * 7 + c.width));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;   // detail maps are linear-ish greys
  t.anisotropy = 8;
  return t;
}

const grey = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;

function speckle(g, r, size, n, minV, maxV) {
  for (let i = 0; i < n; i++) {
    const v = minV + r() * (maxV - minV);
    g.fillStyle = grey(v);
    g.fillRect(r() * size, r() * size, 1 + r() * 3, 1 + r() * 3);
  }
}

const TEX = {
  brick: { tile: 2.4, draw(g, S, r) {
    g.fillStyle = grey(190); g.fillRect(0, 0, S, S);
    const rows = 32, bh = S / rows, bw = S / 11;
    for (let row = 0; row < rows; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < S + bw; x += bw) {
        const v = 150 + r() * 60;
        g.fillStyle = grey(v);
        g.fillRect(x + off + 2, row * bh + 2, bw - 4, bh - 4);
        if (r() < 0.25) { g.fillStyle = grey(v - 40); g.fillRect(x + off + r() * bw, row * bh + r() * bh, 6, 3); }
      }
    }
    speckle(g, r, S, 900, 80, 230);
  } },
  plaster: { tile: 3.0, draw(g, S, r) {
    g.fillStyle = grey(205); g.fillRect(0, 0, S, S);
    speckle(g, r, S, 5000, 150, 235);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,80,60,${0.05 + r() * 0.08})`; g.fillRect(r() * S, r() * S, 2 + r() * 40, 2 + r() * 120); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,40,30,0.12)'; g.fillRect(r() * S, 0, 1 + r() * 2, S); }
  } },
  stone: { tile: 3.0, draw(g, S, r) {
    g.fillStyle = grey(200); g.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const h = S / 5 * (0.7 + r() * 0.6);
      let x = -r() * S / 3;
      while (x < S) {
        const w = S / 3 * (0.6 + r() * 0.9);
        g.fillStyle = grey(165 + r() * 55);
        g.fillRect(x + 2, y + 2, w - 4, h - 4);
        x += w;
      }
      y += h;
    }
    speckle(g, r, S, 2500, 110, 240);
  } },
  concrete: { tile: 4.0, draw(g, S, r) {
    g.fillStyle = grey(200); g.fillRect(0, 0, S, S);
    speckle(g, r, S, 7000, 120, 240);
    g.strokeStyle = 'rgba(60,60,55,0.35)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * S / 4, 0); g.lineTo(i * S / 4, S); g.stroke(); g.beginPath(); g.moveTo(0, i * S / 4); g.lineTo(S, i * S / 4); g.stroke(); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(30,30,28,0.25)'; g.beginPath(); g.arc(r() * S, r() * S, 1 + r() * 2.5, 0, 7); g.fill(); }
  } },
  metal: { tile: 1.2, draw(g, S, r) {
    for (let x = 0; x < S; x += S / 12) {
      const v = 170 + r() * 40;
      const grd = g.createLinearGradient(x, 0, x + S / 12, 0);
      grd.addColorStop(0, grey(v - 40)); grd.addColorStop(0.5, grey(v + 30)); grd.addColorStop(1, grey(v - 40));
      g.fillStyle = grd; g.fillRect(x, 0, S / 12, S);
    }
    for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(120,60,30,${0.1 + r() * 0.25})`; g.beginPath(); g.arc(r() * S, r() * S, 4 + r() * 22, 0, 7); g.fill(); }
  } },
  wood: { tile: 2.0, draw(g, S, r) {
    const rows = 14, h = S / rows;
    for (let i = 0; i < rows; i++) {
      g.fillStyle = grey(150 + r() * 60); g.fillRect(0, i * h, S, h);
      g.strokeStyle = 'rgba(40,25,10,0.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, i * h); g.lineTo(S, i * h); g.stroke();
      for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(50,30,15,${0.1 + r() * 0.2})`; g.beginPath(); g.moveTo(0, i * h + r() * h); g.bezierCurveTo(S / 3, i * h + r() * h, 2 * S / 3, i * h + r() * h, S, i * h + r() * h); g.stroke(); }
    }
  } },
  tile: { tile: 2.4, draw(g, S, r) {
    const n = 8, t = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = grey(200 + r() * 40); g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
    g.fillStyle = 'rgba(60,60,60,0.5)';
    for (let i = 0; i < n; i++) g.fillRect(i * t, 0, 2, S), g.fillRect(0, i * t, S, 2);
    speckle(g, r, S, 1200, 120, 220);
  } },
  roof: { tile: 2.0, draw(g, S, r) {
    g.fillStyle = grey(120); g.fillRect(0, 0, S, S);
    const rows = 22, h = S / rows, w = S / 10;
    for (let row = 0; row < rows; row++) for (let x = -w; x < S + w; x += w) {
      const off = row % 2 ? w / 2 : 0;
      g.fillStyle = grey(140 + r() * 70);
      g.beginPath(); g.ellipse(x + off + w / 2, row * h + h * 0.4, w * 0.48, h * 0.7, 0, 0, Math.PI); g.fill();
    }
    speckle(g, r, S, 800, 60, 200);
  } },
  asphalt: { tile: 6.0, draw(g, S, r) {
    g.fillStyle = grey(150); g.fillRect(0, 0, S, S);
    speckle(g, r, S, 9000, 90, 210);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(20,20,20,${0.1 + r() * 0.2})`; g.fillRect(r() * S, r() * S, 2 + r() * 6, 1 + r() * 2); }
  } },
  pavement: { tile: 6.0, draw(g, S, r) {
    g.fillStyle = grey(190); g.fillRect(0, 0, S, S);
    const n = 4, t = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = grey(170 + r() * 40); g.fillRect(i * t + 3, j * t + 3, t - 6, t - 6); }
    speckle(g, r, S, 2500, 110, 230);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,70,40,${0.1 + r() * 0.2})`; g.beginPath(); g.arc(r() * S, r() * S, 3 + r() * 14, 0, 7); g.fill(); }
  } },
  bark: { tile: 1.5, draw(g, S, r) {
    g.fillStyle = grey(120); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 180; i++) { g.strokeStyle = grey(60 + r() * 120); g.lineWidth = 1 + r() * 3; const x = r() * S; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 10, S); g.stroke(); }
  } },
};

export function createMaterials() {
  const tex = {};
  for (const [k, t] of Object.entries(TEX)) {
    const map = canvas(512, t.draw);
    map.repeat.set(1 / t.tile, 1 / t.tile);
    tex[k] = map;
  }
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...o });
  return {
    brick: std({ map: tex.brick, bumpMap: tex.brick, bumpScale: 2.5 }),
    plaster: std({ map: tex.plaster, bumpMap: tex.plaster, bumpScale: 0.6, roughness: 0.95 }),
    stone: std({ map: tex.stone, bumpMap: tex.stone, bumpScale: 1.5 }),
    concrete: std({ map: tex.concrete, bumpMap: tex.concrete, bumpScale: 1.2 }),
    metal: std({ map: tex.metal, bumpMap: tex.metal, bumpScale: 0.8, roughness: 0.6, metalness: 0.35 }),
    wood: std({ map: tex.wood, bumpMap: tex.wood, bumpScale: 0.8, roughness: 0.85 }),
    tile: std({ map: tex.tile, bumpMap: tex.tile, bumpScale: 0.4, roughness: 0.6 }),
    roof: std({ map: tex.roof, bumpMap: tex.roof, bumpScale: 3, roughness: 0.85 }),
    asphalt: std({ map: tex.asphalt, bumpMap: tex.asphalt, bumpScale: 1.2, roughness: 0.97 }),
    pavement: std({ map: tex.pavement, bumpMap: tex.pavement, bumpScale: 1.0, roughness: 0.95 }),
    rubble: std({ map: tex.concrete, bumpMap: tex.concrete, bumpScale: 2.0 }),
    trim: std({ roughness: 0.8 }),
    glass: std({ roughness: 0.15, metalness: 0.25, envMapIntensity: 0.6 }),
    interior: std({ roughness: 1 }),
    crack: std({ roughness: 1, side: THREE.DoubleSide }),
    foliage: std({ roughness: 0.95 }),
    leaf: std({ roughness: 0.8, side: THREE.DoubleSide }),
    vine: std({ roughness: 0.9, side: THREE.DoubleSide }),
    grass: std({ roughness: 1, side: THREE.DoubleSide }),
    dirt: std({ roughness: 1 }),
    bark: std({ map: tex.bark, bumpMap: tex.bark, bumpScale: 2, roughness: 1 }),
    _textures: tex,
  };
}
