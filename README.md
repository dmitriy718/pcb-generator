# PCB Enclosure Generator

PCB Enclosure Generator is an offline desktop application for generating parametric,
3D-printable electronics enclosures. This repository currently implements a
production-oriented Electron, React, TypeScript, Three.js, validation, export, test,
documentation, and CI foundation with a usable manual PCB workflow.

## Implemented in This Milestone

- Cross-platform Electron desktop shell.
- React parameter editor for manual PCB dimensions and mounting holes.
- KiCad `.kicad_pcb` import for `Edge.Cuts` board outline, board thickness, drilled mounting holes, component-height hints, and common edge connector cutouts.
- SVG PCB outline import for rectangular outlines, viewBox dimensions, and circular mounting holes.
- DXF PCB outline import for LINE/LWPOLYLINE board bounds, `$INSUNITS` scaling, and circular mounting holes.
- STL PCB/reference import for ASCII and binary STL mesh bounds and inferred board thickness.
- STEP PCB/reference import through OpenCascade.js model bounds.
- Built-in board profiles for Raspberry Pi, Arduino, and ESP32 starter enclosures.
- Custom `.pcbboard.json` board profile import/export.
- Manual rectangular connector cutouts on enclosure side walls with generated printable openings.
- Built-in fastener profiles for self-tapping screws and heat-set inserts that drive generated boss geometry.
- Rectangular lid ventilation regions with generated through-slot openings.
- Printability analysis with dimensions, material guidance, and FDM review warnings.
- Versioned `.pcbenc.json` project save/open for full parametric projects.
- Parametric two-piece screw enclosure mesh generation from structured dimensions.
- Material tolerance profiles for PLA, PETG, ABS, ASA, TPU, CF PLA, and Nylon.
- Three.js real-time preview.
- Validation with actionable user-facing errors.
- OpenCascade.js-backed STEP, STL, OBJ, GLTF, and 3MF export for base shell, lid,
  standoffs, screw bosses, connector cutouts, rectangular vents, editable chamfers,
  and selective outer fillets when chamfers are disabled.
- SVG drawing, DXF drawing, and BOM CSV export plus MakerWorld metadata JSON.
- Strict TypeScript, ESLint, Prettier, Vitest, Docker development environment, and GitHub Actions CI/release workflows.
- Versioned plugin manifest API plus declarative JSON package loading for approved
  board-library and enclosure-template contributions.
- Offline design assistant that converts common natural-language enclosure phrases into
  editable material, cutout, vent, and lid-feature parameters.
- Enclosure template presets for compact, handheld, tall-clearance, wall-mount, and
  desktop project-box variants of the validated two-piece screw case, including a
  rounded handheld template that exercises validated OpenCascade outer fillets and a
  wall-mount template with generated editable through-hole features.

## Current Scope

The current implementation intentionally does not claim cloud LLM integration,
automated connector recognition for all imports, arbitrary plugin code execution, or
full enclosure-template coverage. Those are tracked in the roadmap and should be added
feature by feature with tests and documentation.

## Design Assistant

