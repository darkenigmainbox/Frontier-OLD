# Frontier

A procedural generator and viewer for an abandoned, post-apocalyptic city after nuclear war.

- **Buildings**: archetypes (office towers, apartment blocks, shopfronts, terraced houses, industrial halls, civic buildings, gothic churches, car parks, modernist blocks) with stairs, balconies, fire escapes, railings, varied window and floor styles.
- **Damage**: cracks grown by a stress-driven crack-propagation model (maximum tangential stress criterion, arrest and branching). Voronoi fracture is not used. Ruined buildings lose their upper floors and roofs.
- **Roads**: cracked asphalt, weeds in fissures, and fallen or abandoned vehicles.
- **Plants**: foliage, trees, and vines on and over buildings, and plants in cracks.
- **Uniqueness**: every city is determined by its seed, and every building carries its own signature.

## Running

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # generator tests (node:test)
npm run build      # static build into dist/
```

## Layout

- `src/gen/` — pure generator (no DOM). `generateCity(seed, options)` returns geometry buckets, buildings, and stats.
  - `fracture.js` crack growth · `contour.js` outlines · `layout.js` districts, blocks, lots
  - `facade.js` · `archetypes.js` · `building.js` · `ground.js` · `vegetation.js` · `props.js` · `city.js`
  - `worker.js` runs generation off the main thread.
- `src/render/materials.js` — procedural canvas textures for every material bucket.
- `src/main.js` — Three.js viewer and UI controls.

## Known limitations

- Layout drops blocks whose corners cross a district border, which leaves open ground between districts. The city size slider raises the block count.
- Vegetation density is still lower than the target; the vegetation control scales it.
