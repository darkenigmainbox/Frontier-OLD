# Frontier. Asset Browser — Experimental Remastered (HTML prototype)

One generic asset browser over all six workspace catalogues (**150 items**),
built for design review **before** the C++ port. Data is extracted verbatim
from the pinned C++ catalogues — no invented entries.

## Layout (as briefed)

```
[Libraries / folders]  [Grid/List + search + kind filter]  [Inspector]
```

- **Left:** All Assets, Favorites (localStorage), Recent (session), then the
  six collapsible libraries with subfolder counts.
- **Center:** breadcrumb, kind chips with counts, card grid or detail rows,
  global multi-word search, sort (name / library / kind).
- **Right:** accent preview hero, metadata table, tag pills (click to search),
  workspace actions, and related items from the same folder.

## Libraries & counts

| Library | Items | Folders |
|---|---|---|
| Particle Lab | 52 | Effects, Weather, Wind-blown, Physics, ... |
| Photometric | 32 | Lights, Moons, IES Measured, IES Presets, Rigs |
| Fracture Lab | 27 | Materials, Solvers, Presets, Constructs |
| Fluid Studio | 18 | Fire, Blast, Smoke |
| Force Fields | 17 | Flow, Accelerate, Damp |
| UV Studio | 4 | Assets |

## Try it

```bash
python3 "Experimental Remastered/AssetBrowser/Serve.py" 8086
# → http://localhost:8086/Experimental%20Remastered/AssetBrowser/
```

Shortcuts: `/` search · `↑↓←→` move · `Enter` open in workspace ·
`F` favorite · `G`/`L` grid/list · `Esc` clear.

All actions are illustrative toasts — nothing mutates state outside
favorites/recents. The later C++ port will wire “Open in …” to the real
workspace staging calls and move each workspace's in-UI pickers into this
browser to de-clutter the workspace shells.
