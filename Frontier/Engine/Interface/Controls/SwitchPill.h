/*==========================================================================================================================================
                                                             SWITCHPILL.H
==========================================================================================================================================*/
// 🧩 Remastered StudioControls.js SwitchRow: a label plus detail beside the 44x25 high-contrast pill toggle (.switch).

#pragma once

namespace Frontier
{

class ControlColumn;

class SwitchPill
{
  public:
    [[nodiscard]] static bool Construct(ControlColumn& Column, const char* Id, const char* Label, const char* Detail, bool& InOut,
                                        bool Enabled = true, const char* Tooltip = nullptr);
};

} // namespace Frontier
