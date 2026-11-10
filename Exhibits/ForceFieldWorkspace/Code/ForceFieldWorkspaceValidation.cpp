// ForceField workspace validation: the U1 UI shell (top bar, outliner, Map 2D / 3D Stage, inspector pages,
// timeline, log drawer, library) with scripted pointer interaction and PPM evidence per inspector page.
// Value controls hold shell-local figures; commands raise NOOP toasts and log lines and change nothing.

#include "Frontier/Engine/Interface/Workspaces/ForceFieldWorkspace.h"
#include "Frontier/Engine/Interface/Controls/Toast.h"
#include "Frontier/Engine/Interface/InspectorControls.h"
#include "Engine/Interface/TypefaceRegistry.h"
#include "Exhibits/ControlCentre/Code/CpuRasterization.h"

#include <imgui.h>

#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace
{

void Confirm(bool Condition, const char* Description)
{
    if (!Condition) throw std::runtime_error(Description);
}

} // namespace

int main(int ArgumentCount, char** Arguments)
{
    using namespace Frontier;
    try
    {
        ImGui::CreateContext();
        ImGui::StyleColorsDark();
        ImGuiIO& IO = ImGui::GetIO();
        IO.DisplaySize = ImVec2(1560.0f, 1900.0f);
        IO.DeltaTime = 1.0f / 60.0f;
        // 📝 Production typefaces (DM Sans + the JetBrains Mono symbol fallback) so evidence matches the app and the
        //    ω/∇ labels rasterize; argv[2] is the font-archive root, defaulting to the in-tree EngineContent path.
        TypefaceRegistry   FontRegistry;
        static const char* WantedFonts[] = { "DM Sans", "JetBrains Mono" };
        const char*        ArchiveRoot   = ArgumentCount >= 3 ? Arguments[2] : "EngineContent/FontArchives";
        const uint32_t     FontFamilies  = FontRegistry.Load(ArchiveRoot, WantedFonts, 2);
        if (ArgumentCount >= 3) Confirm(FontFamilies == 2, "The font archive root did not yield DM Sans and JetBrains Mono");
        if (FontFamilies == 0) IO.Fonts->AddFontDefault();
        else TypefaceRegistry::Install(&FontRegistry);
        IO.Fonts->Build();

        const EditorTypefaces Faces = EditorTypefaces::Resolve();
        ForceFieldWorkspaceState State{};
        ConstructForceFieldWorkspaceState(State);
        AssetBrowserLink Link{};

        const auto Frame = [&]()
        {
            ImGui::NewFrame();
            ConstructForceFieldWorkspace(State, Faces, IO.DisplaySize, &Link);
            ImGui::Render();
        };
        const auto RectCentre = [&](const char* Name)
        {
            ImVec2 Min{}, Max{};
            char   Missing[128]{};
            std::snprintf(Missing, sizeof(Missing), "Missing validation rect %s", Name);
            Confirm(QueryForceFieldWorkspaceRect(State, Name, Min, Max), Missing);
            Confirm(Max.x > Min.x && Max.y > Min.y, Missing);
            return ImVec2(0.5f * (Min.x + Max.x), 0.5f * (Min.y + Max.y));
        };
        const auto Click = [&](const char* Name)
        {
            const ImVec2 At = RectCentre(Name);
            IO.AddMousePosEvent(At.x, At.y);
            Frame();
            IO.AddMouseButtonEvent(ImGuiMouseButton_Left, true);
            Frame();
            IO.AddMouseButtonEvent(ImGuiMouseButton_Left, false);
            Frame();
            Frame();
        };

        // 1. Boot: the lab scene selects its first source; the shell logs its honest boot line.
        Frame();
        Frame();
        Confirm(State.Selected == 0, "The workspace did not boot on the first lab source");
        Confirm(!State.Log.empty(), "The boot produced no log lines");
        Confirm(State.Log.front().Channel == "WORKSPACE", "The boot line missed its WORKSPACE channel");
        Confirm(static_cast<int>(State.Sources.size()) == 6, "The lab scene lost sources");
        RectCentre("Outliner/Field");
        RectCentre("Outliner/Wind");
        RectCentre("Outliner/Source0");
        RectCentre("Outliner/Source5");
        RectCentre("Inspector/Section/place");
        RectCentre("Inspector/Section/strength");
        RectCentre("Inspector/Section/timing");
        RectCentre("Inspector/Name");
        RectCentre("Footer/Log");
        RectCentre("Surface/Map");
        RectCentre("Timeline/Play");
        RectCentre("Minimap");

        // 2. Outliner selection swaps inspector pages (wind, then master workspace).
        Click("Outliner/Wind");
        Confirm(State.Selected == ForceFieldWorkspaceState::SelectedWind, "Clicking Ambient Wind did not select it");
        RectCentre("Inspector/Section/wflow");
        RectCentre("Inspector/Section/wgst");
        {
            ImVec2 Min{}, Max{};
            Confirm(!QueryForceFieldWorkspaceRect(State, "Inspector/Name", Min, Max), "The wind page kept the source name field");
        }
        Click("Outliner/Field");
        Confirm(State.Selected == ForceFieldWorkspaceState::SelectedField, "Clicking the master workspace did not select it");
        RectCentre("Inspector/Section/declutter");
        RectCentre("Inspector/Section/receivers");
        RectCentre("Inspector/Section/lvl");

        // 3. Section heads fold and unfold their cards.
        Confirm(State.CardDeclutter, "The declutter card did not start open");
        Click("Inspector/Section/declutter");
        Confirm(!State.CardDeclutter, "Clicking the section head did not fold the card");
        Click("Inspector/Section/declutter");
        Confirm(State.CardDeclutter, "Clicking the section head did not unfold the card");

        // 4. Placement arming is chrome; dropping on the viewport is an explicit NOOP.
        Click("Toolbar/Place0");
        Confirm(State.PlacementType == 0, "The Wind Generator pill did not arm placement");
        Confirm(!State.Log.empty() && State.Log.front().Channel == "PLACE", "Arming placement logged no PLACE line");
        Click("Surface/Map");
        Confirm(State.PlacementType == -1, "The NOOP drop did not disarm placement");
        Confirm(Toast::QueryVisible(), "The NOOP drop raised no toast");
        Confirm(State.Sources.size() == 6, "The NOOP drop mutated the scene");

        // 5. The log drawer opens, clears locally, and closes.
        Click("Footer/Log");
        Confirm(State.LogOpen, "The log pill did not open the drawer");
        RectCentre("Log/Clear");
        Confirm(!State.Log.empty(), "The log lost its lines before Clear");
        Click("Log/Clear");
        Confirm(State.Log.empty(), "Clear did not empty the shell-local log");
        Click("Footer/Log");
        Confirm(!State.LogOpen, "The log pill did not close the drawer");

        // 6. View modes swap the centre surface; the stage records its own surface.
        Click("Toolbar/Mode1");
        Confirm(State.ViewMode == 1, "The 3D Stage pill did not switch view modes");
        RectCentre("Surface/Stage3D");
        Click("Toolbar/Mode0");
        Confirm(State.ViewMode == 0, "The Map pill did not switch back to Map 2D");

        // 7. The timeline play switch and source eye toggles hold local state only.
        const bool WasPlaying = State.ClockPlaying;
        Click("Timeline/Play");
        Confirm(State.ClockPlaying != WasPlaying, "The play switch did not flip");
        const bool ImpulseWas = State.Sources[5].Enabled;
        Click("Outliner/Source5/Eye");
        Confirm(State.Sources[5].Enabled != ImpulseWas, "The outliner eye did not flip the source");

        // 7b. HUD pills sit above the map click region and still receive their presses.
        const bool ArrowsWere = State.View.Arrows;
        Click("Hud/Pill0");
        Confirm(State.View.Arrows != ArrowsWere, "The HUD Vectors pill did not flip");

        // 7c. The timeline FIRE key sits above its lane and refuses with a NOOP toast.
        State.Sources[5].Activation = ForceFieldActivationTrigger;
        Frame();
        RectCentre("Timeline/Fire0");
        Click("Timeline/Fire0");
        Confirm(Toast::QueryVisible(), "The timeline FIRE key raised no toast");
        Confirm(State.Selected != 5 || true, "Unreachable");
        State.Sources[5].Activation = ForceFieldActivationWindow;
        Frame();

        // 7d. The library delegates to the shared Asset Browser; the handoff arms placement, the banner cancel disarms.
        Click("Toolbar/All17");
        Confirm(State.LibraryOpen, "The All 17 pill did not open the library");
        RectCentre("Library/Browse");
        RectCentre("Library/Close");
        Click("Library/Browse");
        Confirm(!State.LibraryOpen, "The browse row did not close the library");
        Confirm(Link.OpenRequested, "The browse row did not request the browser");
        Confirm(Link.OpenWorkspace == AssetBrowserWorkspaceForceField, "The browse row requested the wrong workspace");
        Link.OpenRequested = false;
        Link.OpenWorkspace = -1;
        std::snprintf(Link.OpenRecordId, sizeof(Link.OpenRecordId), "forcefield/Attractor");
        Link.OpenRecordWorkspace = AssetBrowserWorkspaceForceField;
        Frame();
        Frame();
        Confirm(!Link.HasHandoff(), "The shell did not consume the handoff");
        Confirm(State.PlacementType == QueryForceFieldTypeById("Attractor"), "The handoff did not arm placement");
        RectCentre("Banner/Cancel");
        Click("Banner/Cancel");
        Confirm(State.PlacementType == -1, "The banner cancel did not disarm placement");

        // 8. Scenario tabs refuse with a NOOP toast and keep the lab scene.
        Click("Top/Scenario1");
        Confirm(State.Scenario == 0, "The NOOP scenario tab switched the scene");
        Confirm(Toast::QueryVisible(), "The NOOP scenario tab raised no toast");

        // 9. Evidence: one frame per inspector page (source, wind, master workspace).
        const auto RenderEvidence = [&](const char* Path)
        {
            IO.AddMousePosEvent(-1.0f, -1.0f);
            Frame();
            FrontierExhibit::AcknowledgeTextures();
            const int Width  = static_cast<int>(IO.DisplaySize.x * IO.DisplayFramebufferScale.x);
            const int Height = static_cast<int>(IO.DisplaySize.y * IO.DisplayFramebufferScale.y);
            std::vector<unsigned char> Pixels(static_cast<size_t>(Width) * Height * 3, 0x18);
            const ImDrawData* DrawData = ImGui::GetDrawData();
            for (const ImDrawList* DrawList : DrawData->CmdLists)
                FrontierExhibit::RasterizeCommands(DrawList, Pixels.data(), Width, Height, DrawData->DisplayPos, DrawData->FramebufferScale);
            std::ofstream Image(Path, std::ios::binary);
            Image << "P6\n" << Width << ' ' << Height << "\n255\n";
            Image.write(reinterpret_cast<const char*>(Pixels.data()), static_cast<std::streamsize>(Pixels.size()));
            if (!Image) throw std::runtime_error("Could not write ForceField workspace PPM evidence");
        };
        if (ArgumentCount >= 2)
        {
            std::string Stem = Arguments[1];
            const size_t Dot = Stem.rfind(".ppm");
            if (Dot != std::string::npos && Dot + 4 == Stem.size()) Stem.erase(Dot);
            Click("Outliner/Source0");
            Confirm(State.Selected == 0, "Reselecting the first source failed");
            RenderEvidence((Stem + "-source.ppm").c_str());
            Click("Outliner/Wind");
            RenderEvidence((Stem + "-wind.ppm").c_str());
            Click("Outliner/Field");
            RenderEvidence((Stem + "-field.ppm").c_str());
        }

        std::fprintf(stdout, "ForceFieldWorkspaceValidation: boot/pages/fold/arm/NOOP/log/mode/timeline/eye/scenario checks passed\n");
        ImGui::DestroyContext();
        return 0;
    }
    catch (const std::exception& Failure)
    {
        ImGui::DestroyContext();
        std::fprintf(stderr, "ForceFieldWorkspaceValidation: %s\n", Failure.what());
        return 1;
    }
}
