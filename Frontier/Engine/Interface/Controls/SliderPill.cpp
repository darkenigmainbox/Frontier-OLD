/*==========================================================================================================================================
                                                             SLIDERPILL.CPP
==========================================================================================================================================*/
// 🧩 Remastered StudioControls.js SliderRow (Fluid ControlPanel::SliderPill): a 12 px label over a 28 px row holding a
//    92 px black value pill (57 px scrubbable figure, 34 px unit cell) beside a 26 px pill track with a 24 px spherical
//    thumb. The figure types, scrubs horizontally (Shift fine, Alt coarse), and the track drags.

#include "Engine/Interface/Controls/SliderPill.h"

#include "Engine/Interface/Controls/ControlColumn.h"
#include "Engine/Interface/Controls/GlyphRun.h"
#include "Engine/Interface/InspectorControls.h"

#include <imgui_internal.h>

#include <algorithm>
#include <cmath>
#include <cstdio>

namespace Frontier
{

namespace
{

[[nodiscard]] int ResolvePillDigits(double Step) noexcept
{
    if (!(Step > 0.0)) return 2;
    if (Step >= 1.0) return 0;
    if (Step >= 0.1) return 1;
    if (Step >= 0.01) return 2;
    return 3;
}

[[nodiscard]] double SnapPill(double Raw, double Minimum, double Maximum, double Step, int Digits) noexcept
{
    const double Clamped = std::clamp(Raw, Minimum, Maximum);
    const double Stepped = Step > 0.0 ? std::round(Clamped / Step) * Step : Clamped;
    const double Precision = std::pow(10.0, Digits + 2);
    return std::round(std::clamp(Stepped, Minimum, Maximum) * Precision) / Precision;
}

} // namespace

//------------------------------------------------------------------------------------------------------------------------
//                                                    SLIDER PILL
//------------------------------------------------------------------------------------------------------------------------

bool SliderPill::Construct(ControlColumn& Column, const char* Id, const char* Label, double& Quantity, double Minimum, double Maximum,
                           double Step, const char* Unit, bool Enabled, const char* Tooltip)
{
    const ControlTheme&    Theme    = Column.QueryTheme();
    const EditorTypefaces& Faces    = Column.QueryFaces();
    ImDrawList* const      DrawList = Column.QueryDrawList();
    const float            S        = Column.QueryScale();
    const float            Width    = Column.QueryWidth();
    if (!(Maximum > Minimum)) return false;
    Quantity      = std::clamp(Quantity, Minimum, Maximum);
    const float Fade   = Enabled ? 1.0f : 0.42f;
    const int   Digits = ResolvePillDigits(Step);
    bool        Moved  = false;

    const ImVec2 Head = Column.Space(17.0f, 0.0f, 7.0f);
    (void)GlyphRun::Construct(Column, Faces.Regular, 12.0f * S, ImVec2(Head.x, GlyphRun::ResolveBaseline(Head.y, 12.0f * S, 1.4f)),
                              FadeColour(Theme.ControlLabel, Fade), Label);

    // 📝 .slider-control: 28 px row; .value-pill 92 px; gap 10 px; .pill-range fills the rest at 26 px.
    constexpr float RowTall  = 28.0f;
    constexpr float PillWide = 92.0f;
    constexpr float Gap      = 10.0f;
    constexpr float TrackTall = 26.0f;
    const ImVec2    Top      = Column.Space(RowTall, 0.0f, 15.0f);
    const ImVec2    PillMax(Top.x + PillWide * S, Top.y + RowTall * S);
    DrawList->AddRectFilled(Top, PillMax, FadeColour(Theme.PillFill, Fade), 14.0f * S);
    DrawList->AddRect(Top, PillMax, FadeColour(Theme.PillBorder, Fade), 14.0f * S, ImDrawFlags_None, S);

    const ImVec2 NumberMin(Top.x, Top.y + 1.0f * S);
    const ImVec2 NumberMax(Top.x + 58.0f * S, Top.y + 27.0f * S);
    const ImVec2 CellMin(Top.x + 58.0f * S, Top.y);
    const ImVec2 CellMax(Top.x + PillWide * S, Top.y + RowTall * S);
    DrawList->PushClipRect(Top, PillMax, true);
    DrawList->AddRectFilled(CellMin, CellMax, FadeColour(ResolveCssColour(0x171717FF), Fade));
    DrawList->AddLine(ImVec2(CellMin.x, Top.y + 4.0f * S), ImVec2(CellMin.x, Top.y + 24.0f * S),
                      FadeColour(ResolveCssColour(0xFFFFFF14), Fade), S);
    DrawList->PopClipRect();
    const char* UnitText = (Unit != nullptr && Unit[0] != '\0') ? Unit : "--";
    const float UnitWide = GlyphRun::Measure(Column, Faces.Regular, 9.5f * S, UnitText);
    const float UnitTop  = Top.y + 0.5f * (RowTall * S - 9.5f * 1.4f * S);
    (void)GlyphRun::Construct(Column, Faces.Regular, 9.5f * S,
                              ImVec2(CellMin.x + 0.5f * (34.0f * S - UnitWide), GlyphRun::ResolveBaseline(UnitTop, 9.5f * S, 1.4f)),
                              FadeColour(Theme.SliderUnit, Fade), UnitText);

    char Figure[48]{};
    std::snprintf(Figure, sizeof(Figure), "%.*f", Digits, Quantity);
    const float FigureWide = GlyphRun::Measure(Column, Faces.Regular, 11.5f * S, Figure);
    const float FigureTop  = Top.y + 0.5f * (RowTall * S - 11.5f * 1.38f * S);

    ImGui::PushID(Id);
    if (!Enabled) ImGui::BeginDisabled();
    // 📝 The figure: click to type, horizontal drag to scrub (Fluid drag-scrubbing: span per 180 px).
    const ImGuiID FigureId = ImGui::GetID("##PillFigure");
    bool          Typing   = ImGui::TempInputIsActive(FigureId);
    ImGui::SetCursorScreenPos(NumberMin);
    ImGui::InvisibleButton("##PillFigure", ImVec2(NumberMax.x - NumberMin.x, NumberMax.y - NumberMin.y), ImGuiButtonFlags_EnableNav);
    if (ImGui::IsItemHovered(ImGuiHoveredFlags_AllowWhenDisabled)) ControlColumn::ConstructTooltip(Tooltip);
    const bool Scrubbing = Enabled && ImGui::IsItemActive() && ImGui::IsMouseDragging(ImGuiMouseButton_Left, 3.0f);
    if (Enabled && ImGui::IsItemActive() && ImGui::IsMouseReleased(ImGuiMouseButton_Left) && !Scrubbing &&
        ImGui::GetIO().MouseDragMaxDistanceSqr[ImGuiMouseButton_Left] < 9.0f)
    {
        Typing = true;
    }
    if (Scrubbing)
    {
        const float Span   = static_cast<float>(Maximum - Minimum);
        const float Factor = ImGui::GetIO().KeyShift ? 0.15f : (ImGui::GetIO().KeyAlt ? 4.0f : 1.0f);
        const double Next  = SnapPill(Quantity + (ImGui::GetIO().MouseDelta.x / 180.0f) * Span * Factor, Minimum, Maximum, Step, Digits);
        if (Next != Quantity)
        {
            Quantity = Next;
            Moved    = true;
        }
    }
    if (Typing && Enabled && !Scrubbing)
    {
        double Display = Quantity;
        char   Format[16]{};
        std::snprintf(Format, sizeof(Format), "%%.%df", Digits);
        ImGui::PushStyleColor(ImGuiCol_FrameBg, ResolveCssColour(0x00000000));
        ImGui::PushStyleColor(ImGuiCol_Text, Theme.SliderNumber);
        ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, 7.0f * S);
        if (ImGui::TempInputScalar(ImRect(NumberMin, NumberMax), FigureId, "##PillEntry", ImGuiDataType_Double, &Display, Format,
                                   nullptr, nullptr) &&
            std::isfinite(Display))
        {
            const double Next = SnapPill(Display, Minimum, Maximum, Step, Digits);
            Moved    = Next != Quantity;
            Quantity = Next;
        }
        ImGui::PopStyleVar();
        ImGui::PopStyleColor(2);
    }
    else if (!Typing)
    {
        (void)GlyphRun::Construct(Column, Faces.Regular, 11.5f * S,
                                  ImVec2(NumberMin.x + 0.5f * (58.0f * S - FigureWide),
                                         GlyphRun::ResolveBaseline(FigureTop, 11.5f * S, 1.38f)),
                                  FadeColour(Theme.SliderNumber, Fade), Figure);
    }

