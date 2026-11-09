import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { generateCity } from '../src/gen/city.js';
import { growCracks } from '../src/gen/fracture.js';
import { Rng } from '../src/gen/rng.js';

let A, B;
before(() => {
  A = generateCity('test-1');
  B = generateCity('test-2');
});

describe('generateCity', () => {
  test('is deterministic for the same seed', () => {
    const again = generateCity('test-1');
    assert.equal(again.stats.buildings, A.stats.buildings);
    assert.equal(again.stats.verts, A.stats.verts);
    assert.equal(again.stats.tris, A.stats.tris);
    assert.deepEqual(again.buildings.map((b) => b.signature), A.buildings.map((b) => b.signature));
  });

  test('different seeds give different cities', () => {
    assert.notEqual(A.stats.verts, B.stats.verts);
    const sa = new Set(A.buildings.map((b) => b.signature));
    const overlap = B.buildings.filter((b) => sa.has(b.signature)).length;
    assert.equal(overlap, 0, 'no building signature should repeat across cities');
  });

  test('every building is unique within a city', () => {
    const sigs = A.buildings.map((b) => b.signature);
    assert.equal(new Set(sigs).size, sigs.length);
  });

  test('buildings have plausible geometry and lie inside the city', () => {
    const S = A.layout.size;
    assert.ok(A.buildings.length >= 40, `only ${A.buildings.length} buildings`);
    for (const b of A.buildings) {
      assert.ok(b.floors >= 1 && b.floors <= 30, `floors ${b.floors}`);
      assert.ok(b.x >= 0 && b.x <= S && b.z >= 0 && b.z <= S, `building ${b.id} outside city`);
      assert.ok([0, 1, 2].includes(b.damage), `damage ${b.damage}`);
    }
  });

  test('archetype mix includes the main types', () => {
    const kinds = new Set(A.buildings.map((b) => b.archetype));
    for (const k of ['office', 'apartment', 'shopfront', 'rowhouse', 'industrial']) {
      assert.ok(kinds.has(k), `missing archetype ${k}`);
    }
  });

  test('some buildings are damaged and some are intact', () => {
    const d = A.buildings.filter((b) => b.damage > 0).length;
    assert.ok(d > 0 && d < A.buildings.length);
  });

  test('every geometry bucket is a valid indexed mesh', () => {
    for (const [name, g] of A.geometry) {
      const pos = g.attributes.position.array;
      const idx = g.index.array;
      const n = g.attributes.position.count;
      assert.equal(idx.length % 3, 0, `${name}: index not multiple of 3`);
      assert.equal(g.attributes.normal.count, n, `${name}: normal count`);
      assert.equal(g.attributes.uv.count, n, `${name}: uv count`);
      assert.equal(g.attributes.color.count, n, `${name}: colour count`);
      for (let i = 0; i < idx.length; i++) assert.ok(idx[i] < n, `${name}: index out of range`);
      for (let i = 0; i < pos.length; i++) assert.ok(Number.isFinite(pos[i]), `${name}: non-finite position`);
    }
  });

  test('vertex count stays within browser budget', () => {
    assert.ok(A.stats.verts < 2_000_000, `verts ${A.stats.verts}`);
  });

  test('plants and road cracks are present', () => {
    assert.ok(A.stats.plants > 0);
    assert.ok(A.stats.cracksRoad > 0);
    assert.ok(A.stats.roadCrackLength > 0);
  });
});

describe('fracture', () => {
  test('growCracks produces connected, bounded crack polylines', () => {
    const rng = new Rng('crack-test');
    const cracks = growCracks({
      rng,
      inside: (x, y) => Math.abs(x) < 10 && Math.abs(y) < 10,
      sources: [{ x: 0, y: 0, amp: 40, soft: 1 }],
      tips: [{ x: -6, y: 0, h: 0, len: 4, kc: 0.5 }, { x: 6, y: 2, h: Math.PI, len: 4, kc: 0.5 }],
      stepLen: 0.5, maxLen: 8, maxGen: 3, kc: 0.5, maxCracks: 60,
    });
    assert.ok(cracks.length > 0, 'expected some cracks');
    for (const c of cracks) {
      assert.ok(c.pts.length >= 2);
      for (const [x, y] of c.pts) assert.ok(Math.abs(x) <= 10.5 && Math.abs(y) <= 10.5, 'crack left the solid');
    }
  });
});
