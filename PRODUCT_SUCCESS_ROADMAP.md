# Product Success Roadmap

## Phase 1: Product Foundation and Trust

### 1. Replace Mesh Primitives With a Validated CAD Kernel
- **Description:** Integrate OpenCascade.js or a CadQuery-compatible backend for B-rep solids, booleans, fillets, chamfers, and STEP export.
- **Why it matters commercially:** Professional users will not trust enclosures generated only from hand-built triangle meshes.
- **User benefit:** More reliable geometry, editable CAD exports, better slicer compatibility, and fewer failed prints.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Add CAD-kernel abstraction; port two-piece screw case; add boolean cutouts; add fillets/chamfers; export STEP; add geometry regression tests.
- **Dependencies or risks:** OpenCascade.js bundle size, boolean robustness, worker-thread performance, licensing review.

### 2. Add Real Geometry Validity Checks
- **Description:** Validate watertightness, manifold edges, normals, self-intersections, wall thickness, and disconnected shells before export.
- **Why it matters commercially:** Failed slices and bad prints destroy trust quickly.
- **User benefit:** Users get actionable errors before wasting filament.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Add mesh topology analyzer; add wall-thickness sampling; add export validation gate; add fixture models with known failures.
- **Dependencies or risks:** Requires robust geometry algorithms or third-party validators.

### 3. Fix Developer Launch Reliability
- **Description:** Ensure `npm ci && npm run dev` reliably installs and launches Electron without manual `require('electron')` workaround.
- **Why it matters commercially:** Contributors and evaluators need a clean first-run experience.
- **User benefit:** Faster onboarding and fewer setup failures.
- **Implementation difficulty:** Medium
- **Expected impact:** High
- **Suggested implementation steps:** Investigate Electron postinstall behavior; add `postinstall` script if needed; document headless flags; add CI smoke launch check.
- **Dependencies or risks:** Platform differences in Electron binary download and sandbox/GPU behavior.

### 4. Add Product Branding Assets
- **Description:** Provide application icons, installer artwork, About dialog, version info, and app metadata.
- **Why it matters commercially:** Unsigned default-Electron-looking apps feel unfinished.
- **User benefit:** Easier recognition in launchers, installers, and release assets.
- **Implementation difficulty:** Low
- **Expected impact:** Medium
- **Suggested implementation steps:** Create icon set; configure electron-builder icons; add author/homepage; add app metadata tests.
- **Dependencies or risks:** Requires brand design decisions.

### 5. Establish Release Signing and Notarization
- **Description:** Configure Windows Authenticode signing and macOS Developer ID signing/notarization.
- **Why it matters commercially:** Unsigned apps trigger warnings and block adoption.
- **User benefit:** Safer install experience.
- **Implementation difficulty:** Medium
- **Expected impact:** High
- **Suggested implementation steps:** Acquire certificates; store secrets in GitHub; configure electron-builder signing; add notarization workflow.
- **Dependencies or risks:** Certificate cost, Apple account requirements, CI secret management.

## Phase 2: Usability and Workflow Improvements

### 6. Add Onboarding Project Wizard
- **Description:** Guide users through board source, dimensions, material, fastener, cutouts, and export goals.
- **Why it matters commercially:** New users need quick success in the first five minutes.
- **User benefit:** Less confusion and fewer invalid parameter combinations.
- **Implementation difficulty:** Medium
- **Expected impact:** High
- **Suggested implementation steps:** Add wizard modal; prefill from board profiles; validate step-by-step; link to preview state.
- **Dependencies or risks:** Must not hide advanced controls from power users.

### 7. Add Interactive Cutout Placement in the Viewport
- **Description:** Let users drag connector openings directly on the wall instead of typing offsets.
- **Why it matters commercially:** Visual editing is easier to demo and sell.
- **User benefit:** Faster connector alignment and fewer numeric mistakes.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Add selectable wall faces; add transform handles; snap to board/edge references; sync to parameters.
- **Dependencies or risks:** Three.js picking and CAD coordinate mapping complexity.

### 8. Add Measurement and Dimension Tools
- **Description:** Implement point-to-point measurements, bounding boxes, and dimension overlays.
- **Why it matters commercially:** Engineering users expect measurement before export.
- **User benefit:** Confidence that generated geometry matches board and connector requirements.
- **Implementation difficulty:** Medium
- **Expected impact:** High
- **Suggested implementation steps:** Add raycast picking; dimension labels; keyboard shortcuts; tests for coordinate transforms.
- **Dependencies or risks:** Requires reliable viewport interaction model.

