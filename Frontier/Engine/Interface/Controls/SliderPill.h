/*==========================================================================================================================================
                                                             SLIDERPILL.H
==========================================================================================================================================*/
// 🧩 Remastered StudioControls.js SliderRow (Fluid ControlPanel::SliderPill): a label over a 92 px black value pill
//    (scrubbable figure plus unit cell) beside a 26 px pill track with a spherical thumb.

#pragma once

namespace Frontier
{

class ControlColumn;

class SliderPill
{
  public:
    [[nodiscard]] static bool Construct(ControlColumn& Column, const char* Id, const char* Label, double& Quantity, double Minimum,
                                        double Maximum, double Step, const char* Unit, bool Enabled = true, const char* Tooltip = nullptr);
};

} // namespace Frontier
