# Roadmap

Development proceeds milestone by milestone. Each milestone must remain buildable,
tested, documented, and usable before moving on.

## Completed

1. Project setup, architecture, build system, linting, testing, CI foundation.
2. Initial parametric geometry path for a manual PCB and two-piece screw enclosure.
3. Three.js preview and STL/OBJ/3MF export for the initial generator.
4. KiCad `.kicad_pcb` import for board outline, thickness, and drilled mounting holes.
5. Manual rectangular side-wall connector cutout editor with real mesh openings.
6. SVG and DXF drawing export for top view, mounting holes, and front cutout elevation.
7. Built-in starter board profiles for Raspberry Pi, Arduino, and ESP32 boards.
8. Versioned `.pcbenc.json` project save/open.
9. Built-in self-tapping screw and heat-set insert fastener profiles.
10. BOM CSV export from material, fastener, mounting-hole, and cutout parameters.
11. GLTF 2.0 mesh export with embedded buffers and manufacturing metadata extras.
12. Rectangular lid ventilation region editor with real mesh through-slots.
13. Rule-based FDM printability analysis in UI and export metadata.
14. Custom `.pcbboard.json` board profile import/export.
15. SVG PCB outline import for rectangular outlines and circular mounting holes.
16. Native-platform GitHub Actions package/release workflow and Docker development environment.
17. OpenCascade.js B-rep generation and validation for the two-piece screw enclosure.
18. OpenCascade.js STEP export for validated base and lid solids.
19. OpenCascade.js-derived STL/OBJ/GLTF/3MF mesh export with topology validation.
20. Editable OpenCascade chamfers for generated base and lid solids.
21. Heat-set insert socket geometry in preview and OpenCascade production exports.
22. ASCII and binary STL PCB/reference import from mesh bounds.
23. OpenCascade STEP PCB/reference import from model bounds.
24. Palette-driven lid design features for display/button/antenna openings, speaker
    and fan grille patterns, label/QR recesses, logo badges, cable slots, and
    zip-tie anchors with preview and OpenCascade export support.
25. Collision/interference validation between lid design features, ventilation
    regions, screw boss footprints, and lid wall boundaries.
26. QR recess features with true generated QR module geometry in preview footprints
    and OpenCascade production exports.
27. Text engraving features with a built-in offline 5x7 vector-module alphabet and
    OpenCascade production export support.
28. KiCad importer component-height hints and common edge connector cutout detection
    for USB, Ethernet, HDMI, SMA, barrel jack, button, and switch footprints.
29. Material-aware heat-set insert lead-in reliefs and additional short/long insert
    preset profiles in preview, BOM, validation, and OpenCascade exports.
30. Built-in logo badge geometry catalog for editable OSHW, PCB, RF, and Bambu-style
    logo marks in preview and OpenCascade exports.
31. Shared STL/STEP mechanical-reference inference that separates tall populated
    assemblies into board thickness and component-height clearance with orientation
    and unit-confidence warnings.
32. STL importer triangle-topology preservation for ASCII and binary meshes, retaining
    triangle grouping and facet normals before future high-confidence feature detection.
33. Expanded built-in board library with additional Raspberry Pi, Arduino, ESP32,
    BeagleBone, Jetson, M5Stack, and SDR starter profiles validated by domain tests.
34. Versioned plugin manifest API and capability registry for offline connector,
    board, fastener, enclosure, vent, exporter, and material extension discovery.
35. Offline natural-language design assistant that converts supported enclosure phrases
    into editable material, connector cutout, vent, and lid-feature parameters in the GUI.
36. SVG logo import for rect/circle primitives, persisted as normalized editable logo
    badge footprints and exported through the OpenCascade production geometry path.
37. High-confidence STEP text fallback mounting-hole detection from paired circular
    curves spanning both board faces.
38. Enclosure template preset registry and GUI selector for compact, rounded handheld,
    tall-clearance, wall-mount, and desktop project-box two-piece screw-case variants.
39. Declarative plugin package loader for approved board-library and enclosure-template
    JSON contributions with manifest registration and domain validation.
