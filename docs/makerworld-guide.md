# MakerWorld Publishing Guide

The app writes a `.makerworld.json` metadata file beside each exported 3MF, STL, or OBJ.
3MF exports also embed a compact metadata JSON file in the package.

Included metadata:

- Title and summary.
- Tags.
- Material recommendation.
- Layer height and infill.
- Support requirement status.
- Print orientation.
- Estimated filament and print time.
- Bambu profile hint.
- Assembly instructions.

Before publishing, inspect the exported model in Bambu Studio and confirm scale,
orientation, and sliced toolpaths.
