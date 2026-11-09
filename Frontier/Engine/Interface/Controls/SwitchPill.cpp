/*==========================================================================================================================================
                                                             SWITCHPILL.CPP
==========================================================================================================================================*/
// 🧩 Remastered StudioControls.js SwitchRow: a copy block (12 px label, 10 px detail) beside the 44x25 pill toggle
//    (.switch): idle #232323 with a #bcbcbc knob, checked white with a #111111 knob.

#include "Engine/Interface/Controls/SwitchPill.h"

#include "Engine/Interface/Controls/ControlColumn.h"
#include "Engine/Interface/Controls/GlyphRun.h"
#include "Engine/Interface/InspectorControls.h"

namespace Frontier
{

//------------------------------------------------------------------------------------------------------------------------
//                                                    SWITCH PILL
//------------------------------------------------------------------------------------------------------------------------

bool SwitchPill::Construct(ControlColumn& Column, const char* Id, const char* Label, const char* Detail, bool& InOut, bool Enabled,
                           const char* Tooltip)
{
    const ControlTheme&    Theme    = Column.QueryTheme();
    const EditorTypefaces& Faces    = Column.QueryFaces();
    ImDrawList* const      DrawList = Column.QueryDrawList();
    const float            S        = Column.QueryScale();
    const float            Width    = Column.QueryWidth();
    const float            Fade     = Enabled ? 1.0f : 0.42f;
    const bool             Elaborated = Detail != nullptr && Detail[0] != '\0';

    constexpr float SwitchWide = 44.0f;
    constexpr float SwitchTall = 25.0f;
    const float     RowTall    = Elaborated ? 34.0f : 28.0f;
    const ImVec2    Top        = Column.Space(RowTall, 0.0f, 15.0f);

    const float LabelTop = Top.y + (Elaborated ? 0.0f : 0.5f * (RowTall * S - 12.0f * 1.4f * S));
    (void)GlyphRun::Construct(Column, Faces.Regular, 12.0f * S, ImVec2(Top.x, GlyphRun::ResolveBaseline(LabelTop, 12.0f * S, 1.4f)),
                              FadeColour(Theme.ControlLabel, Fade), Label);
    if (Elaborated)
    {
        const float DetailTop = LabelTop + 12.0f * 1.4f * S + 2.0f * S;
        (void)GlyphRun::Construct(Column, Faces.Regular, 10.0f * S, ImVec2(Top.x, GlyphRun::ResolveBaseline(DetailTop, 10.0f * S, 1.4f)),
                                  FadeColour(Theme.Caption, Fade), Detail);
    }

    const ImVec2 SwitchMin(Top.x + Width - SwitchWide * S, Top.y + 0.5f * (RowTall * S - SwitchTall * S));
    const ImVec2 SwitchMax(SwitchMin.x + SwitchWide * S, SwitchMin.y + SwitchTall * S);
    ImGui::PushID(Id);
    ImGui::SetCursorScreenPos(SwitchMin);
    if (!Enabled) ImGui::BeginDisabled();
    const bool Flipped = ImGui::InvisibleButton("##Switch", ImVec2(SwitchWide * S, SwitchTall * S), ImGuiButtonFlags_EnableNav) && Enabled;
    if (ImGui::IsItemHovered(ImGuiHoveredFlags_AllowWhenDisabled)) ControlColumn::ConstructTooltip(Tooltip);
    if (!Enabled) ImGui::EndDisabled();
    ImGui::PopID();
    if (Flipped) InOut = !InOut;

    DrawList->AddRectFilled(SwitchMin, SwitchMax, FadeColour(InOut ? Theme.SwitchOn : Theme.SwitchOff, Fade), 0.5f * SwitchTall * S);
    DrawList->AddRect(SwitchMin, SwitchMax, FadeColour(InOut ? Theme.SwitchOn : Theme.PillBorder, Fade), 0.5f * SwitchTall * S,
                      ImDrawFlags_None, S);
    const ImVec2 Knob(SwitchMin.x + (InOut ? 25.0f : 2.0f) * S + 9.5f * S, SwitchMin.y + 2.0f * S + 9.5f * S);
    DrawList->AddCircleFilled(Knob, 9.5f * S, FadeColour(InOut ? Theme.KnobOn : Theme.KnobOff, Fade), 32);
    return Flipped;
}

} // namespace Frontier
