/*==========================================================================================================================================
                                                        FLUIDWORKSPACECATALOGUE.CPP
==========================================================================================================================================*/
// 🧩 The Fluid Workspace preset library: the 18 pinned plume presets (names, filter tags, blurbs) from the prototype's
//    PresetPresentation map (Experimental/Fluid/src/SceneSpecification.js). The shell lists them read-only; staging a
//    preset onto the scene is an explicit NOOP.

#include "Engine/Interface/Workspaces/FluidWorkspace.h"

#include <cstring>

namespace Frontier
{
namespace
{

constexpr uint32_t FireColour  = 0xE8823CFF;
constexpr uint32_t SmokeColour = 0x9AA3A8FF;
constexpr uint32_t BlastColour = 0xD84A4AFF;

const FluidWorkspacePreset Presets[18] = {
    { "ue5_pyro_default", "Pyro plume", "fire", "Rolling flame · dark soot", "StudioFlame", FireColour },
    { "oil_well_inferno", "Oil well inferno", "fire", "Pressurised fuel column", "StudioFlame", FireColour },
    { "shrapnel_airburst", "Shrapnel airburst", "blast", "Ballistic smoke streamers", "StudioBlast", BlastColour },
    { "megaton_open_bounds", "Wide-bounds blast", "blast", "Large expanding fireball", "StudioBlast", BlastColour },
    { "tactical_ordnance", "Tactical detonation", "blast", "Flash core · dust cloud", "StudioBlast", BlastColour },
    { "obstacle_deflection", "Smoke deflection", "smoke", "Flow around a collider", "StudioPuff", SmokeColour },
    { "wildfire_tornado", "Wildfire tornado", "fire", "Spiralling emerald fire", "StudioTornado", FireColour },
    { "ashfall_motes", "Ashfall", "smoke", "Drifting smoke & ash", "StudioPuff", SmokeColour },
    { "voxelized_stylized", "Voxel fire", "fire", "Discrete volume shading", "StudioBoxes", FireColour },
    { "dust_tornado", "Dust tornado", "smoke", "Cold debris vortex", "StudioTornado", SmokeColour },
    { "tyre_burnout", "Tyre burnout", "smoke", "Rubber smoke off a ring", "StudioPuff", SmokeColour },
    { "ledge_sandfall", "Ledge sandfall", "smoke", "Sand poured off a slab", "StudioLayers", SmokeColour },
    { "settling_dust", "Settling dust", "smoke", "Slow pale aftermath", "StudioPuff", SmokeColour },
    { "small_gust", "Small gust", "smoke", "Thin haze on a crosswind", "StudioWind", SmokeColour },
    { "brick_fracture_dust", "Brick fracture", "blast", "Cold masonry burst", "StudioFracture", BlastColour },
    { "lantern_flame", "Lantern flame", "fire", "One small steady wick", "StudioFlame", FireColour },
    { "camp_fire", "Camp fire", "fire", "Open wood fire with sparks", "StudioFlame", FireColour },
    { "low_gpu_performance", "Lightweight plume", "fire", "24³ grid · lower GPU cost", "StudioFlame", FireColour },
};

} // namespace

int QueryFluidPresetCount() noexcept
{
    return 18;
}

const FluidWorkspacePreset& QueryFluidPreset(int Index) noexcept
{
    if (Index < 0 || Index >= 18) return Presets[0];
    return Presets[Index];
}

int QueryFluidPresetById(const char* Id) noexcept
{
    if (Id == nullptr) return -1;
    for (int Index = 0; Index < 18; ++Index)
    {
        if (std::strcmp(Presets[Index].Id, Id) == 0) return Index;
    }
    return -1;
}

const char* QueryFluidGroupName(const char* Group) noexcept
{
    if (Group == nullptr) return "All";
    if (std::strcmp(Group, "fire") == 0) return "Fire";
    if (std::strcmp(Group, "smoke") == 0) return "Smoke";
    if (std::strcmp(Group, "blast") == 0) return "Blast";
    return "All";
}

} // namespace Frontier
