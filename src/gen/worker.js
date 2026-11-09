// Runs city generation off the main thread and transfers the buffers back.
import { generateCity } from './city.js';

self.onmessage = (e) => {
  const { id, seed, options } = e.data;
  try {
    const city = generateCity(seed, options);
    const buckets = {};
    const transfer = [];
    for (const [name, g] of city.geometry) {
      const d = {
        position: g.attributes.position.array,
        normal: g.attributes.normal.array,
        uv: g.attributes.uv.array,
        color: g.attributes.color.array,
        index: g.index.array,
      };
      buckets[name] = d;
      transfer.push(d.position.buffer, d.normal.buffer, d.uv.buffer, d.color.buffer, d.index.buffer);
    }
    const L = city.layout;
    self.postMessage({
      id, ok: true, buckets,
      buildings: city.buildings,
      stats: city.stats,
      districts: L.districts.map((d) => ({ id: d.id, kind: d.kind, label: d.label, x: d.x, z: d.z })),
      size: L.size,
    }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.stack) || err) });
  }
};
