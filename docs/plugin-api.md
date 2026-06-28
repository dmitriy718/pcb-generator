# Plugin API

PCB Enclosure Generator supports a versioned plugin manifest API for discovering
third-party extension packages while keeping the application fully offline and avoiding
arbitrary code execution.

## Manifest

Plugins provide a `pcb-enclosure-plugin` manifest:

```json
{
  "format": "pcb-enclosure-plugin",
  "apiVersion": "1",
  "id": "maker.connector-pack",
  "name": "Maker Connector Pack",
  "version": "1.0.0",
  "description": "Connector cutout presets for common maker boards.",
  "author": "Example Author",
  "capabilities": [
    {
      "kind": "connector_library",
      "id": "usb-c-cutouts",
      "name": "USB-C Cutouts",
      "version": "1.0.0",
      "description": "USB-C cutout presets."
    }
  ],
  "sandbox": {
    "permissions": ["read_project"]
  }
}
```

Supported capability kinds:

- `connector_library`
- `board_library`
- `fastener_profile`
- `enclosure_template`
- `vent_generator`
- `exporter`
- `material_profile`

Supported sandbox permission declarations:

- `read_project`
- `write_project`
- `file_import`
- `file_export`
- `network`

The current API validates manifests and indexes declared capabilities. Plugin code
execution and third-party geometry execution are intentionally not supported. Declarative
plugin packages can contribute approved JSON data for board libraries and enclosure
template parameter patches without executing plugin code.

## Declarative Packages

Declarative plugin packages use this wrapper:

```json
{
  "format": "pcb-enclosure-plugin-package",
  "manifest": {
    "format": "pcb-enclosure-plugin",
    "apiVersion": "1",
    "id": "maker.board-pack",
    "name": "Maker Board Pack",
    "version": "1.0.0",
    "capabilities": [
      { "kind": "board_library", "id": "maker-boards", "name": "Maker Boards" }
    ]
  },
  "contributions": {
    "boardProfiles": [],
    "enclosureTemplates": []
  }
}
```

Board profiles are validated with the same domain rules as normal board profile files.
Enclosure templates are converted into parameter patches for the existing validated
two-piece screw-case generator.

## TypeScript API

Use `parsePluginManifest` to validate JSON and `PluginRegistry` to index capabilities:

```ts
import { PluginRegistry, parsePluginManifest } from './src/shared/plugins';

const manifest = parsePluginManifest(pluginManifestJson);
const registry = new PluginRegistry();
registry.register(manifest);

const boardLibraries = registry.capabilities('board_library');
```

The registry rejects duplicate plugin ids and plugin API versions that do not match the
current major API version.
