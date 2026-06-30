import { describe, expect, it } from 'vitest';
import { defaultProject, validateProject } from '../src/shared/domain';
import { loadDeclarativePluginPackage, PluginRegistry } from '../src/shared/plugins';

describe('declarative plugin package loader', () => {
  it('loads approved declarative board and enclosure template contributions', () => {
    const registry = new PluginRegistry();
    const loaded = loadDeclarativePluginPackage(
      {
        format: 'pcb-enclosure-plugin-package',
        manifest: {
          format: 'pcb-enclosure-plugin',
          apiVersion: '1',
          id: 'acme.declarative-pack',
          name: 'ACME Declarative Pack',
          version: '1.0.0',
          capabilities: [
            { kind: 'board_library', id: 'acme-boards', name: 'ACME Boards' },
            { kind: 'enclosure_template', id: 'acme-templates', name: 'ACME Templates' },
          ],
          sandbox: { permissions: [] },
        },
        contributions: {
          boardProfiles: [
            {
              id: 'acme-sensor',
              name: 'ACME Sensor Board',
              family: 'ACME',
              notes: 'Declarative test profile.',
              pcb: {
                width: 40,
                height: 30,
                thickness: 1.6,
                componentHeight: 5,
                cornerRadius: 1,
                mountingHoles: [
                  { id: 'mh-1', x: 4, y: 4, diameter: 3 },
                  { id: 'mh-2', x: 36, y: 26, diameter: 3 },
                ],
                connectorCutouts: [],
              },
            },
          ],
          enclosureTemplates: [
            {
              id: 'rugged',
              name: 'ACME Rugged',
              description: 'Declarative rugged template.',
              patch: {
                wallThickness: 2.6,
                floorThickness: 2,
                boardClearance: 3,
                chamfer: 0.8,
              },
            },
          ],
        },
      },
      registry,
    );

    expect(registry.capabilities('board_library')).toHaveLength(1);
    expect(loaded.boardProfiles[0]?.name).toBe('ACME Sensor Board');
    const template = loaded.enclosureTemplates[0];
    expect(template?.id).toBe('acme.declarative-pack.rugged');
    expect(template?.family).toBe('Plugin templates');
    expect(template?.productionStatus).toBe('validated_two_piece_generator');
    expect(template).toBeDefined();
    if (!template) {
      throw new Error('Expected plugin enclosure template.');
    }
    expect(validateProject({ ...defaultProject, enclosure: template.apply(defaultProject) }).issues).toEqual([]);
  });

  it('rejects executable-looking or invalid declarative packages through schema and domain validation', () => {
    expect(() =>
      loadDeclarativePluginPackage({
        format: 'pcb-enclosure-plugin-package',
        manifest: {
          format: 'pcb-enclosure-plugin',
          apiVersion: '1',
          id: 'bad.plugin-pack',
          name: 'Bad Pack',
          version: '1.0.0',
          capabilities: [{ kind: 'board_library', id: 'bad-boards', name: 'Bad Boards' }],
        },
        contributions: {
          boardProfiles: [
            {
              id: 'bad-board',
              name: 'Bad Board',
              family: 'Bad',
              notes: 'Invalid dimensions.',
              pcb: {
                width: -1,
                height: 30,
                thickness: 1.6,
                componentHeight: 0,
                cornerRadius: 0,
                mountingHoles: [],
                connectorCutouts: [],
              },
            },
          ],
        },
        execute: 'console.log("not allowed")',
      }),
    ).toThrow('Board profile contains invalid geometry');
  });
});