### 9. Add Project Autosave and Recent Files
- **Description:** Keep autosave snapshots and quick access to recent `.pcbenc.json` projects.
- **Why it matters commercially:** Prevents lost work and improves daily use.
- **User benefit:** Safer iterative workflows.
- **Implementation difficulty:** Medium
- **Expected impact:** Medium
- **Suggested implementation steps:** Add local app data store; add recent files menu; add autosave recovery prompt.
- **Dependencies or risks:** Cross-platform app data path handling.

### 10. Add Import Correction Workflow
- **Description:** After KiCad/SVG import, show detected outline, holes, and warnings with approve/edit controls.
- **Why it matters commercially:** Importers are imperfect; correction UX makes them usable.
- **User benefit:** Users can fix importer mistakes without restarting.
- **Implementation difficulty:** Medium
- **Expected impact:** High
- **Suggested implementation steps:** Add import review panel; highlight imported entities; allow delete/edit/add; save import log.
- **Dependencies or risks:** Requires richer entity model for imported features.

## Phase 3: MakerWorld, Bambu Lab, and Creator-Focused Features

### 11. Add Bambu Studio Profile Export
- **Description:** Generate printer/material/profile recommendation files or 3MF metadata compatible with Bambu workflows.
- **Why it matters commercially:** Bambu users are a high-value target market.
- **User benefit:** Faster path from enclosure design to successful print.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Study Bambu 3MF conventions; encode plate names/orientations; validate in Bambu Studio manually and with fixtures.
- **Dependencies or risks:** Bambu metadata conventions may change and may not be fully documented.

### 12. Add MakerWorld Listing Pack Generator
- **Description:** Export model files, preview images, metadata, BOM, print settings, and assembly instructions as a publish-ready folder.
- **Why it matters commercially:** Reduces creator friction and encourages sharing.
- **User benefit:** One-click packaging for publication.
- **Implementation difficulty:** Medium
- **Expected impact:** High
- **Suggested implementation steps:** Add package export; generate README/instructions; include thumbnails; zip output.
- **Dependencies or risks:** Need clear MakerWorld requirements and image generation pipeline.

### 13. Add Assembly Instruction Generator
- **Description:** Generate step-by-step assembly instructions from fasteners, board holes, cutouts, and parts.
- **Why it matters commercially:** Better listings and commercial deliverables need assembly docs.
- **User benefit:** Easier handoff to customers or community users.
- **Implementation difficulty:** Medium
- **Expected impact:** Medium
- **Suggested implementation steps:** Add instruction templates; include exploded images; export PDF/Markdown.
- **Dependencies or risks:** Needs reliable exploded-view rendering.

### 14. Add Rendered Thumbnail and Preview Export
- **Description:** Render high-quality PNG previews of the enclosure, lid, base, and exploded assembly.
- **Why it matters commercially:** Marketing and MakerWorld listings need strong visuals.
- **User benefit:** Users can share designs without taking screenshots manually.
- **Implementation difficulty:** Medium
- **Expected impact:** High
- **Suggested implementation steps:** Add offscreen renderer; camera presets; transparent/background options; export image set.
- **Dependencies or risks:** Headless rendering in CI may require GPU/software rendering setup.

### 15. Add Print Calibration Coupons
- **Description:** Generate small test coupons for selected material, fastener, snap, insert, and connector clearances.
- **Why it matters commercially:** Reduces failed full-size prints and builds trust.
- **User benefit:** Users can calibrate before printing the whole enclosure.
- **Implementation difficulty:** Medium
- **Expected impact:** High
- **Suggested implementation steps:** Add coupon generator; link from material/fastener warnings; export coupon STL/3MF.
- **Dependencies or risks:** Requires material-specific empirical tuning.

## Phase 4: Commercialization, Growth, and Community

### 16. Add Plugin API and Marketplace-Ready Extension Points
- **Description:** Support third-party board profiles, fasteners, templates, importers, and exporters.
- **Why it matters commercially:** Ecosystem growth expands coverage faster than one team can.
- **User benefit:** Users can adapt the app to niche boards and workflows.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Define plugin manifest; sandbox execution; version APIs; add sample plugin; add plugin tests.
- **Dependencies or risks:** Security, compatibility, support burden.

