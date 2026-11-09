/*==========================================================================================================================================
                                                             TOGGLETILE.H
==========================================================================================================================================*/
// 🧩 Remastered StudioControls.js ToggleTile: the .toggle-grid feature tiles (glyph chip, label, ON/OFF state).

#pragma once

namespace Frontier
{

class ControlColumn;

struct ToggleTileItem
{
    const char* Label;
    const char* Glyph; // 🧩 Studio glyph name, e.g. "StudioFieldWind".
    bool*       Value;
};

class ToggleTile
{
  public:
    [[nodiscard]] static bool ConstructGrid(ControlColumn& Column, const char* Id, ToggleTileItem* Items, int Count, int Columns = 3,
                                            bool Enabled = true, const char* Tooltip = nullptr);
};

} // namespace Frontier
