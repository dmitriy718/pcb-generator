# Architecture Overview

The application is organized by responsibility:

- `src/main`: Electron main process, native dialogs, filesystem export.
- `src/preload`: Narrow IPC bridge exposed to the renderer.
- `src/renderer`: React UI and Three.js preview.
- `src/shared/domain`: Project schema, material profiles, and validation.
- `src/shared/boards`: Built-in PCB profile catalog.
- `src/shared/boards/boardProfileFile.ts`: Custom board profile file parsing and validation.
- `src/shared/fasteners`: Built-in fastener and insert profile catalog.
- `src/shared/cad`: Parametric mesh generation, mesh validation, and CAD-kernel integration.
- `src/shared/exporters`: Deterministic text exporters and manufacturing metadata.
- `src/shared/importers`: Offline file importers such as KiCad PCB S-expression parsing, SVG/DXF outline parsing, and STL mesh bounds import.
- `src/shared/projectFiles`: Versioned project file serialization and validation.
- `src/shared/printability`: Parameter-derived FDM printability analysis.
- `tests`: Unit and integration-style tests for domain, CAD, and exports.
- `.github/workflows`: CI verification and native-platform package/release automation.

The renderer owns UI state as one `EnclosureProject`. Validation, preview geometry,
manufacturing metadata, and exports are derived from that project. This avoids drift
between form state and generated geometry.

## CAD Engine

The current engine has two CAD paths:

- A deterministic triangle-mesh generator for real-time preview.
- An OpenCascade.js WebAssembly backend for B-rep validation, STEP export, and
  production mesh tessellation.

The mesh path creates:

- Base shell with floor and walls.
- Rectangular side-wall connector cutouts by segmenting wall geometry around openings.
- Rectangular lid ventilation slots by segmenting lid geometry around openings.
- Hollow standoff tubes aligned to PCB mounting holes.
- Lid panel.
- Hollow screw bosses.

The OpenCascade backend lives in `src/shared/cad/kernel`. It currently generates the
base shell, interior cavity, rectangular connector cutouts, cylindrical standoffs,
cylindrical screw bosses, heat-set insert sockets, lid plate, rectangular lid vent
cutouts, and editable edge chamfers as validated B-rep solids. It writes STEP through
OpenCascade's STEP writer and validates each transferred solid with
`BRepCheck_Analyzer` before export.

Mesh file exports for STL, OBJ, GLTF, and 3MF are tessellated from the same validated
OpenCascade solids. The backend runs OpenCascade incremental meshing, extracts face
triangulations, flips reversed face orientations, and rejects invalid topology before
writing mesh-based manufacturing files.

The kernel path intentionally remains isolated from the renderer. The Electron main
process invokes it for STEP export, while the renderer continues to receive lightweight
triangle meshes for interactive preview. Future kernel work should add heat-set insert
lead-in chamfers, selective fillets, and richer enclosure templates.

## Drawing Exporters

SVG and DXF drawing exporters are parameter-derived 2D outputs, not viewport captures.
They include enclosure footprint, internal cavity, PCB outline, mounting holes, and
front-wall connector cutouts for quick review in browsers, CAD tools, and slicer notes.

BOM export is also parameter-derived. It uses the selected material profile, fastener
profile, mounting-hole count, and connector cutouts to generate a CSV procurement and
assembly checklist.

GLTF export emits a portable glTF 2.0 JSON file with embedded mesh buffers and
manufacturing metadata in `extras` for downstream preview and catalog workflows.

Printability analysis is shared between the UI and exporters. It does not invoke a
slicer; it reports deterministic rule-based risks and recommendations from the current
parameter model.

## IPC Boundary

The renderer cannot write files directly. It calls preload methods:

- `validateProject(project)`
- `saveProjectFile(project)`
- `openProjectFile()`
- `exportProject(project, format)`
- `importKiCadProject()`
- `importSvgProject()`
- `importDxfProject()`

The main process regenerates the enclosure before export, preventing stale preview
geometry from being saved.
