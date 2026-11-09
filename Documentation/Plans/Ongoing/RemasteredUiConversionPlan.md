# Remastered UI Conversion Plan (UI-shell-first)

**Status:** proposed 2026-11-09. Supersedes the sequencing (not the content) of
`ModularFoundationPlan.md` Phases 3.5–5 for the deadline push.
**Baseline:** `egoistm1inbox/Frontier` branch `arena/5d87070a-frontier` at `c2ba0a6`
("Add shared curve plot UI foundation and validation"), imported into this branch.

## 0. Verified baseline (what is actually true at `c2ba0a6`)

| Area | Claimed before | Verified now |
|---|---|---|
| 3.5 FluidSpace headless | "mistake, no UI" | Partial CPU foundation is real and validated; the browser editor at `Experimental/Fluid/` is the UI reference. No replacement editor needed. Remaining: GPU path, boundary/thermal depth, replication of release state, native/browser bridge. All deferred. |
| 3.6 GizmoSpace rename | "Open, not renamed" | **Done:** `SceneSubjectPlacement`, `SubjectDistanceSpace`, `SubjectRelocation`, `SpatialEditable` + `PlacementGizmo` adapters. Still open: ~19 `Occupant*` files in GI/Rendering, `Frame` identifiers, live gizmo wiring, facetspace resolution, collision export. Deferred except gizmo wiring. |
| Phase 4 CurveSpace | "0%, does not exist" | **Data layer done:** `Frontier/Engine/Foundation/Curves/CurveSpace.h` (linear/Hermite/PCHIP + LUT + `.curvespace` codec, 26 checks). Missing: domain consumers. Deferred. |
| Phase 4 EffectSpace | "0%, does not exist" | **Data layer done:** `Frontier/Engine/Rendering/VisualEffects/EffectSpace.h` (4 effect kinds + spatial/replication + `.effectspace` codec, 19 checks). Missing: GPU evaluation pipeline. Deferred. |
| Shared UI slice | — | **Started:** `Interface/Controls/CurvePlot` + CPU evidence. This is the seed of the Studio Kit. |
| ForceField sharing | "needs fixes/refactor" | **Confirmed.** `IFieldSampler` contract is sampled by Particle/Fluid/Physics/Clouds and works, but: `ForceField.cpp` is 1250 lines (violates the <450-line TU rule), evaluators are not split into Flow/Acceleration/Damping units, Wind is embedded (not master/guest separated), `ForceReach::Everywhere` still exists (Remastered demands strictly finite envelopes), and the Remastered 17th placeable (`WindGenerator`) has no C++ counterpart. **This is the one foundation refactor we do now.** |
| Fracture engine | — | Not started: only stub `FractureEditor` (54 lines) + `FractureInspector`. Engine comes after UI. |
| Plume/Fluid engine | — | CPU foundation exists (see 3.5 row). Completion comes after UI. |
| Old C++ UI | — | Pre-Remastered pages exist (ForceField/Wind sections, Particle modal, decorative Fluid/Fracture stubs). They do **not** match Remastered visuals and are replaced by the shells below, not patched. |

Vehicle Lab / AssetInspector stay **out of scope** (per `RemasteredWorkspaceParity.md`).

## 1. Sequencing decision: UI-shell-first (recommended)

Do the small foundation remainder first (**Phase F**, ~1 unit of work, headed by the
ForceField refactor the UI labels/ranges depend on), then convert the Remastered
editors to C++ workspaces as **UI + interaction shells with explicit NOOPs**
(**Phase U**), then complete the engines and wire the shells (**Phase E**, after
the deadline).

Rules for NOOP shells:
- Every control is classified: **local-state** (selection, tabs, sliders move view
  state only), **explicit-noop** (disabled + tooltip "Not wired in UI pass", or a
  toast saying so), or **hidden**. Nothing fakes engine results.
- The Log Stream shows real UI events (selection/view/transport changes) so each
  shell feels alive honestly.
- Each shell exposes one narrow seam for later wiring (`Construct<Name>Workspace`
  + a view-model struct); no engine calls from shell code.
- Naming: product shells are **Workspaces** (`ForceFieldWorkspace`,
  `ParticleWorkspace`, `FluidWorkspace`, …). `StudioControls` / `Studio*`
  glyph names stay because they mirror the Remastered module 1:1.

## 2. Phase F — Finish the foundation remainder (small, first)

- [ ] **F1. ForceField refactor (shared by Particles + Fluids + Wind):**
  split `ForceField.cpp` into `FlowEvaluators`, `AccelerationEvaluators`,
  `DampingEvaluators` (+ wind-profile unit), each <450 lines, behind one
  templated accumulator; add the localised `WindGenerator` source type;
  enforce finite envelopes (`Sphere`/`Column`/`Box` + falloff, zero leakage;
  `Everywhere` only for `Gravity`, explicitly labelled); keep the
  `IFieldSampler` contract stable; re-run `ForceFieldCatalogueValidation`,
  `ParticleSpaceValidation`, `FluidSpaceValidation`.
- [ ] **F2. Gizmo wiring (UI-touching only):** activate the `SpatialEditable`
  adapters in workspace picking so stage selection has a seam. Defer the
  19-file `Occupant*` rename, `Frame` purge, facetspace resolution, collision
  export.
- [ ] **F3. Baseline:** full `ctest` green before UI work starts. Defer everything
  else (CurveSpace consumers, EffectSpace GPU, Fluid GPU/bridge, Fracture
  engine, Session, Vehicle).

