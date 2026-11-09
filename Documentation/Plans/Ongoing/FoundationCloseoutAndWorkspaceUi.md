# Foundation close-out, then Remastered workspace UI

**Status:** refined plan awaiting sign-off. Drawn on 2026-11-09 from a file-by-file audit of `egoistm1inbox/Frontier` at
`arena/5d87070a-frontier` tip `c2ba0a6f`, which is now also the starting content of this branch (`arena/8ba15f29-frontier`,
sync commit `ab9f9c6`). It supersedes the ordering assumptions in `ModularFoundationPlan.md` §Phase 3.6/§Phase 4 checkpoints
and extends `RemasteredWorkspaceParity.md`.

## Why this plan exists

The Phases 0–3.5 foundation is genuinely built. What is *not* built is the thing the repositories actually show the user:
the Remastered studio workspaces. The previous session answered that gap with decorative stand-ins, and it kept treating the
headless CPU `FluidSpace` as if the Fluid authoring UI did not exist. Both are corrected here. The order below is: make the data
contracts the studios draw from honest, then port the studios 1:1 as UI with no-ops, then build the solvers that drive them.

## Audit findings (all reproducible against `c2ba0a6f`)

1. **Placeholder editors, not parity.** `Frontier/Engine/Interface/FluidPlumeEditor.cpp` (55 lines) and
   `Frontier/Engine/Interface/FractureEditor.cpp` (54 lines) render hand-placed circles and rectangles inside
   `DiagramControls::ConstructEditorModalFrame` and print captions the code does not implement
   (`"TOROIDAL EULERIAN PLUME · 128x64x128 · BLACKBODY CORE"`). `Inspectors/FluidPlumeInspector.cpp` forwards to the stand-in.
   None of this resembles `Experimental Remastered/screenshots/*.png`.
2. **`.forcespace` is lossy and unreachable.** `ForceFieldSpaceCodec.h` serializes only
   `Enabled / GroundPlaneYMeters / ElapsedSeconds / AuthoredSeconds / Wind / Spatial / Replication`. `ForceSourceConfiguration`
   has no `SpaceSchema` specialization anywhere in the tree, so the authored force list — the entire content of the Force Field
   studio — cannot round-trip. `WriteForceSpace`/`ReadForceSpace` have zero callers and zero tests.
3. **Two dialects for one fluid scene.** The restored demo authors `frontier-fluid-scene` v1: `[names]`, `[camera]`, and 85 sorted
   flat settings (`Experimental/Fluid/src/SceneTomlCodec.js`, `Experimental/Fluid/Samples/*.gasscene.toml`). C++
   `FluidSpaceConfiguration` is an unrelated 9-field `.fluidspace` schema. No C++ reader for `.gasscene.toml` exists; the header
   comment in every sample pointing at `Engine/VolumetricDynamics` names a folder that is not in this repository.
4. **Solver is thinner than the schema it must drive.** `FluidSimulationSequence` has semi-Lagrangian advection, Jacobi pressure
   projection, buoyancy, implicit smoke/vapour diffusion, and a fixed `clamp(DeltaSeconds * 2)` wind blend, but no dissipation,
   vorticity confinement, MAC-Cormack option, obstacles, or boundary profiles — i.e. most of the demo's settings have no
   engine counterpart yet.
5. **Phase 3.6 is half done.** `SceneGeometryOccupancy` → `SceneSubjectPlacement` landed in `14e108d6`, but `Occupant*`
   (`OccupantRegion`, `OccupantEntry`, `OccupantStride`, `EncodeOccupantProfiles`, `GroundOccupantIndex`, `Scene.Occupants`,
   `PickProjection`, `DisplayProjection`, `DirectShadingSequence`, `SceneViewportPresentation::Occupant`) and the banned `Frame`
   spelling are still pervasive under `Frontier/Engine/Rendering/**`. Two gizmo paths coexist: `Interface/Controls/PlacementGizmo`
   (screen-space adapter over `SpatialConfiguration`) and `Extensions/Interface/GizmoSpace` (world-space handle triangles, pick,
   Slate GizmoPRO drag maths). Neither is wired into a live workspace.
