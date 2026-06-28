import { describe, expect, it } from 'vitest';
import {
  PluginRegistry,
  currentPluginApiVersion,
  isPluginApiCompatible,
  parsePluginManifest,
} from '../src/shared/plugins';

describe('plugin manifest API', () => {
  it('parses a versioned plugin manifest with sandbox permissions', () => {
    const manifest = parsePluginManifest(
      JSON.stringify({
        format: 'pcb-enclosure-plugin',
        apiVersion: currentPluginApiVersion,
        id: 'maker.connector-pack',
        name: 'Maker Connector Pack',
        version: '1.2.3',
        capabilities: [
          {
            kind: 'connector_library',
            id: 'usb-c-cutouts',
            name: 'USB-C Cutouts',
            description: 'Connector cutout presets.',
          },
        ],
        sandbox: {
          permissions: ['read_project'],
        },
      }),
    );

    expect(manifest.id).toBe('maker.connector-pack');
    expect(manifest.capabilities[0]?.version).toBe('1.0.0');
    expect(manifest.sandbox.permissions).toEqual(['read_project']);
  });

  it('rejects invalid manifests before registry registration', () => {
    expect(() =>
      parsePluginManifest({
        format: 'pcb-enclosure-plugin',
        apiVersion: currentPluginApiVersion,
        id: '../unsafe',
        name: 'Unsafe',
        version: '1.0.0',
        capabilities: [],
      }),
    ).toThrow();
  });

  it('indexes registered capabilities by kind', () => {
    const registry = new PluginRegistry();
    registry.register(
      parsePluginManifest({
        format: 'pcb-enclosure-plugin',
        apiVersion: currentPluginApiVersion,
        id: 'acme.board-pack',
        name: 'ACME Board Pack',
        version: '1.0.0',
        capabilities: [
          { kind: 'board_library', id: 'acme-rf-board', name: 'ACME RF Board' },
          { kind: 'material_profile', id: 'acme-asa', name: 'ACME ASA' },
        ],
      }),
    );

    expect(registry.listPlugins()).toHaveLength(1);
    expect(registry.capabilities('board_library')).toEqual([
      expect.objectContaining({
        id: 'acme-rf-board',
        kind: 'board_library',
        pluginId: 'acme.board-pack',
        pluginName: 'ACME Board Pack',
      }),
    ]);
  });

  it('rejects duplicate plugin ids and incompatible API versions', () => {
    const registry = new PluginRegistry();
    const manifest = parsePluginManifest({
      format: 'pcb-enclosure-plugin',
      apiVersion: currentPluginApiVersion,
      id: 'acme.exporters',
      name: 'ACME Exporters',
      version: '1.0.0',
      capabilities: [{ kind: 'exporter', id: 'acme-export', name: 'ACME Export' }],
    });

    registry.register(manifest);

    expect(() => registry.register(manifest)).toThrow('already registered');
    expect(isPluginApiCompatible('2')).toBe(false);
    expect(() =>
      registry.register({
        ...manifest,
        id: 'acme.future',
        apiVersion: '2',
      }),
    ).toThrow('unsupported plugin API');
  });
});