    // 📝 The track: thumb-aware split at 12 px + (width - 24 px) x fraction, 24 px spherical thumb.
    const ImVec2 TrackMin(Top.x + (PillWide + Gap) * S, Top.y + 0.5f * (RowTall - TrackTall) * S);
    const ImVec2 TrackMax(Top.x + Width, TrackMin.y + TrackTall * S);
    const float  TrackWide = std::max(1.0f, TrackMax.x - TrackMin.x);
    const float  Fraction  = static_cast<float>((Quantity - Minimum) / (Maximum - Minimum));
    const float  Split     = TrackMin.x + 12.0f * S + (TrackWide - 24.0f * S) * Fraction;
    ImGui::SetCursorScreenPos(ImVec2(TrackMin.x, TrackMin.y - 1.0f * S));
    ImGui::InvisibleButton("##PillTrack", ImVec2(TrackWide, TrackTall * S + 2.0f * S), ImGuiButtonFlags_EnableNav);
    if (ImGui::IsItemHovered(ImGuiHoveredFlags_AllowWhenDisabled)) ControlColumn::ConstructTooltip(Tooltip);
    if (Enabled && ImGui::IsItemActive() && ImGui::IsMouseDown(ImGuiMouseButton_Left))
    {
        const float Share = std::clamp((ImGui::GetIO().MousePos.x - (TrackMin.x + 12.0f * S)) / std::max(1.0f, TrackWide - 24.0f * S), 0.0f, 1.0f);
        const double Next = SnapPill(Minimum + Share * (Maximum - Minimum), Minimum, Maximum, Step, Digits);
        if (Next != Quantity)
        {
            Quantity = Next;
            Moved    = true;
        }
    }
    if (!Enabled) ImGui::EndDisabled();
    ImGui::PopID();

    DrawList->AddRectFilled(TrackMin, TrackMax, FadeColour(Theme.TrackEmpty, Fade), 13.0f * S);
    if (Split > TrackMin.x + 12.0f * S + 0.5f)
    {
        DrawList->PushClipRect(TrackMin, ImVec2(Split, TrackMax.y), true);
        DrawList->AddRectFilled(TrackMin, TrackMax, FadeColour(Theme.TrackFull, Fade), 13.0f * S);
        DrawList->PopClipRect();
    }
    else if (Split > TrackMin.x + 0.5f)
    {
        DrawList->PushClipRect(TrackMin, ImVec2(TrackMin.x + 24.0f * S, TrackMax.y), true);
        DrawList->AddRectFilled(TrackMin, TrackMax, FadeColour(Theme.TrackFull, Fade), 13.0f * S);
        DrawList->PopClipRect();
    }
    DrawList->AddCircleFilled(ImVec2(Split, TrackMin.y + 0.5f * TrackTall * S), 12.0f * S, FadeColour(Theme.ThumbFill, Fade), 32);
    return Moved;
}

} // namespace Frontier
