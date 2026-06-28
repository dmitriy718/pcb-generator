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

## Next Milestones

1. Add rounded/display/button cutout variants and collision checks.
2. Expand KiCad importer with component-height and connector detection.
3. Add STEP import support and richer mechanical reference geometry detection.
4. Add material-aware heat-set insert lead-in chamfers and vendor preset libraries.
5. Add honeycomb vents, fan grills, and speaker grills.
6. Add selective fillets where they improve ergonomics without hurting printability.
7. Add additional enclosure templates one at a time.
8. Expand board profile library coverage.
9. Add plugin API.
10. Add AI-assisted parameter generation with inspectable output.
11. Add release signing, notarization, and publishing automation.
