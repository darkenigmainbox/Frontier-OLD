# Remastered workspace parity

**Status:** ongoing. The source-restoration subtask for the Fluid Editor and Particle Studio location is complete; the wider
Remastered workspace parity work and shared UI foundation are not complete.

## Completed source-restoration slice

- Located and copied the latest inspected non-node gas Fluid Editor into `Experimental/Fluid/`. It authors plumes, blasts,
  wildfire/dust tornadoes, and other effects. This is the upstream prototype, not a newly written node editor.
- Moved the Remastered Particle Studio to `Experimental Remastered/ParticleEditor/` and updated its suite links and launcher
  references. The distinct `Experimental/ParticleEditor/` reference tree remains for existing validation/export consumers.
- Build, Node tests, browser checks, interaction checks, and route checks passed. The detailed source research, commands, caveats,
  and captured browser evidence are recorded in
  [`RemasteredEditorSourceRestoration.md`](../Completed/RemasteredEditorSourceRestoration.md) and
  [`Exhibits/FluidEditor/README.md`](../../../Exhibits/FluidEditor/README.md).

## Remaining workspace scope

The concrete sequence, the audit findings behind it, and the UI-first / no-op contract are written up in
[`FoundationCloseoutAndWorkspaceUi.md`](FoundationCloseoutAndWorkspaceUi.md). This section stays as the scope statement.

- Finish and verify the shared UI foundation before further editor-specific UI integration.
- Continue workspace parity work within its approved scope. Keep Vehicle Lab and AssetInspector out of scope.
- Do not present the restored browser Fluid Editor as integrated with the native C++ engine. `FluidSpace` integration,
  replication/release-state transport, boundary profiles, richer thermal transport, extension/editor integration, GPU execution,
  broader numerical validation, and Phase 3 Rendering/Gizmo cleanup remain outstanding.
- Preserve the user's 1:1 C++ porting expectation for engine behavior; the existing C++ Particle Editor is not evidence of full
  parity with the newer Remastered Particle Studio.