6. **Phase 4 is data-only by design.** `Foundation/Curves/CurveSpace.h` (validated linear / clamped Hermite / monotonic PCHIP,
   baked LUT, `.curvespace`, 26 checks) and `Rendering/VisualEffects/EffectSpace.h` (`.effectspace`, 19 checks) are correct but
   have zero domain consumers and no GPU render-target sequence. Their own headers say so.
7. **The reusable UI half exists; the studio half does not.** `Frontier/Engine/Interface/Controls/` ships 44 controls
   (`ControlTheme`, `TabStrip`, `MetricTiles`, `QuickTiles`, `SliderRow`, `SwitchRow`, `ChoiceList`, `PresetStrip`,
   `DiagramCanvas`, `DiagramPen`, `ReadoutBlock`, `TagPill`, the new `CurvePlot`) plus `ViewportChromeControls`,
   `SceneDirectoryPanel`, `LogStreamPanel`, `ConstructPanel`, and ~14 kB of inspectors. What no studio has is the shell:
   top bar with scene tabs, outliner + stage + inspector composition, preset library, playback bar with timeline, status bar.

## Standing rules for every step below

Repository governance stays in force: Allman braces, flat `namespace Frontier`, 140-character file banners, strict PascalCase
with the banned-word purge, `*space` TOML containers and never a `.toml` suffix for them, Windows binaries as the default target,
no GitHub Actions without explicit approval, and `SolidArc`, `TextureStudio`, and `Experimental/VehicleProvingGrounds/` stay
green. Each step ends with a build, its CTest(s), and an `Exhibits/` evidence note; nothing is claimed in a comment that is not
validated.

## Wave 1 — Foundation close-out (before any pixel of studio UI)

These are prerequisites only because the studios are *views of these documents*. Porting UI against a lossy schema means
redrawing it later.

- **1.1 Truth pass.** Delete the decorative `FluidPlumeEditor` / `FractureEditor` modal stand-ins and their forwarding
  `ConstructEditor` calls; keep the inspectors as plain parameter rows until Wave 3 replaces them with real workspaces. Record the
  rule "no unverified specification text in UI" in `Documentation/Rules/`.
- **1.2 ForceField split + real `.forcespace`.** Break `ForceField.cpp` (1250 lines) into
  `ForceFieldWindProfile` (Ekman profile, gust waves, curl eddies, Beaufort), `ForceFieldCoherentSources` (tornado column,
  gust front, microburst, gust puff, aerodynamic wake, thermal updraft, directional jet, spherical impulse), and
  `ForceFieldParticulateSolver` (rain/hail/snow/dust/sand/debris Lagrangian species); `ForceField.h` keeps its public surface so
  Wind, Particles, and Fluids keep compiling. Add `SpaceSchema<ForceSourceConfiguration>` plus the
  `[sources]` array to `ForceSpaceDocument`, wire `WriteForceSpace`/`ReadForceSpace` into a round-trip CTest, and route every
  consumer through `IFieldSampler` so the Y-up/Z-up swizzle happens in exactly one place.
- **1.3 FluidSpace direction fix (one document).** Add a C++ `frontier-fluid-scene` reader/validator that parses
  `Experimental/Fluid/Samples/*.gasscene.toml` and derives `FluidSpaceDescriptor` (grid resolution, pressure iterations, bounds →
  cell counts/span, sun → thermal, emitter/blast → `RadialFluidSource`, camera → viewport presentation state). `.fluidspace`
  becomes the domain/settings slice it always should have been. Validation: 8/8 samples parse and re-encode byte-identically.
  The HTML demo in `Experimental/Fluid/` stays the interactive reference and is *not* replaced.