## 3. Phase U — Remastered UI shells in C++ (1:1 visuals, NOOP logic)

- [x] **U0. Shared Studio Kit** (pays off 5x): DONE 2026-11-09 in `ee0b095` —
  ported SectionCard, SegmentedRow, VectorRow, TextRow, SliderPill (typed/
  scrubbed figure + pill track), SwitchPill, Toast, `ResolveRemastered()`
  theme tokens, and 118 Studio/StudioField glyph outlines
  (`Automation/GenerateStudioGlyphs.py`); `StudioControlsValidation` drives
  scripted pointer interaction with PPM/PNG evidence
  (`Exhibits/StudioControls/Images/VerifiedKit.*`). Colour rows, ToggleTile,
  ActionRow, PillTabs, MetricTrio, TimeSeries, EmitterInstrument, PolarDial,
  and the workspace frame ride with the per-workspace shells (U1–U4) that need them.
- [x] **U1. ForceField & Wind Workspace** (first: shared dependency, smallest stage):
  DONE 2026-11-09 — `Interface/Workspaces/ForceFieldWorkspace` (shell, catalogue,
  inspector TUs) + `ForceFieldWorkspaceValidation` (boot/pages/fold/arm-NOOP/log/
  mode/timeline/eye/scenario/HUD/FIRE/library interaction checks, 3-page CPU-raster
  evidence `Exhibits/ForceFieldWorkspace/Images/Verified{Source,Wind,Field}.png`).
  Outliner (master/ambient/generators/zones) · Map 2D stage (grid + influence
  envelopes + static RK2-style flow-line decor, honestly labelled) + 3D Stage
  tab · Inspector (generator card, influence-profile plot, toggles, placement,
  shape segmented, sliders) · Timeline (static lanes, scrubbable playhead) · Log
  drawer + 17-type place library. Product shells are named **Workspace**, not
  Studio (`Construct<Name>Workspace` seam). Along the way: shared-kit overflow
  hardening (section-title ellipsis, SwitchPill caption wrap, SegmentedRow
  shrink-to-fit — U0 evidence pixel-identical) and a `TypefaceRegistry` fix that
  rasterizes Greek/math symbol ranges so ω/∇ labels render in production too.
- [x] **U2. Particle Workspace:** DONE 2026-11-09 — `Interface/Workspaces/ParticleWorkspace`
  (shell, catalogue, inspector TUs) + `ParticleWorkspaceValidation` (boot/select/
  tabs/transport-NOOP/log/mode/library/export/HUD/camera/minimap/orbit/reset
  interaction checks, 5-page CPU-raster evidence
  `Exhibits/ParticleWorkspace/Images/Verified{Effect,Modules,Scene,Wind,Force}.png`).
  Outliner (environment/effects/forces) · stage + probe/legend/minimap slots ·
  Inspector (effect header, Overview/Source/Motion/Modules tabs, scene/wind/force
  pages) · 52-preset library list (read-only names from `.particlespace`) ·
  transport + Strike/Burst as explicit NOOPs. Sheets (library/export) live in
  child windows so their keys receive presses over the inspector child.
- [ ] **U3. Fluid Workspace (Plume UI):** Outliner (gas domain, fire emitter, light) ·
  stage grid decor · Inspector (Source/Simulation/Rendering tabs per
  `Experimental/Fluid/src/FluidPanel.js`) · 18-preset list · Bake/Trigger as
  explicit NOOPs.
- [ ] **U4. Fracture Workspace:** Outliner (celestials + destructible solids) · stage
  shard decor · Inspector (Overview/Physics/Bonds/SDF tabs) · solid/solver
  presets · Strike/Bake as explicit NOOPs.
- [ ] **U5. Photometric & Light Workspace (stretch):** only if time remains; lights
  already have C++ inspectors, so this is lowest risk to defer.

Per-shell exit criteria: 1:1 checklist vs the Remastered screenshot + HTML/CSS
tokens; CPU-raster evidence PNGs; headless interaction checks; NOOP audit list.
No engine calls, no shaders.

## 4. Phase E — Engines after UI (post-deadline)

- [ ] **E1. Plume/Fluid completion:** boundary profiles, richer thermal transport,
  replication of authored/release state + sim clock, live
  Fluid→`ParticleTriggerRouter` coupling, native/browser bridge decision
  (import the Fluid Editor's TOML export into `.fluidspace` is the leading
  option), GPU path last.
- [ ] **E2. Fracture engine:** `.fracturespace` schema, CPU 3D half-space clipper,
  Jolt debris-body release, `PhysicsImpactTelemetry` + `ParticleTriggerRouter`
  coupling, bake cache.
- [ ] **E3. CurveSpace consumers + EffectSpace GPU sequence** (dual-velocity atlas,
  heat distortion, flare/glare, motion blur, impulse shake).
- [ ] **E4. Rendering/Gizmo leftovers** (renames, facetspace, collision export).
- [ ] **E5. Wire the shells** to the engines one workspace at a time, ForceField
  first; each NOOP flips only with its validation.

## 5. Validation & working agreements

- Headless CPU builds + `ctest` at every checkpoint; CPU-raster PNG evidence vs
  Remastered screenshots; Windows cross-compile check if time permits (runtime on
  the owner's machine).
- Work stays on this branch. No Vehicle Lab. No new browser editors. No GPU/
  shader work until Phase E.
