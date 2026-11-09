/*==========================================================================================================================================
                                                            SEGMENTEDROW.CPP
==========================================================================================================================================*/
// 🧩 Remastered StudioControls.js SegmentedRow: a 12 px label over the joined pill track (.segmented-track: padding 4,
//    gap 4, radius 999; active option #292929, idle text #828282).

#include "Engine/Interface/Controls/SegmentedRow.h"

#include "Engine/Interface/Controls/ControlColumn.h"
#include "Engine/Interface/Controls/GlyphRun.h"
#include "Engine/Interface/InspectorControls.h"

namespace Frontier
{

//------------------------------------------------------------------------------------------------------------------------
//                                                    SEGMENTED ROW
//------------------------------------------------------------------------------------------------------------------------

bool SegmentedRow::Construct(ControlColumn& Column, const char* Id, const char* Label, const char* const* Options, int Count,
                             int& InOutIndex, bool Enabled, const char* Tooltip)
{
    const ControlTheme&    Theme    = Column.QueryTheme();
    const EditorTypefaces& Faces    = Column.QueryFaces();
    ImDrawList* const      DrawList = Column.QueryDrawList();
    const float            S        = Column.QueryScale();
    const float            Width    = Column.QueryWidth();
    if (Count <= 0 || Options == nullptr) return false;
    if (InOutIndex < 0 || InOutIndex >= Count) InOutIndex = 0;
    const float Fade = Enabled ? 1.0f : 0.42f;

    const ImVec2 Head = Column.Space(17.0f, 0.0f, 7.0f);
    (void)GlyphRun::Construct(Column, Faces.Regular, 12.0f * S, ImVec2(Head.x, GlyphRun::ResolveBaseline(Head.y, 12.0f * S, 1.4f)),
                              FadeColour(Theme.ControlLabel, Fade), Label);

    constexpr float TrackTall = 35.0f;
    constexpr float Pad       = 4.0f;
    constexpr float Gap       = 4.0f;
    const ImVec2    Top       = Column.Space(TrackTall, 0.0f, 15.0f);
    const ImVec2    TrackMax(Top.x + Width, Top.y + TrackTall * S);
    DrawList->AddRectFilled(Top, TrackMax, FadeColour(Theme.SelectFill, Fade), 0.5f * TrackTall * S);
    DrawList->AddRect(Top, TrackMax, FadeColour(Theme.SelectBorder, Fade), 0.5f * TrackTall * S, ImDrawFlags_None, S);

    const float  Wide   = (Width - 2.0f * Pad * S - Gap * S * static_cast<float>(Count - 1)) / static_cast<float>(Count);
    const float  Tall   = (TrackTall - 2.0f * Pad) * S;
    const int    Before = InOutIndex;
    ImGui::PushID(Id);
    for (int Index = 0; Index < Count; ++Index)
    {
        const ImVec2 Min(Top.x + Pad * S + static_cast<float>(Index) * (Wide + Gap * S), Top.y + Pad * S);
        const ImVec2 Max(Min.x + Wide, Min.y + Tall);
        ImGui::SetCursorScreenPos(Min);
        ImGui::PushID(Index);
        if (!Enabled) ImGui::BeginDisabled();
        if (ImGui::InvisibleButton("##Segment", ImVec2(Wide, Tall), ImGuiButtonFlags_EnableNav) && Enabled) InOutIndex = Index;
        if (ImGui::IsItemHovered(ImGuiHoveredFlags_AllowWhenDisabled)) ControlColumn::ConstructTooltip(Tooltip);
        if (!Enabled) ImGui::EndDisabled();
        ImGui::PopID();
        const bool Chosen = Index == InOutIndex;
        if (Chosen) DrawList->AddRectFilled(Min, Max, FadeColour(Theme.SegmentFill, Fade), 0.5f * Tall);
        const float Advance = GlyphRun::Measure(Column, Faces.Regular, 11.0f * S, Options[Index]);
        const float LineTop = Min.y + 0.5f * (Tall - 11.0f * 1.38f * S);
        (void)GlyphRun::Construct(Column, Faces.Regular, 11.0f * S,
                                  ImVec2(Min.x + 0.5f * (Wide - Advance), GlyphRun::ResolveBaseline(LineTop, 11.0f * S, 1.38f)),
                                  FadeColour(Chosen ? Theme.SegmentText : Theme.SegmentIdle, Fade), Options[Index]);
    }
    ImGui::PopID();
    return InOutIndex != Before;
}

} // namespace Frontier