- **1.4 Phase 3.6 close-out.** Finish the `Occupant*` → `Subject*` sweep and the `Frame` rename across
  `Frontier/Engine/Rendering/**` and `Engine/Interface/SceneViewportPresentation.h`; unify the gizmo on `GizmoSpace`
  handle geometry with `PlacementGizmo` as its ImGui front end; keep collision export and `<ArchiveStem>.facetspace` dynamic
  resolution as tracked follow-ups rather than silent gaps.
- **1.5 Phase 4 consumer hooks (data only).** Attach `CurveSpace` to the places the studios already draw curves (particle speed
  band and colour ramp, wind altitude curve, fluid temperature ramp) behind `CurvePlot`; keep `EffectSpace` declarative and state
  plainly that the GPU sequence is Wave 4.

## Wave 2 — Shared studio shell (UI only, reused by all five studios)

- **2.1 `StudioTheme`.** Palette, radii, type scale, and spacing derived from the four studio stylesheets plus
  `Experimental/Fluid/src/ThemeSpecification.css`; extend `ControlTheme` rather than duplicating it.
- **2.2 `StudioShell`.** Top bar (wordmark, studio pill, scene tabs with overflow "+", `Workspace`/`Presets`/`Log Stream`
  segmented control with counters, preview-mode badge, help, `Export TOML`), left rail (Outliner title + collapse/add, metric
  tiles, search with shortcut hint, filter chips, group headers with counts, rows with icon/status/visibility), centre stage
  (chrome toolbar with mode selects and view buttons, floating tool rail, hint chips, live readout cards, legend and scale bar,
  playback bar, timeline strip with event lanes), right rail (inspector breadcrumb, `Reset`, title row with master switch,
  sub-tab strip, numbered section cards, quick-control tile grid, footer line), status bar.
- **2.3 New controls.** `SearchField`, `FilterChipRow`, `OutlinerTree`, `PresetLibrary`, `PlaybackBar`, `TimelineStrip`,
  `LegendRamp`, `CalloutLabel`, `StatusPill`, `MetricHero`, `NumericSliderRow`, and inspector sub-tabs on `TabStrip`.
- **2.4 Parity harness.** Headless ImGui capture per workspace at 1536 × 1024 through the CPU raster path already used by
  `Exhibits/Curves/Code/CurvePlotValidation.cpp`, side-by-side with `Experimental Remastered/screenshots/`, evidence under
  `Exhibits/<Studio>Editor/Images/WorkspaceParity-2026-11-09/`.
- **No-op contract.** Every control reads and writes only `WorkspacePresentationState`. Buttons append a line to the Log Stream
  panel and change nothing else. Each workspace exposes exactly one named bridge (`ParticleWorkspaceBridge`,
  `ForceFieldWorkspaceBridge`, `FractureWorkspaceBridge`, `FluidWorkspaceBridge`, `PhotometricWorkspaceBridge`) declaring the
  accessors Wave 4 will fill. No `*space` object is touched from UI in Waves 2–3.

## Wave 3 — Studio workspaces, 1:1 appearance, interaction only

Ordered by leverage against the deadline; each lands as its own commit with its own capture.

1. **3.1 Particle Studio** (`screenshots/particle.png`) — reconcile the existing 958-line `ParticleEditorWorkspace` and
   `ParticleEditorPages` onto the shell; add scene tabs, LIVE/particles/rate/CPU readouts, probe card, lattice inset, capacity
   chart, quick tiles, emitter cone & spectrum page.
2. **3.2 Force Field + Wind** (`screenshots/force-field.png`) — `Map 2D` / `3D Stage` toggle, place bar with per-category
   add pills and span presets, view toggles (Vectors / Flow Lines / Influence / Heatmap / Minimal), bounded-influence inspector
   with reach graph, centre/influence/height rows; reuse `ForceFieldVisualization` for the map itself.
