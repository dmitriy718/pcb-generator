# PCB Enclosure Generator

PCB Enclosure Generator is an offline desktop application for generating parametric,
3D-printable electronics enclosures. This repository currently implements milestone 1:
a production-oriented Electron, React, TypeScript, Three.js, validation, export, test,
documentation, and CI foundation with a usable manual PCB workflow.

## Implemented in This Milestone

- Cross-platform Electron desktop shell.
- React parameter editor for manual PCB dimensions and mounting holes.
- KiCad `.kicad_pcb` import for `Edge.Cuts` board outline, board thickness, and drilled mounting holes.
- SVG PCB outline import for rectangular outlines, viewBox dimensions, and circular mounting holes.
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
- STL, OBJ, GLTF, 3MF, SVG drawing, DXF drawing, and BOM CSV export plus MakerWorld metadata JSON.
- Strict TypeScript, ESLint, Prettier, Vitest, Docker development environment, and GitHub Actions CI/release workflows.

## Current Scope

The current implementation intentionally does not claim STEP, plugin, AI, or full
enclosure-template coverage. Those are tracked in the roadmap and should be added
feature by feature with tests and documentation.

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
```

## Packaging

```bash
npm run package:linux
npm run package:win
npm run package:mac
```

Packaging uses Electron Builder. Platform-specific signing and notarization should be
configured before public binary releases.

See [docs/deployment.md](docs/deployment.md) for CI packaging, release, signing, and
Docker development details.

## Export Workflow

1. Launch the app.
2. Import a KiCad `.kicad_pcb` file or edit PCB dimensions, mounting holes, connector cutouts, material, and enclosure dimensions.
3. Resolve validation issues.
4. Save the editable project as `.pcbenc.json` when needed.
5. Export 3MF, STL, OBJ, GLTF, SVG drawing, DXF drawing, or BOM CSV.
6. The app writes a matching `.makerworld.json` file containing print recommendations,
   orientation, material, support status, and assembly guidance.

## Project Files

Projects are saved as versioned `.pcbenc.json` files containing the full editable
parameter model. Files are schema-validated and geometry-validated on open so malformed
or unsupported projects fail with explicit errors instead of silently loading bad data.

## KiCad Import Scope

The current importer supports common KiCad S-expression files with board outlines on
`Edge.Cuts` using `gr_line`, `gr_rect`, `gr_circle`, `gr_arc`, and matching footprint
graphics. It detects board thickness from `(thickness ...)` entries and mounting holes
from drilled `np_thru_hole` or `thru_hole` pads inside `footprint` or legacy `module`
blocks. Component-height and connector detection are future importer milestones.

## SVG Import Scope

SVG import supports offline PCB outline files with either `width`/`height`, a `viewBox`,
or a rectangular `<rect>` outline. Circular mounting holes are detected from `<circle>`
elements whose `id` or `class` contains `hole` or `mount`. The importer supports `mm`,
`cm`, `in`, and `px` units. Complex paths are future SVG importer work.

## Board Library

The built-in board library currently includes starter profiles for Raspberry Pi 4
Model B, Raspberry Pi Pico, Arduino Uno R3, Arduino Nano, and ESP32 DevKit V1. Profiles
set PCB dimensions, mounting holes where applicable, and starter connector cutouts.
Clone boards vary; verify physical dimensions before final prints.

Custom board profiles can be saved from the current PCB geometry and imported later as
versioned `.pcbboard.json` files.

## Connector Cutouts

Manual connector cutouts are rectangular openings on the front, back, left, or right
base wall. Offset is measured along the selected wall span, and Z center is measured
from the enclosure bottom. Validation prevents cutouts from extending outside the wall
span or below the floor.

## Fastener Profiles

Built-in fastener profiles include M2, M2.5, and M3 self-tapping screws plus M2.5 and
M3 heat-set insert starter dimensions. Selecting a profile updates standoff diameter,
standoff pilot hole, boss diameter, screw hole, and recommended standoff height.
Profiles are validated against minimum radial wall requirements.

## Ventilation

Ventilation regions are editable rectangular lid areas that generate a grid of
rectangular through-slots in the lid mesh. Region placement is validated against the
lid wall boundary, and slot dimensions are validated before export. Honeycomb, fan
grill, and speaker grill patterns are future geometry milestones.

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