### 17. Add Commercial Template Packs
- **Description:** Offer premium enclosure templates and board libraries for professional users.
- **Why it matters commercially:** Creates monetization beyond donations.
- **User benefit:** Saves design time for common products.
- **Implementation difficulty:** Medium
- **Expected impact:** High
- **Suggested implementation steps:** Build template pack loader; license checks if needed; add paid/free catalog split.
- **Dependencies or risks:** Licensing and open-source positioning.

### 18. Add Team and Export Branding Controls
- **Description:** Let businesses add logos, serial numbers, QR codes, and label recesses.
- **Why it matters commercially:** Commercial users need branded outputs.
- **User benefit:** Production-ready enclosures for small product runs.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Add text/logo engraving; QR generation; serial sequence; drawing/BOM integration.
- **Dependencies or risks:** Font handling, SVG/logo booleans, QR readability.

### 19. Add Public Example Gallery
- **Description:** Provide downloadable example projects for Raspberry Pi, ESP32, Arduino, and RF boards.
- **Why it matters commercially:** Examples sell the value faster than feature lists.
- **User benefit:** Users can start from working designs.
- **Implementation difficulty:** Low
- **Expected impact:** Medium
- **Suggested implementation steps:** Create example `.pcbenc.json` files; add screenshots; include validated exports.
- **Dependencies or risks:** Need tested hardware dimensions and print validation.

### 20. Add Feedback and Issue Reporting Flow
- **Description:** Add an in-app way to export diagnostic bundles and file GitHub issues.
- **Why it matters commercially:** Faster support improves retention.
- **User benefit:** Easier bug reporting with project context.
- **Implementation difficulty:** Medium
- **Expected impact:** Medium
- **Suggested implementation steps:** Generate sanitized diagnostic zip; include app version, project, logs; link issue template.
- **Dependencies or risks:** Privacy concerns around uploaded designs.

## Phase 5: Advanced Differentiation and Long-Term Moat

### 21. Add AI-Assisted Parameter Generation
- **Description:** Convert natural language enclosure descriptions into editable parameters, never opaque geometry.
- **Why it matters commercially:** AI-assisted design is a strong marketing hook.
- **User benefit:** Faster first draft for non-CAD users.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Define prompt/schema contract; add local/offline fallback templates; require user review; add eval suite.
- **Dependencies or risks:** Hallucinated dimensions, privacy, online/offline expectations.

### 22. Add Automatic Connector Detection From KiCad
- **Description:** Detect USB-C, Micro USB, Ethernet, HDMI, GPIO, SMA, LEDs, buttons, and switches from footprints.
- **Why it matters commercially:** Automatic cutouts are a core promised differentiator.
- **User benefit:** Less manual modeling and fewer mistakes.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Build footprint library; parse pads/models; classify connectors; add confidence UI; allow corrections.
- **Dependencies or risks:** Footprint naming inconsistency across libraries.

### 23. Add Additional Enclosure Templates
- **Description:** Implement snap-fit, sliding lid, hinged lid, DIN rail, rack mount, wall mount, handheld, desktop, and battery enclosures.
- **Why it matters commercially:** Broader use cases increase addressable market.
- **User benefit:** Users can pick the enclosure style they actually need.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Add template interface; build one template at a time; validate and test each; add examples.
- **Dependencies or risks:** Significant DFM complexity per template.

### 24. Add Simulation and Collision Analysis
- **Description:** Detect PCB/component interference, insufficient wall clearance, fastener conflicts, and connector clashes.
- **Why it matters commercially:** Professional users need confidence before printing.
- **User benefit:** Fewer revisions and failed assemblies.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Add component model; import component heights; add spatial index; render collisions in viewport.
- **Dependencies or risks:** Requires richer PCB/component import model.

### 25. Add Validated Slicer Round-Trip Testing
- **Description:** Automatically validate exported models with slicer or mesh repair tools.
- **Why it matters commercially:** Slice-success evidence is necessary for production claims.
- **User benefit:** Higher confidence that outputs print correctly.
- **Implementation difficulty:** High
- **Expected impact:** High
- **Suggested implementation steps:** Add CLI validation with mesh tools; optionally Bambu/Prusa slicer automation; store regression artifacts.
- **Dependencies or risks:** Slicer licensing, CI runtime, platform-specific tooling.

