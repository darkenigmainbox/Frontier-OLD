// Photometric workspace validation: the U5 UI shell (rig tab bar, luminaire + environment outliner, quick
// photometry chips, lens/camera HUD, luminaire stage, diurnal transport, console drawer, light + environment
// inspectors, IES goniometer matrix, add-light drawer) with scripted pointer interaction and PPM evidence per
// scenario. Value controls hold shell-local figures and log PARAM lines; engine-bound commands raise NOOP toasts
// and warm log lines and change nothing.

#include "Frontier/Engine/Interface/Workspaces/PhotometricWorkspace.h"
#include "Frontier/Engine/Interface/Controls/Toast.h"
#include "Frontier/Engine/Interface/InspectorControls.h"
#include "Engine/Interface/TypefaceRegistry.h"
#include "Exhibits/ControlCentre/Code/CpuRasterization.h"

#include <imgui.h>

#include <cmath>
#include <cstdio>
#include <cstring>
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
        // 📝 Production typefaces (DM Sans + the JetBrains Mono symbol fallback) so evidence matches the app;
        //    argv[2] is the font-archive root, defaulting to the in-tree EngineContent path.
        TypefaceRegistry   FontRegistry;
        static const char* WantedFonts[] = { "DM Sans", "JetBrains Mono" };
        const char*        ArchiveRoot   = ArgumentCount >= 3 ? Arguments[2] : "EngineContent/FontArchives";
        const uint32_t     FontFamilies  = FontRegistry.Load(ArchiveRoot, WantedFonts, 2);
        if (ArgumentCount >= 3) Confirm(FontFamilies == 2, "The font archive root did not yield DM Sans and JetBrains Mono");
        if (FontFamilies == 0) IO.Fonts->AddFontDefault();
        else TypefaceRegistry::Install(&FontRegistry);
        IO.Fonts->Build();

        const EditorTypefaces Faces = EditorTypefaces::Resolve();
        PhotometricWorkspaceState State{};
        ConstructPhotometricWorkspaceState(State);

        const auto Frame = [&]()
        {
            ImGui::NewFrame();
            ConstructPhotometricWorkspace(State, Faces, IO.DisplaySize);
            ImGui::Render();
        };
        const auto RectCentre = [&](const char* Name)
        {
            ImVec2 Min{}, Max{};
            char   Missing[128]{};
            std::snprintf(Missing, sizeof(Missing), "Missing validation rect %s", Name);
            Confirm(QueryPhotometricWorkspaceRect(State, Name, Min, Max), Missing);
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

        // 1. Boot: the studio opens on the ECE low beam with the default rig (roadway tab highlighted but not
        //    applied); catalogues hold pinned order.
        Frame();
        Frame();
        Confirm(QueryPhotometricLightSpecCount() == 7, "The light-type catalogue lost entries");
        Confirm(QueryPhotometricMeasuredIesCount() == 7, "The measured IES catalogue lost entries");
        Confirm(std::strcmp(QueryPhotometricMeasuredIes(0), "LowBeam") == 0, "LowBeam is out of order");
        Confirm(std::strcmp(QueryPhotometricMeasuredIes(4), "Area") == 0, "Area is out of order");
        Confirm(QueryPhotometricPresetIesCount() == 8, "The Project Zero catalogue lost entries");
        Confirm(std::strcmp(QueryPhotometricPresetIes(2), "Batwing") == 0, "Batwing is out of order");
        Confirm(std::strcmp(QueryPhotometricPresetIes(3), "ECE Low Beam") == 0, "ECE Low Beam is out of order");
        Confirm(QueryPhotometricMoonCount() == 6, "The moon catalogue lost entries");
        Confirm(State.Selected == 0, "The workspace did not boot on the ECE low beam");
        Confirm(State.Scenario == PhotometricWorkspaceState::ScenarioRoadway, "The workspace did not boot the roadway tab");
        Confirm(State.Camera == PhotometricWorkspaceState::CameraOrbit, "The workspace did not boot the orbit camera");
        Confirm(std::fabs(State.Sun.LocalHours - 14.5) < 1.0e-9, "The workspace did not boot at 14:30 site time");
        Confirm(State.Log.size() == 1, "The boot produced the wrong number of log lines");
        Confirm(State.Log.front().Channel == "RIG", "The boot line missed its RIG channel");
        {
            const double Census = QueryPhotometricCensusLumens(State.Lights, 8);
            Confirm(std::fabs(Census - 11220.0) < 0.5, "The default census missed 11.22 klm");
            const double Lux = QueryPhotometricWallLux(State.Lights, 8);
            Confirm(Lux > 57.0 && Lux < 59.0, "The wall-screen estimate left its 57-59 lx band");
            Confirm(State.SunSolved.ElevationDeg > 41.0 && State.SunSolved.ElevationDeg < 42.0,
                    "The 14:30 sun left its 41-42° band");
        }

        // 2. Outliner: luminaire rows select silently; eye keys toggle visibility and the census follows.
        Click("Outliner/Light4");
        Confirm(State.Selected == 4, "Clicking the softbox did not select it");
        Click("Outliner/Light7");
        Confirm(State.Selected == 7, "Clicking the strip did not select it");
        Click("Outliner/Eye7");
        Confirm(!State.Lights[7].Visible, "The strip eye did not hide the strip");
        Confirm(std::fabs(QueryPhotometricCensusLumens(State.Lights, 8) - 7980.0) < 0.5,
                "The census did not drop the hidden strip");
        Click("Outliner/Eye7");
        Confirm(State.Lights[7].Visible, "The strip eye did not restore the strip");
        Click("Outliner/Light0");

        // 3. Outliner: environment rows select their celestial pages.
        for (int I = 0; I < 7; ++I)
        {
            char RowTag[32]{};
            std::snprintf(RowTag, sizeof(RowTag), "Outliner/Env%d", I);
            Click(RowTag);
            char Missing[64]{};
            std::snprintf(Missing, sizeof(Missing), "Environment row %d did not select", I);
            Confirm(State.Selected == PhotometricWorkspaceState::SelectedEnvDome + I, Missing);
            Frame();
        }
        Click("Outliner/Light0");

        // 4. Rigs: each tab resets the rig and the environment, then stages its preset.
        Click("TopBar/Rig1");
        Confirm(State.Scenario == PhotometricWorkspaceState::ScenarioGallery, "The gallery tab did not stage");
        Confirm(State.Selected == 2, "The gallery rig missed the downlight");
        Confirm(std::fabs(State.Dome.SkylightIntensity - 0.72) < 1.0e-9, "The gallery IBL missed 0.72x");
        Confirm(std::fabs(QueryPhotometricCensusLumens(State.Lights, 8) - 6030.0) < 0.5,
                "The gallery census missed 6.03 klm");
        Click("TopBar/Rig2");
        Confirm(State.Scenario == PhotometricWorkspaceState::ScenarioStudio, "The studio tab did not stage");
        Confirm(!State.Sun.Enabled, "The studio rig left the sun enabled");
        Confirm(State.SunSolved.ElevationDeg > 55.0, "The noon sun left its high band");
        Confirm(std::fabs(QueryPhotometricCensusLumens(State.Lights, 8) - 9690.0) < 0.5,
                "The studio census missed 9.69 klm");
        Click("TopBar/Rig3");
        Confirm(State.Scenario == PhotometricWorkspaceState::ScenarioLunar, "The lunar tab did not stage");
        Confirm(State.Selected == PhotometricWorkspaceState::SelectedMoon, "The lunar field missed the moon");
        Confirm(State.Moon.Visible && std::fabs(State.Moon.Brightness - 2.6) < 1.0e-9,
                "The lunar field missed its moonlight");
        Confirm(std::fabs(QueryPhotometricCensusLumens(State.Lights, 8) - 1400.0) < 0.5,
                "The lunar census missed 1.40 klm");
        Click("TopBar/Rig0");
        Confirm(State.Sun.Enabled, "The roadway rig did not restore the sun");
        Confirm(std::fabs(QueryPhotometricCensusLumens(State.Lights, 8) - 5190.0) < 0.5,
                "The restored roadway census missed 5.19 klm");

        // 5. Stage HUD: lens, camera, dark-room, and gizmo keys flip shell-local state silently.
        Click("Stage/Lens1");
        Confirm(State.Lens == PhotometricWorkspaceState::LensLux, "The lux lens did not engage");
        Click("Stage/Lens0");
        Confirm(State.Lens == PhotometricWorkspaceState::LensPbr, "The PBR lens did not restore");
        Click("Stage/Cam2");
        Confirm(State.Camera == PhotometricWorkspaceState::CameraWall, "The wall-screen camera did not engage");
        Click("Stage/Cam3");
        Confirm(State.Camera == PhotometricWorkspaceState::CameraRoadway, "The roadway camera did not restore");
        Click("Stage/DarkRoom");
        Confirm(!State.DarkRoom, "The dark-room key did not open the sky");
        Click("Stage/DarkRoom");
        Confirm(State.DarkRoom, "The dark-room key did not close the sky");
        Click("Stage/Gizmos");
        Confirm(!State.ShowGizmos, "The volumetrics key did not hide the cones");
        Click("Stage/Gizmos");
        Confirm(State.ShowGizmos, "The volumetrics key did not restore the cones");

        // 6. Inspector: all fifteen pages construct without tripping a NOOP.
        {
            const int NoopsBefore = State.NoopCount;
            for (int I = 0; I < 15; ++I)
            {
                if (I < 8)
                {
                    char RowTag[32]{};
                    std::snprintf(RowTag, sizeof(RowTag), "Outliner/Light%d", I);
                    Click(RowTag);
                }
                else
                {
                    char RowTag[32]{};
                    std::snprintf(RowTag, sizeof(RowTag), "Outliner/Env%d", I - 8);
                    Click(RowTag);
                }
                if (I < 8)
                {
                    (void)RectCentre("Inspector/Duplicate");
                    (void)RectCentre("Inspector/Delete");
                }
                Frame();
            }
            Confirm(State.NoopCount == NoopsBefore, "Rendering inspector pages tripped a NOOP");
        }
        Click("Outliner/Light0");

        // 7. Quick photometry: the moon chip swaps the rig, the isolux chip toggles the lens.
        Click("Quick/Chip3");
        Confirm(State.Scenario == PhotometricWorkspaceState::ScenarioLunar, "The night-moon chip missed the lunar rig");
        Click("Quick/Chip0");
        Confirm(State.Scenario == PhotometricWorkspaceState::ScenarioRoadway, "The low-beam chip missed the roadway rig");
        Click("Quick/Chip4");
        Confirm(State.Lens == PhotometricWorkspaceState::LensLux, "The isolux chip did not engage the lux lens");
        Click("Quick/Chip4");
        Confirm(State.Lens == PhotometricWorkspaceState::LensPbr, "The isolux chip did not restore the PBR lens");

        // 8. Add drawer: every type key refuses with a NOOP and leaves the rig at eight luminaires.
        Click("Outliner/Add");
        Confirm(State.AddDrawerOpen, "The add key did not open the drawer");
        {
            const int NoopsBefore = State.NoopCount;
            Click("AddDrawer/Type2");
            Confirm(State.NoopCount == NoopsBefore + 1, "Adding an IES light did not NOOP");
            Click("AddDrawer/Type5");
            Confirm(State.NoopCount == NoopsBefore + 2, "Adding an LED did not NOOP");
            Confirm(State.Log.front().Channel == "ADD", "The add refusal missed its ADD channel");
        }
        Click("AddDrawer/Close");
        Confirm(!State.AddDrawerOpen, "The drawer close key did not dismiss the drawer");

        // 9. Transport: play, step, and reset drive the diurnal clock and the ephemeris follows.
        Click("Transport/Play");
        Confirm(State.SweepPlaying, "The sweep did not start playing");
        Click("Transport/Play");
        Confirm(!State.SweepPlaying, "The sweep did not pause");
        Click("Transport/StepFwd");
        Confirm(std::fabs(State.Sun.LocalHours - 22.2) < 1.0e-9, "The step-forward key missed 22:12");
        Click("Transport/StepBack");
        Click("Transport/StepBack");
        Confirm(std::fabs(State.Sun.LocalHours - 20.2) < 1.0e-9, "The step-back key missed 20:12");
        Click("Transport/Reset");
        Confirm(std::fabs(State.Sun.LocalHours - 12.0) < 1.0e-9, "The reset key missed solar noon");
        Confirm(!State.SweepPlaying, "The reset key left the sweep playing");
        Click("Transport/Play");
        Click("Transport/Reset");

        // 10. Console: the drawer opens above the transport and Clear empties the log.
        Click("Transport/Console");
        Confirm(State.ConsoleOpen, "The console key did not open the drawer");
        Frame();
        Click("Console/Clear");
        Confirm(State.Log.empty(), "Clear did not empty the console log");
        Click("Transport/Console");
        Confirm(!State.ConsoleOpen, "The console key did not close the drawer");

        // 11. Entity keys: duplicate and delete refuse; the selection holds.
        Click("Outliner/Light2");
        {
            const int NoopsBefore = State.NoopCount;
            Click("Inspector/Duplicate");
            Confirm(State.NoopCount == NoopsBefore + 1, "Duplicating the downlight did not NOOP");
            Confirm(State.Selected == 2, "The refused duplicate moved the selection");
            Click("Inspector/Delete");
            Confirm(State.NoopCount == NoopsBefore + 2, "Deleting the downlight did not NOOP");
            Confirm(State.Selected == 2, "The refused delete moved the selection");
        }

        // 12. Top bar: file and suite keys refuse; the goniometer opens the matrix.
        {
            const int NoopsBefore = State.NoopCount;
            Click("TopBar/Load");
            Confirm(State.NoopCount == NoopsBefore + 1, "Load .ies did not NOOP");
            Click("TopBar/ExportIes");
            Confirm(State.NoopCount == NoopsBefore + 2, "Export .ies did not NOOP");
            Click("TopBar/ExportRig");
            Confirm(State.NoopCount == NoopsBefore + 3, "Export rig did not NOOP");
            Click("TopBar/Suite0");
            Confirm(State.NoopCount == NoopsBefore + 4, "The suite link did not NOOP");
            Confirm(State.Log.front().Channel == "SCENE", "The suite refusal missed its SCENE channel");
        }
        Click("TopBar/Goniometer");
        Confirm(State.MatrixOpen, "The goniometer key did not open the matrix");
        Click("Matrix/Close");
        Confirm(!State.MatrixOpen, "The matrix close key did not dismiss the sheet");

        // 13. IES matrix: measured and synthetic tiles re-curve the selected IES light.
        Click("Outliner/Light0");
        Click("TopBar/Goniometer");
        Click("Matrix/Tile1");
        Confirm(!State.MatrixOpen, "The HighBeam tile did not dismiss the sheet");
        Confirm(State.Lights[0].Props.UseMeasuredIes, "The HighBeam tile did not stage a measured curve");
        Confirm(State.Lights[0].Props.MeasuredProfile == 1, "The HighBeam tile missed profile 1");
        Confirm(State.Log.front().Channel == "IES", "The curve assignment missed its IES channel");
        Click("TopBar/Goniometer");
        Click("Matrix/Tile9");
        Confirm(!State.Lights[0].Props.UseMeasuredIes, "The Batwing tile did not stage a synthetic curve");
        Confirm(State.Lights[0].Props.PresetProfile == 2, "The Batwing tile missed preset 2");
        Click("TopBar/Rig0");

        // 14. Evidence: one frame per showcase state.
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
            if (!Image) throw std::runtime_error("Could not write Photometric workspace PPM evidence");
        };
        // 📝 Settle: let the NOOP toasts expire so the evidence frames show the bare workspace.
        for (int I = 0; I < 360; ++I) Frame();
        if (ArgumentCount >= 2)
        {
            std::string Stem = Arguments[1];
            const size_t Dot = Stem.rfind(".ppm");
            if (Dot != std::string::npos && Dot + 4 == Stem.size()) Stem.erase(Dot);
            ConstructPhotometricWorkspaceState(State);
            Frame();
            RenderEvidence((Stem + "-overview.ppm").c_str());
            Click("Stage/Lens1");
            RenderEvidence((Stem + "-lux.ppm").c_str());
            Click("TopBar/Rig1");
            Click("Outliner/Light2");
            Click("Stage/Lens0");
            RenderEvidence((Stem + "-gallery.ppm").c_str());
            Click("TopBar/Rig3");
            Click("Outliner/Env2");
            RenderEvidence((Stem + "-lunar.ppm").c_str());
        }

        std::fprintf(stdout, "PhotometricWorkspaceValidation: boot/select/rigs/stage/inspector/quick/add/transport/console/entity/topbar/matrix checks passed\n");
        ImGui::DestroyContext();
        return 0;
    }
    catch (const std::exception& Failure)
    {
        ImGui::DestroyContext();
        std::fprintf(stderr, "PhotometricWorkspaceValidation: %s\n", Failure.what());
        return 1;
    }
}