40. Optional assistant provider interface for local/cloud prompt parsers, constrained to
    structured intent output that still generates editable validated parameters.
41. Release signing gate for tagged Windows/macOS builds, passing Electron Builder
    signing and Apple notarization credentials from GitHub Actions secrets.
42. Runtime-verified selective OpenCascade outer fillets for blank base/lid bodies when
    chamfers are disabled, with degenerate tessellation artifacts filtered before mesh
    topology validation.
43. DXF importer support for `ARC` outline entities and `LWPOLYLINE` bulge arcs, with
    rounded board bounds covered by importer regression tests.
44. SVG PCB outline path import for common `M`, `L`, `H`, `V`, `A`, and `Z` commands,
    including relative line paths and elliptical arc rounded-corner outlines.
45. Conservative DXF `SPLINE` outline import from control/fit point bounds with
    user-facing verification warnings and regression coverage.
46. STEP text fallback connector candidate detection from named `CARTESIAN_POINT` and
    `AXIS2_PLACEMENT_3D` placements near board edges for common connector labels.
47. SVG PCB outline Bezier path import for sampled `C`, `S`, `Q`, and `T` commands,
    including smooth-control reflection semantics.
48. DXF `SPLINE` outline NURBS sampling from degree, knot, control-point, and optional
    weight data, with conservative warning fallback only for incomplete spline records.
49. STEP text fallback connector detection through `SHAPE_REPRESENTATION` item names and
    linked `PRODUCT` definition to shape-representation placement relationships.
50. Rounded handheld enclosure template hardened against the OpenCascade production mesh
    path with selective outer fillets enabled and topology regression coverage.
51. STEP text fallback assembly transform composition for nested
    `REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION` connector placements using
    `ITEM_DEFINED_TRANSFORMATION` axis frames.
52. Wall-mount enclosure template hardened with generated editable through-hole features
    and OpenCascade topology regression coverage.
53. Desktop project-box template hardened with generated editable label-recess and rear
    cable-slot features, plus lid CAD ordering that chamfers the stable blank before
    cutting vents and editable lid features.
54. Portable handheld template added with generated editable lanyard and status-light
    through-cut openings, OpenCascade topology regression coverage, and GUI template
    application feedback when validation needs review.
55. Battery-access two-piece template added with generated editable battery-tray recess
    and cable-exit features, project-file schema support, palette access, and
    OpenCascade topology regression coverage.
56. SVG and DXF technical drawings now include lid ventilation slots and editable lid
    feature footprints/labels in addition to enclosure, PCB, mounting-hole, and front
    cutout geometry.
57. Lid feature validation and palette placement hardened so patterned features report
    one actionable overlap per feature pair and palette presets search for a clear lid
    location before adding new vents or design features.
58. Shared lid-placement utility and GUI auto-arrange command added so crowded existing
    design-feature layouts can be repositioned into available lid space with regression
    coverage.
59. Lid auto-arrange extended to ventilation regions and design features together, so
    feature-versus-vent collisions in existing projects can be resolved by the same GUI
    recovery action.
60. Validation inspector now groups repeated issue messages with affected paths and
    repeat counts, reducing overlap-report noise while keeping exact editable fields
    visible.
61. Enclosure template metadata now identifies family, closure, and validated production
    path, and the GUI selector groups templates by family with selected-template
    context.
62. DIN-rail backplate starter template added with editable raised rail-rib features,
    palette access, project-file schema support, and OpenCascade topology regression
    coverage.
63. Magnetic closure profile added with validated base/lid magnet pocket geometry,
    material-compensated OpenCascade exports, BOM polarity guidance, printability
    guidance, and regression coverage.
64. Machine-screw clearance profiles added for M2.5 and M3 hardware, including
    validated geometry parameters, matching receiver BOM guidance, and regression
    coverage.
65. Assembly SVG drawing export added with base/PCB/lid layout, closure callouts,
    connector checks, material/print settings, manufacturing checklist text, GUI
    access, and regression coverage.

## Next Milestones

1. Graduate additional enclosure families from presets into independent validated
   generators.
2. Add richer UI controls for selecting validated enclosure families once their
   production geometry paths are available.