3. **3.3 Fracture Studio** (`screenshots/fracture.png`) — shard/baked tiles, pipeline/solver toolbar, strike locus overlay,
   fractography and bond charts, quick tiles, execution-pipeline page. Replaces the deleted stand-in.
4. **3.4 Fluid workspace** (`Exhibits/FluidEditor/Images/Verification-2026-11-09/VerifiedWorkspace.png`) — same three-rail
   shell, gas-domain/emitter/light nodes, Bake + lit-volume toolbar, Source/Simulation/Rendering tabs, emission and
   fuel/temperature cards. Replaces the deleted stand-in; the HTML demo stays as the behaviour reference.
5. **3.5 Photometric Studio** (`screenshots/photometric.png`) — luminaire and environment-light lists, polar distribution plot,
   goniometer/`Load .ies`/`Export .ies`/`Export Rig` buttons, scene-participation flags, diurnal sweep timeline. Largest new port,
   so it goes last.

## Wave 4 — The engines that drive the workspaces (after UI is accepted)

- **4.1** Wire the Wave 1.2 ForceField through the bridges: particle wind coupling, fluid wind coupling, and wind-only scenes.
- **4.2** Plume/fluid parity: dissipation, vorticity confinement, MAC-Cormack advection, obstacles, boundary profiles, embers,
  then the GPU execution decision. Replication/release-state transport after that.
- **4.3** Fracture: Voronoi convex decomposition bake, Navier-Cauchy interlocking fractography, strike/blast propagation.
- **4.4** Photometric: `.ies` parsing, candela distribution, goniometer sampling.
- **4.5** VisualEffects GPU sequence: `DualVelocityTarget`, `HeatDistortion`, `OpticalLensFlare`, `MotionBlur` render targets.
- **4.6** Replace every remaining no-op with its bridge call, keeping each Wave 2/3 capture green as the regression gate.

## Verification loop confirmed on this host (2026-11-09)

`ExternalPackages/` and `EngineContent/FontArchives/` are ignored downloads, so a fresh checkout cannot configure until they are
provisioned. The loop used by every wave below is:

```sh
pip install --user --break-system-packages -q cmake ninja fonttools==4.60.1
python3 Automation/PrepareUI.py                       # pinned imgui/thorvg/toml++/glfw/stb/volk/Jolt + ImGui patches
python3 Automation/PrepareFonts.py                    # 35 faces, 5 families
cmake -S . -B Build/LinuxAgent -G Ninja -DCMAKE_BUILD_TYPE=Debug -DBUILD_TESTING=ON \
      -DFRONTIER_HOST_VERIFICATION=ON -DGLFW_BUILD_WAYLAND=OFF -DGLFW_BUILD_X11=OFF \
      -DGLFW_BUILD_EXAMPLES=OFF -DGLFW_BUILD_TESTS=OFF -DGLFW_BUILD_DOCS=OFF -DGLFW_INSTALL=OFF
cmake --build Build/LinuxAgent --target CurveSpaceValidation EffectSpaceValidation \
      FluidSpaceValidation CurvePlotValidation -j 8
ctest --test-dir Build/LinuxAgent -R "CurveSpace|EffectSpace|FluidSpace|CurvePlot"
```

X11 and Wayland development packages are absent on this Linux host, hence the two GLFW toggles; no host executable needs them for
headless ImGui verification. Baseline on the synced tree: `FluidSpaceValidation`, `CurveSpaceValidation` (26 checks),
`CurvePlotValidation` (interactive drag plus invalid-PCHIP rejection, and `Build/LinuxAgent/CurvePlotValidation.ppm`), and
`EffectSpaceValidation` (19 checks) — 4/4 CTests pass with GCC 12.2, `slangc` absent so shader work stays stored-archive only.
Windows remains the delivery target; this is host verification, not a second build system.

## Out of scope

Vehicle Lab and `Experimental Remastered/AssetInspector` stay out of parity scope. No node-graph editor is being written.
`.gasscene.toml` stays the fluid document of record; we are not inventing a competing one.
