#============================================================================================================================================
#                                                       CURVEENGINE.CMAKE
#============================================================================================================================================
# 🧩 Scalar curve profiles, monotone interpolation, `.curvespace` codec, and numerical validation.

if(BUILD_TESTING)
    add_executable(CurveSpaceValidation
        Exhibits/Curves/Code/CurveSpaceValidation.cpp)
    target_include_directories(CurveSpaceValidation PRIVATE
        "${CMAKE_SOURCE_DIR}"
        "${CMAKE_SOURCE_DIR}/ExternalPackages/tomlpp/include")
    target_compile_features(CurveSpaceValidation PRIVATE cxx_std_20)
    add_test(NAME CurveSpaceValidation COMMAND CurveSpaceValidation)
    set_tests_properties(CurveSpaceValidation PROPERTIES TIMEOUT 60)
endif()
