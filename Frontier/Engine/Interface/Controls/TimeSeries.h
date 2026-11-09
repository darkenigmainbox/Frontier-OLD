/*==========================================================================================================================================
                                                             TIMESERIES.H
==========================================================================================================================================*/
// 🧩 Remastered StudioControls.js TimeSeries: the hero sparkline (dashed target, filled series, −10 s / −5 s / now).

#pragma once

#include <imgui.h>

namespace Frontier
{

class ControlColumn;
struct EditorTypefaces;

class TimeSeries
{
  public:
    static void Construct(ControlColumn& Column, const double* Samples, int Count, int Capacity, double Target, float Height,
                          bool Enabled = true, double Headroom = 1.2);
    static void ConstructAt(ImDrawList* DrawList, const EditorTypefaces& Faces, float Scale, ImVec2 Min, float Width, float Height,
                            const double* Samples, int Count, int Capacity, double Target, bool Enabled = true, double Headroom = 1.2);
};

} // namespace Frontier
