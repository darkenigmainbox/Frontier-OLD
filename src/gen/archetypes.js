// Building archetypes: each is a grammar over volumes (massing), floors,
// facade features and roof forms. Every building samples its own parameters,
// so no two plans match; `signature` lets tests verify that.
import * as THREE from 'three';

export const PLINTH = 0.5;         // plinth below the ground floor (stoops descend to the sidewalk)
const PAD = 0.3;                   // gap between neighbouring lots

const PALETTE = {
  brick:    ['#8a4b32', '#7a3f2b', '#a25d3c', '#6c4a3a', '#9a6a4d', '#8e3f2e'],
  plaster:  ['#c9bfa5', '#b9b2a0', '#d4c7a4', '#a8a089', '#c2b59a', '#9fb3a8', '#c7a48b'],
  concrete: ['#8c8c86', '#9a9a92', '#7f8178', '#a5a39b', '#77796f'],
  stone:    ['#b8b09a', '#c4b99f', '#a7a08c', '#d1c8b0', '#968f7d'],
  metal:    ['#5d6361', '#6a5141', '#4b5552', '#7a7a74'],
};
const TRIM = ['#e0dccb', '#d8d5c9', '#5b5f5a', '#c8bfa8', '#3a3d3b', '#b8b4a4'];
const FRAME = ['#f2efe4', '#7a6a55', '#3c4a3f', '#2f2f2f', '#b9b4a3', '#50584f'];
const GLASS = ['#2b3a40', '#1f2a2f', '#3b4a45', '#25303a', '#4a5350', '#2e3b3b'];
const DOOR = ['#4b3323', '#2c4a3a', '#5a2d22', '#384656', '#6b4a2a'];
const WOOD = ['#7a5a3c', '#8a7a62', '#66503a', '#9a8464'];
const SHUTTER = ['#2d4b3c', '#5b2a24', '#2d3a4f', '#6a6c55', '#7a6d4c'];
const AWNING = ['#8a2c26', '#2f5e4f', '#a7812a', '#4a4f6d', '#6e6e5c', '#7b3b2e'];
const SIGN = ['#2f3b3a', '#6e2a24', '#d9c58b', '#243a5a', '#e9e2cf'];
const ROOF = ['#5d4a3c', '#6b4a3a', '#3d4448', '#8a5a44', '#4c5450', '#7a6e62'];
const GREY = '#6e6d69';

