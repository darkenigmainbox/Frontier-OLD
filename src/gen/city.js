// Top-level generator: seed + options -> city geometry buckets and a plan summary.
import * as THREE from 'three';
import { Rng } from './rng.js';
import { makeNoise2D } from './noise.js';
import { planLayout, SIDEWALK_H, DISTRICT_KINDS } from './layout.js';
import { planBuilding, PLINTH } from './archetypes.js';
import { buildBuilding, plantsForBuilding } from './building.js';
import { buildGround, blockAt } from './ground.js';
import { streetProps } from './props.js';
import { Builder, M } from './geom.js';
import { bush, grassTuft } from './vegetation.js';

export const DEFAULTS = {
  size: 360,      // city side length, metres
  districts: 5,   // number of districts (3-6)
  density: 0.6,   // chance that a lot holds a building
  damage: 1.0,    // multiplier on destruction
  vegetation: 1.0,
};

export function generateCity(seed = 'frontier', options = {}) {
  const t0 = Date.now();
  const o = { ...DEFAULTS, ...options };
  const rng = new Rng(seed);
  const noise = makeNoise2D(rng.fork('terrain'));
  const layout = planLayout(rng.fork('layout'), o);
  const b = new Builder();
  b.setBase(new THREE.Matrix4());

  const groundInfo = buildGround(b, layout, rng.fork('ground'), noise);
  const buildings = [];
  let plants = 0;

  for (const lot of layout.lots) {
    const r = rng.fork(`lot${lot.id}`);
    const block = layout.blocks[lot.block];
    const district = layout.districts[lot.district];
    if (!r.chance(o.density) && block.kind !== 'ruin') continue;
    const plan = planBuilding(r.fork('plan'), lot, district, {
      ...o, forceDamage: block.kind === 'ruin' ? 2 : null,
    });
    const lotM = M([lot.x, SIDEWALK_H + PLINTH, lot.z], [0, lot.theta, 0]);
    b.setBase(lotM);
    const summary = buildBuilding(b, plan, noise, r.fork('build'));
    plants += plantsForBuilding(b, plan, r.fork('plants'));
    b.setBase(new THREE.Matrix4());
    buildings.push({
      id: buildings.length, lotId: lot.id, archetype: plan.archetype, label: plan.label,
      damage: plan.damage, district: district.id, districtKind: district.kind,
      floors: plan.volumes.reduce((a, v) => a + v.n, 0),
      volumes: plan.volumes.map((v) => ({ role: v.role, floors: v.n, roof: v.roof, top: +v.top.toFixed(2) })),
      wall: plan.style.wall, openShape: plan.style.openShape, bayW: +plan.style.bayW.toFixed(2),
      balcony: plan.style.balcony, fireEscape: plan.style.fireEscape, stoop: plan.style.stoop,
      vines: +plan.vines.toFixed(2), facades: summary.facades.length, cracks: summary.facades.reduce((a, f) => a + f.cracks, 0),
      holes: summary.facades.reduce((a, f) => a + f.holes, 0),
      signature: plan.signature, x: lot.x, z: lot.z,
    });
  }

  // blocks: gardens, trees, parks; streets: cars, lamps, debris
  streetProps(b, layout, rng.fork('props'), noise);
  // scattered undergrowth on empty ground
  const rg = rng.fork('undergrowth');
  for (let k = 0; k < 1400; k++) {
    const x = rg.range(2, layout.size - 2), z = rg.range(2, layout.size - 2);
    if (blockAt(layout.blocks, x, z)) continue;
    grassTuft(b, rg, x, 0, z, rg.range(0.25, 0.6));
  }
  for (let k = 0; k < 120; k++) {
    const x = rg.range(2, layout.size - 2), z = rg.range(2, layout.size - 2);
    if (blockAt(layout.blocks, x, z)) continue;
    bush(b, rg, [x, 0, z], rg.range(0.8, 1.6));
  }

  const geometry = b.finish();
  const stats = {
    seed: String(seed), ms: Date.now() - t0, buildings: buildings.length, plants,
    lots: layout.lots.length, blocks: layout.blocks.length, districts: layout.districts.length,
    cracksRoad: groundInfo.cracks, roadCrackLength: Math.round(groundInfo.crackLength),
    ...b.stats(),
  };
  return { geometry, layout, buildings, stats, options: o, kinds: DISTRICT_KINDS };
}
