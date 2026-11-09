# CurveSpace foundation

`Frontier/Engine/Foundation/Curves/CurveSpace.h` starts the Phase 4 engine/data layer without curve-editor UI. It provides
scalar `CurveProfile<double>` evaluation with clamped piecewise linear, cubic Hermite, and monotonic PCHIP interpolation;
transactional key validation; fixed-size uniform lookup-table baking; and a `SpaceCodec` schema for `.curvespace` files.

## Verification

The standalone validation checks interpolation bounds, uneven PCHIP monotonicity, invalid-key rejection and transactionality,
lookup-table baking, codec round trips, invalid TOML rejection, and the required `.curvespace` extension.

```sh
g++ -std=c++20 -Wall -Wextra -Wpedantic \
  -I. -IExternalPackages/tomlpp/include \
  Exhibits/Curves/Code/CurveSpaceValidation.cpp -o /tmp/CurveSpaceValidation
/tmp/CurveSpaceValidation
```

Expected: `CurveSpaceValidation: 26 of 26 checks passed`.

## Not yet implemented

- Non-scalar curve value traits and integration into Physics, ForceField, Particle, Fluid, and Visual Effects.
- `EffectSpace`, the `VisualEffects/` pipeline, motion/distortion targets, or GPU effect evaluations.
- Curve authoring UI. It remains deferred until the engine/extension foundation is approved.