const ARCH = {
  apartment: {
    label: 'Apartment block', floors: [4, 8], fh: [2.9, 3.3], gH: [3.2, 3.8], bayW: [3.0, 4.0],
    walls: [['brick', 3], ['plaster', 3], ['concrete', 2]],
    roofs: [['flat', 3], ['water', 2], ['pitch', 1]],
    shapes: ['rect', 'rect', 'arch', 'ribbon'], balcony: [['iron', 3], ['solid', 2], ['wood', 1]],
    balconyP: [0.3, 0.85], fire: 0.5, cornice: 0.7, pilasters: 0.25, string: 0.6, downpipe: 0.7,
    shutters: 0.3, stoop: 0.25, wing: 0.45, blind: [0, 0.12], crack: [0.3, 0.8], vines: [0.2, 0.8],
    shop: 0.12, awning: 0, portico: 0, buttress: 0, rollerDoor: 0,
  },
  rowhouse: {
    label: 'Terraced house', floors: [2, 4], fh: [2.7, 3.1], gH: [3.0, 3.4], bayW: [3.2, 4.2],
    walls: [['brick', 4], ['plaster', 3]], roofs: [['pitch', 1]],
    shapes: ['rect', 'rect', 'arch'], balcony: [['iron', 1]], balconyP: [0, 0.1], fire: 0, cornice: 0.5,
    pilasters: 0.1, string: 0.5, downpipe: 0.8, shutters: 0.6, stoop: 0.85, wing: 0, blind: [0, 0.1],
    crack: [0.3, 0.9], vines: [0.4, 1.0], shop: 0, awning: 0, portico: 0, buttress: 0, rollerDoor: 0,
  },
  shopfront: {
    label: 'Shopfront block', floors: [2, 3], fh: [3.0, 3.4], gH: [4.0, 4.6], bayW: [3.4, 4.8],
    walls: [['brick', 3], ['plaster', 3], ['stone', 2]], roofs: [['flat', 2], ['pitch', 2]],
    shapes: ['rect', 'arch'], balcony: [['iron', 1]], balconyP: [0, 0.2], fire: 0.2, cornice: 0.7,
    pilasters: 0.6, string: 0.5, downpipe: 0.6, shutters: 0.2, stoop: 0, wing: 0, blind: [0, 0.15],
    crack: [0.4, 0.9], vines: [0.1, 0.6], shop: 1, awning: 0.75, portico: 0, buttress: 0, rollerDoor: 0,
  },
  office: {
    label: 'Office tower', floors: [9, 15], fh: [3.5, 3.9], gH: [4.4, 4.8], bayW: [1.9, 2.6],
    walls: [['concrete', 5], ['stone', 1]], roofs: [['mech', 3], ['flat', 2]],
    shapes: ['curtain', 'ribbon'], balcony: [['solid', 1]], balconyP: [0, 0], fire: 0, cornice: 0.2,
    pilasters: 0.1, string: 0.9, downpipe: 0.3, shutters: 0, stoop: 0, wing: 0, blind: [0, 0.05],
    crack: [0.5, 1.0], vines: [0.0, 0.3], shop: 0.3, awning: 0, portico: 0, buttress: 0, rollerDoor: 0,
  },
  civic: {
    label: 'Civic hall', floors: [2, 3], fh: [4.0, 4.6], gH: [4.8, 5.4], bayW: [3.6, 5.0],
    walls: [['stone', 6], ['plaster', 1]], roofs: [['dome', 2], ['pitch', 1]],
    shapes: ['arch', 'rect'], balcony: [['solid', 1]], balconyP: [0, 0.2], fire: 0, cornice: 0.9,
    pilasters: 0.8, string: 0.6, downpipe: 0.4, shutters: 0, stoop: 0, wing: 0, blind: [0, 0.05],
    crack: [0.4, 0.9], vines: [0.1, 0.5], shop: 0, awning: 0, portico: 0.8, buttress: 0, rollerDoor: 0,
  },
  gothic: {
    label: 'Gothic church', floors: [2, 2], fh: [6.0, 7.0], gH: [6.0, 7.0], bayW: [4.0, 5.2],
    walls: [['stone', 8], ['concrete', 1]], roofs: [['pitch', 1]],
    shapes: ['lancet', 'lancet', 'round'], balcony: [], balconyP: [0, 0], fire: 0, cornice: 0.2,
    pilasters: 0, string: 0.4, downpipe: 0.5, shutters: 0, stoop: 0, wing: 0, blind: [0, 0.1],
    crack: [0.6, 1.0], vines: [0.3, 1.0], shop: 0, awning: 0, portico: 0.3, buttress: 1, rollerDoor: 0,
  },
  industrial: {
    label: 'Industrial hall', floors: [1, 1], fh: [3.0, 3.2], gH: [7.5, 10.0], bayW: [5.0, 7.0],
    walls: [['concrete', 4], ['metal', 3], ['brick', 2]], roofs: [['sawtooth', 1]],
    shapes: ['industrial', 'slit'], balcony: [], balconyP: [0, 0], fire: 0, cornice: 0.1,
    pilasters: 0.3, string: 0.2, downpipe: 0.9, shutters: 0, stoop: 0, wing: 1, blind: [0.1, 0.4],
    crack: [0.6, 1.0], vines: [0.2, 0.9], shop: 0, awning: 0, portico: 0, buttress: 0, rollerDoor: 0.8,
  },
  modernist: {
    label: 'Modernist block', floors: [5, 8], fh: [3.1, 3.5], gH: [3.3, 3.5], bayW: [3.5, 4.6],
    walls: [['concrete', 6], ['plaster', 1]], roofs: [['flat', 1]],
    shapes: ['ribbon', 'slit'], balcony: [['solid', 1]], balconyP: [0.5, 0.9], fire: 0, cornice: 0.2,
    pilasters: 0, string: 0.9, downpipe: 0.5, shutters: 0, stoop: 0, wing: 0, blind: [0, 0.1],
    crack: [0.5, 1.0], vines: [0.1, 0.7], shop: 0, awning: 0, portico: 0, buttress: 0, rollerDoor: 0,
    pilotis: 0.8,
  },
  parkade: {
    label: 'Car park', floors: [4, 7], fh: [3.3, 3.6], gH: [3.5, 3.8], bayW: [6.0, 8.0],
    walls: [['concrete', 6], ['metal', 1]], roofs: [['flat', 1]],
    shapes: ['slit'], balcony: [['solid', 1]], balconyP: [1, 1], fire: 0, cornice: 0,
    pilasters: 0, string: 0.8, downpipe: 0.7, shutters: 0, stoop: 0, wing: 0, blind: [0, 0],
    crack: [0.6, 1.0], vines: [0.3, 1.0], shop: 0, awning: 0, portico: 0, buttress: 0, rollerDoor: 0,
  },
};