## Prioritized 30-Day Improvement Plan

1. Fix `npm ci && npm run dev` Electron binary/install reliability.
2. Add app icon, author metadata, desktopName, and installer branding.
3. Add mesh manifold/topology validation beyond buffer checks.
4. Add release smoke tests for Linux AppImage launch.
5. Build import correction UI for KiCad/SVG detected holes and outlines.
6. Add more board profile fixtures with verified dimensions.
7. Add generated sample projects and exported artifacts.
8. Add technical drawing title blocks and revision fields.
9. Improve documentation with screenshots and first-run guide.
10. Add GitHub issue templates and release checklist.

## Prioritized 60-Day Improvement Plan

1. Integrate OpenCascade.js or equivalent CAD kernel behind a geometry adapter.
2. Port two-piece screw case to B-rep solids.
3. Add STEP export from real solids.
4. Add rounded cutouts and fillets/chamfers.
5. Add connector footprint detection for common KiCad USB and GPIO parts.
6. Add calibration coupon generator.
7. Add offscreen preview image export.
8. Add Windows/macOS signing configuration.
9. Add automated package workflows with artifact smoke checks.
10. Validate representative exports in Bambu Studio manually and document results.

## Prioritized 90-Day Launch Plan

1. Ship production-ready two-piece screw case with validated STEP/STL/3MF.
2. Add at least one additional enclosure template.
3. Add MakerWorld listing pack export.
4. Add assembly instruction export.
5. Add measurement and dimension tools.
6. Add custom logo/text engraving.
7. Build launch gallery with 10 printable examples.
8. Complete signing/notarization.
9. Run beta with electronics makers and collect feedback.
10. Publish public release with demo videos, docs, and support channels.

## Recommended Pricing or Monetization Options

- Free open-source core for manual PCB enclosures.
- Paid Pro build with advanced templates, AI assist, batch exports, and commercial support.
- Paid template/profile packs for popular boards and enclosure families.
- Sponsorship tiers for hardware vendors.
- Consulting/custom template services for startups and labs.

## Recommended Target Users

- Electronics hobbyists using Bambu printers.
- Makers publishing accessories to MakerWorld.
- Hardware startup engineers prototyping enclosures.
- Robotics and IoT developers.
- University labs and makerspaces.
- Small-batch product designers.

## Recommended Marketing Angles

- "From PCB to printable enclosure in minutes."
- "Parametric electronics cases without proprietary CAD."
- "MakerWorld-ready enclosure exports."
- "Bambu-friendly project box generator."
- "Open-source enclosure automation for hardware builders."

## Recommended Launch Checklist

- Signed Windows installer.
- Signed and notarized macOS DMG.
- Linux AppImage smoke tested.
- Public examples and screenshots.
- Demo video covering import, edit, preview, export, slice.
- Known limitations page.
- Security and privacy statement.
- Contribution guide and issue templates.
- Release notes.
- MakerWorld publishing guide with screenshots.

## Recommended Demo Scenarios

- Import a KiCad PCB and generate a two-piece screw enclosure.
- Start from Raspberry Pi 4 board profile and export 3MF.
- Add USB-C cutout and lid vents, then preview real mesh openings.
- Change material and fastener profile, show printability warnings.
- Export STL, 3MF, GLTF, DXF, SVG, BOM, and MakerWorld metadata.

## Recommended Documentation Improvements

- Add screenshots for every major workflow.
- Add glossary for PCB/enclosure/CAD terms.
- Add importer limitations with examples.
- Add DFM guide for each material.
- Add troubleshooting page for Electron install and GPU issues.
- Add export validation guide.
- Add packaging/signing guide with secrets examples.
- Add board profile authoring guide.
- Add fastener profile authoring guide.
- Add release checklist.

## Recommended Onboarding Improvements

- First-run sample project selector.
- Guided project wizard.
- Inline validation explanations with suggested fixes.
- Contextual tooltips for CAD/DFM terms.
- Import review screen.
- One-click demo export folder.
- Recent projects list.
- In-app links to docs and examples.
- "Print calibration coupon first" prompt.
- Beginner/advanced control density toggle.