The renderer includes an offline prompt box that maps common phrases such as `USB-C on
the left`, `OLED`, `speaker holes`, `ventilation`, `rounded`, `handheld`, and material
names into normal editable project parameters. Generated assistant changes appear in
the same connector, ventilation, material, and design-feature editors as manual
changes. The shared assistant also exposes an optional provider interface for local or
cloud parsers; provider output is constrained to a structured intent object and still
flows through the same editable parameter generator.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run smoke:electron
```

## Packaging

```bash
npm run package:linux
npm run package:win
npm run package:mac
```

Packaging uses Electron Builder. Tagged GitHub releases require Windows signing and
macOS signing/notarization secrets; manual workflow runs can still build unsigned test
artifacts.

See [docs/deployment.md](docs/deployment.md) for CI packaging, release, signing, and
Docker development details.

## Export Workflow

1. Launch the app.
2. Import a KiCad `.kicad_pcb`, SVG, DXF, STL, or STEP file, or edit PCB dimensions, mounting holes, connector cutouts, material, and enclosure dimensions.
3. Resolve validation issues.
4. Save the editable project as `.pcbenc.json` when needed.
5. Export STEP, 3MF, STL, OBJ, GLTF, SVG drawing, DXF drawing, or BOM CSV. STEP and
   mesh manufacturing exports are generated from validated OpenCascade solids.
6. The app writes a matching `.makerworld.json` file containing print recommendations,
   orientation, material, support status, and assembly guidance.

## Bambu SD Card Workflow

Bambu Lab printer SD cards store sliced printer instructions such as `.gcode` files.
This app exports CAD/model assets and MakerWorld metadata, not raw printer G-code.
For direct SD-card printing, export 3MF/STL from this app, slice it in Bambu Studio or
a compatible slicer with the target printer/material profile, then copy the slicer's
generated `.gcode` to the SD card.

## Project Files

Projects are saved as versioned `.pcbenc.json` files containing the full editable
parameter model. Files are schema-validated and geometry-validated on open so malformed
or unsupported projects fail with explicit errors instead of silently loading bad data.

## KiCad Import Scope

The current importer supports common KiCad S-expression files with board outlines on
`Edge.Cuts` using `gr_line`, `gr_rect`, `gr_circle`, `gr_arc`, and matching footprint
graphics. It detects board thickness from `(thickness ...)` entries and mounting holes
from drilled `np_thru_hole` or `thru_hole` pads inside `footprint` or legacy `module`
blocks. It also infers maximum component height from explicit footprint height
properties and common connector/header footprint names, then creates starter enclosure
cutouts for common edge connectors such as USB-C, Micro USB, USB-A/B, HDMI, Ethernet,
SMA, barrel jacks, buttons, and switches. These imported cutouts are editable and must
still be verified against the physical PCB before production printing.

## SVG Import Scope

SVG import supports offline PCB outline files with either `width`/`height`, a `viewBox`,
a rectangular `<rect>` outline, or common `<path>` outlines using `M`, `L`, `H`, `V`,
`A`, `C`, `S`, `Q`, `T`, and `Z` commands. Circular mounting holes are detected from
`<circle>` elements whose `id` or `class` contains `hole` or `mount`. The importer
supports `mm`, `cm`, `in`, and `px` units.

## DXF Import Scope

DXF import supports offline PCB outline files containing `LINE`, `ARC`, `LWPOLYLINE`,
or `SPLINE` entities on outline-like layers such as `Edge.Cuts`, `outline`, `board`,
or `pcb`.
It reads `$INSUNITS` for inch, millimeter, centimeter, and meter scaling, infers board
dimensions from outline bounds, and detects circular mounting holes on hole-like layers
or small circles inside the board bounds. `LWPOLYLINE` bulge values are expanded when
measuring rounded board outlines. `SPLINE` entities with degree, knot, control-point,
and optional weight data are sampled as NURBS curves; incomplete splines fall back to
control/fit point bounds and produce a verification warning. Mechanical STEP feature
detection remains a future importer milestone.

## STL Import Scope

STL import supports offline ASCII and binary STL files as PCB/reference geometry. STL
does not contain PCB semantics, units, layers, holes, or connector metadata, so the
importer infers board width, height, and thickness from mesh bounds in millimeters and
adds warnings for users to verify or manually define mounting holes, connectors, and
component clearances. Tall mechanical references are treated as populated assemblies:
the importer keeps PCB thickness near the detected board slab or 1.6 mm default and
stores the remaining height as component clearance instead of making the PCB itself
unrealistically thick. The parser preserves triangle grouping and facet normals for
future high-confidence mesh feature detection.

## STEP Import Scope

STEP import uses OpenCascade.js offline to read `.step` and `.stp` geometry and infer
board width, height, and thickness from model bounds. Generic STEP files do not provide
reliable PCB semantic labels for holes, connectors, or components, so those features
must be verified or added manually after import. When OpenCascade cannot transfer STEP
topology and the importer falls back to STEP text coordinates, paired circular edges on
both board faces are imported as high-confidence mounting holes. Named
`CARTESIAN_POINT`, `AXIS2_PLACEMENT_3D`, `SHAPE_REPRESENTATION`, and linked `PRODUCT`
definition placements near board edges are also mapped to editable connector cutout
candidates for common USB, Ethernet, HDMI, SMA, barrel jack, button, and switch labels.
Nested `REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION` assemblies using
`ITEM_DEFINED_TRANSFORMATION` axis frames are composed before connector placement
checks. Tall STEP references use the same populated-assembly inference as STL imports
so enclosure internal height can be raised without corrupting PCB board thickness.

## Board Library

The built-in board library currently includes starter profiles for Raspberry Pi 5,
Raspberry Pi 4 Model B, Raspberry Pi Zero 2 W, Raspberry Pi Pico, Arduino Uno R3,
Arduino Mega 2560 R3, Arduino Nano, ESP32 DevKit V1, ESP32-S3-DevKitC-1,
BeagleBone Black, NVIDIA Jetson Orin Nano DevKit Carrier, M5Stack Core2, HackRF One,
LimeSDR Mini, and RTL-SDR Blog V3. Profiles set PCB dimensions, mounting holes where
applicable, and starter connector cutouts. Clone boards and module revisions vary;
verify physical dimensions before final prints.

Custom board profiles can be saved from the current PCB geometry and imported later as
versioned `.pcbboard.json` files.

Applying a board profile replaces the PCB definition and clears existing lid
ventilation and design features. This avoids silently carrying board-specific lid
geometry into a different mounting-hole pattern where it could collide with screw
bosses.

## Connector Cutouts

Manual connector cutouts are rectangular openings on the front, back, left, or right
base wall. Offset is measured along the selected wall span, and Z center is measured
from the enclosure bottom. Validation prevents cutouts from extending outside the wall
span or below the floor.

## Fastener Profiles

Built-in fastener profiles include M2, M2.5, and M3 self-tapping screws plus M2.5 and
M3 heat-set insert starter dimensions and short/long insert presets. Selecting a
profile updates standoff diameter, standoff pilot hole, boss diameter, screw hole,
insert socket dimensions, lead-in relief dimensions, and recommended standoff height.
Profiles are validated against minimum radial wall requirements.

## Ventilation

Ventilation regions are editable rectangular lid areas that generate a grid of
rectangular through-slots in the lid mesh. Region placement is validated against the
lid wall boundary, and slot dimensions are validated before export. The design
palette also provides honeycomb-style vent presets plus fan and speaker grille
presets that generate repeated through-cut feature patterns.

## Design Feature Palette

The Design Features palette adds editable lid features for display openings, button
holes, antenna holes, speaker grilles, fan grilles, label recesses, QR recesses,
logo badges, cable slots, and zip-tie anchors. Each feature is stored as structured
parameters with operation, shape, position, size, depth, radius, spacing, rows,
columns, and optional label text. Through-cuts and recesses remove lid material;
embosses add raised geometry. Text engraving features use an offline 5x7 vector-module
alphabet for real recessed or raised text geometry. QR recesses with text generate
true QR module geometry in OpenCascade production exports. Logo badge features generate
real geometry from a small offline logo catalog keyed by the text value: `OSHW`, `PCB`,
`RF`, and `BAMBU`. SVG logo import supports offline rect/circle SVG primitives and
stores them as normalized editable logo badge footprints used by preview and
OpenCascade exports. Complex SVG paths remain future importer work.

Validation checks lid feature placement against wall boundaries, ventilation regions,
other design features, and screw boss footprints using the selected material
clearance. Invalid overlaps produce actionable messages before preview generation or
export.

## STEP Export Scope

STEP export uses OpenCascade.js to generate validated B-rep solids for the base shell,
interior cavity, cylindrical standoffs, cylindrical screw bosses, rectangular connector
openings, lid plate, rectangular lid vent cutouts, lid design feature cut/recess/emboss
geometry, heat-set insert sockets with material-compensated lead-in reliefs, editable
chamfers, and selective outer fillets. Fillets are applied only to blank outer base/lid
bodies before cutouts and feature booleans, keeping functional openings sharp and easier
to print.

OpenCascade.js is bundled as an offline WebAssembly dependency under LGPL-2.1-only.
Generated user models are not licensed by the dependency.

## Drawing Exports

SVG and DXF exports include a top view with enclosure, PCB, and mounting-hole geometry
plus a front elevation with front-wall connector cutouts. DXF output uses millimeter
units and separates major entities into layers for downstream CAD review.

## BOM Export

BOM CSV export includes printed enclosure parts, primary filament, selected fastener
hardware, heat-set inserts when applicable, and connector-opening finishing steps.
Quantities are derived from the current mounting-hole and connector-cutout parameters.

## Printability Analysis

The inspector and exported metadata include a printability report with outer dimensions,
orientation guidance, Bambu profile hints, support status, and FDM review warnings for
risky wall thicknesses, large side openings, dense vents, and heat-set insert bosses.

## License

MIT