const rr = (r, v) => (Array.isArray(v) ? r.range(v[0], v[1]) : v);
const rint = (r, v) => (Array.isArray(v) ? r.int(v[0], v[1]) : v);
const chance = (r, p) => r.chance(rr(r, p));
const mixHex = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

/** Describe the building in a compact, comparable form (used by tests & the UI). */
function signatureOf(plan) {
  return JSON.stringify({
    a: plan.archetype, d: plan.damage, lw: +plan.lot.lw.toFixed(2), ld: +plan.lot.ld.toFixed(2),
    v: plan.volumes.map((v) => [+(v.x1 - v.x0).toFixed(2), +(v.z1 - v.z0).toFixed(2), v.bases.length, +v.top.toFixed(2), v.roof]),
    s: [plan.style.wall, plan.style.openShape, plan.style.bayW.toFixed(2), plan.style.balcony, plan.style.wallTint],
  });
}

/**
 * Plan one building on a lot. Coordinates: lot-local (x along the frontage,
 * z = 0 at the street line, growing into the block).
 */
export function planBuilding(r, lot, district, o) {
  const A = r.weighted(Object.entries(district.archetypes));
  const cfg = ARCH[A];
  const k = district.destruction * o.damage;
  const pd1 = Math.min(0.7, 0.28 * k), pd2 = Math.min(0.4, 0.1 * k);
  const damage = o.forceDamage ?? r.weighted([[0, Math.max(0.05, 1 - pd1 - pd2)], [1, pd1], [2, pd2]]);

  // ---- style: materials, colours, facade features ----
  const wall = r.weighted(cfg.walls);
  const decay = r.range(0, 0.35) + damage * 0.12;
  const wallBase = r.pick(PALETTE[wall]);
  const wallTint = mixHex(wallBase, GREY, decay);
  const S = {
    wall, wallTint,
    trim: mixHex(r.pick(TRIM), GREY, decay * 0.5),
    frame: r.pick(FRAME), glass: r.pick(GLASS), door: r.pick(DOOR), wood: r.pick(WOOD),
    shutter: r.pick(SHUTTER), metal: r.pick(PALETTE.metal), awningColor: r.pick(AWNING),
    roofTint: r.pick(ROOF),
    signboard: r.chance(0.6) ? r.pick(SIGN) : null,
    bayW: rr(r, cfg.bayW),
    openShape: r.pick(cfg.shapes), openShapes: cfg.shapes,
    blindP: rr(r, cfg.blind),
    crackiness: rr(r, cfg.crack),
    shutters: chance(r, cfg.shutters),
    balcony: cfg.balcony.length ? r.weighted(cfg.balcony) : null,
    balconyP: rr(r, cfg.balconyP),
    fireEscape: chance(r, cfg.fire),
    stoop: chance(r, cfg.stoop),
    shopfront: chance(r, cfg.shop),
    awning: chance(r, cfg.awning),
    pilasters: chance(r, cfg.pilasters),
    cornice: chance(r, cfg.cornice),
    stringCourse: chance(r, cfg.string),
    downpipe: chance(r, cfg.downpipe),
    rollerDoor: chance(r, cfg.rollerDoor),
    portico: chance(r, cfg.portico),
    buttress: !!cfg.buttress,
    winGlass: null,
  };
  if (cfg.balcony.length === 0) S.balcony = null;
  if (A === 'parkade') { S.balcony = 'solid'; S.balconyP = 1; }
  if (A === 'gothic') S.openShape = r.pick(['lancet', 'lancet', 'round']);
  if (A === 'office') { S.openShape = r.pick(['curtain', 'ribbon']); S.stringCourse = true; }
  if (A === 'industrial') S.openShape = r.pick(['industrial', 'slit']);
  S.shopfront = S.shopfront && A !== 'industrial' && A !== 'gothic';

  // ---- massing ----
  const lw = lot.lw, ld = lot.ld;
  const xa = -lw / 2 + PAD, xb = lw / 2 - PAD, za = PAD, zb = ld - PAD;
  const vols = [];
  const floorsN = rint(r, cfg.floors);
  const fh = rr(r, cfg.fh), gH = rr(r, cfg.gH);
  const makeVol = (role, x0, x1, z0, z1, n, opts = {}) => {
    const b0 = opts.y0 !== undefined ? opts.y0 : 0;
    const bases = [b0];
    const g = opts.gH ?? gH, h = opts.fh ?? fh;
    for (let k2 = 1; k2 < n; k2++) bases.push(b0 + g + (k2 - 1) * h);
    const top = b0 + g + (n - 1) * h;
    return {
      role, x0, x1, z0, z1, y0: b0 === 0 ? -PLINTH : b0, bases, top, n, g, h,
      roof: opts.roof || 'flat', roofRise: opts.roofRise || 0, water: !!opts.water, pilotis: !!opts.pilotis,
      spire: !!opts.spire, groundOnly: false,
    };
  };
  const roof = r.weighted(cfg.roofs || [['flat', 1]]);
  if (A === 'apartment') {
    vols.push(makeVol('main', xa, xb, za, zb * (r.range(0.55, 0.75)), floorsN, { roof, water: roof === 'water', roofRise: 2.2 }));
    if (chance(r, cfg.wing) && ld > 16) {
      const zm = vols[0].z1;
      vols.push(makeVol('wing', xa, xa + lw * 0.42, zm, zb, Math.max(2, floorsN - 1), { roof: 'flat', water: r.chance(0.5) }));
    }
    vols[0].roof = roof === 'water' ? 'flat' : roof;
    if (roof === 'pitch') vols[0].roofRise = Math.min(lw, ld) * 0.42;
  } else if (A === 'rowhouse') {
    vols.push(makeVol('main', xa, xb, za, zb, floorsN, { roof: 'pitch', roofRise: Math.min(lw, ld) * 0.36 }));
  } else if (A === 'shopfront') {
    vols.push(makeVol('main', xa, xb, za, zb, floorsN, { roof, roofRise: Math.min(lw, ld) * 0.3 }));
  } else if (A === 'office') {
    const podN = r.int(1, 2);
    vols.push(makeVol('podium', xa, xb, za, zb, podN, { roof: 'flat', gH: 4.6, fh: 4.4 }));
    const tx = lw * 0.27, tz0 = ld * 0.22, tz1 = ld * 0.8;
    vols.push(makeVol('tower', -tx, tx, tz0, tz1, floorsN + 1, { roof: roof === 'mech' ? 'mech' : 'flat', fh: fh }));
  } else if (A === 'civic') {
    vols.push(makeVol('main', xa, xb, za, zb, floorsN, { roof: roof === 'dome' ? 'dome' : 'pitch', roofRise: Math.min(lw, ld) * 0.3 }));
    vols[0].roof = roof;
  } else if (A === 'gothic') {
    vols.push(makeVol('nave', -lw * 0.36, lw * 0.36, ld * 0.22, zb, 2, { roof: 'pitch', roofRise: lw * 0.32, gH: r.range(6, 7), fh: r.range(6, 7) }));
    const tw = lw * 0.2;
    vols.push(makeVol('tower', -lw * 0.45, -lw * 0.45 + 2 * tw, za, ld * 0.2, 4, { roof: 'spire', gH: 5.2, fh: 5.6 }));
  } else if (A === 'industrial') {
    vols.push(makeVol('hall', xa, xb, ld * 0.22, zb, 1, { roof: 'sawtooth', gH: rr(r, cfg.gH) }));
    vols.push(makeVol('office', xa, xa + lw * 0.42, za, ld * 0.24, 2, { roof: 'flat', gH: 3.4, fh: 3.2 }));
    vols[0].roof = 'sawtooth';
  } else if (A === 'modernist') {
    const pil = chance(r, cfg.pilotis);
    const y0 = pil ? 3.6 : 0;
    vols.push(makeVol('main', xa, xb, za, ld * 0.7, floorsN, { roof: 'flat', y0, pilotis: pil }));
    if (chance(r, 0.6)) vols.push(makeVol('stub', xa + lw * 0.2, xb - lw * 0.15, ld * 0.7, zb, 2, { roof: 'flat', gH: 3.4, fh: 3.4 }));
  } else if (A === 'parkade') {
    vols.push(makeVol('main', xa, xb, za, zb, floorsN, { roof: 'flat' }));
  }

  // ---- damage: truncation and roof loss ----
  if (damage === 2) {
    for (const v of vols) {
      const keep = Math.max(1, Math.round(v.n * r.range(0.3, 0.6)));
      if (keep < v.n) {
        v.n = keep;
        v.bases = v.bases.slice(0, keep);
        v.top = v.bases[0] + v.g + (keep - 1) * v.h;
      }
      v.roof = 'none';
    }
  } else if (damage === 1) {
    for (const v of vols) if (r.chance(0.5)) v.roof = 'none';
  }

  // ---- impacts (where the blast/collapse started) ----
  const impacts = [];
  const nImp = damage === 0 ? 0 : damage === 1 ? 1 : r.int(2, 3);
  for (let i = 0; i < nImp; i++) {
    impacts.push({
      vol: r.int(0, vols.length - 1),
      face: r.pick(['front', 'front', 'back', 'left', 'right']),
      uf: r.range(0.2, 0.8), vf: r.range(0.3, 0.8),
      R: damage === 1 ? r.range(0.5, 0.9) : r.range(0.8, 1.4),
      amp: damage === 1 ? r.range(0.5, 1.2) : r.range(1.5, 3.2),
    });
  }

  const plan = {
    archetype: A, label: cfg.label, damage, district: district.id, lotId: lot.id,
    lot: { x: lot.x, y: lot.y, z: lot.z, theta: lot.theta, lw, ld },
    volumes: vols, style: S, impacts,
    vines: rr(r, cfg.vines) * district.vegetation * (damage === 2 ? 0.6 : 1),
    ruinTree: damage === 2 && r.chance(0.55),
    rooftopPlants: damage > 0 && r.chance(0.5),
    floorStyles: [],
    seed: r.seed,
  };
  // floor finishes differ per level (lobby marble, wood, tile, concrete ...)
  const FL = ['wood', 'tile', 'concrete', 'stone'];
  for (let i = 0; i < 10; i++) plan.floorStyles.push(r.pick(FL));
  plan.signature = signatureOf(plan);
  return plan;
}
