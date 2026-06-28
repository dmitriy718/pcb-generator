import { describe, expect, it } from 'vitest';
import { defaultProject } from '../src/shared/domain';
import { parseProjectFile, serializeProjectFile } from '../src/shared/projectFiles';

describe('project files', () => {
  it('round-trips a valid project through the versioned file format', () => {
    const contents = serializeProjectFile(defaultProject);
    const parsed = parseProjectFile(contents);

    expect(parsed).toEqual(defaultProject);
    expect(JSON.parse(contents)).toMatchObject({
      format: 'pcb-enclosure-generator',
      version: 1,
      project: { name: defaultProject.name },
    });
  });

  it('loads older project payloads that omit connector cutouts', () => {
    const legacy = structuredClone(defaultProject);
    const legacyPcb = {
      width: legacy.pcb.width,
      height: legacy.pcb.height,
      thickness: legacy.pcb.thickness,
      cornerRadius: legacy.pcb.cornerRadius,
      mountingHoles: legacy.pcb.mountingHoles,
    };
    const contents = JSON.stringify({
      format: 'pcb-enclosure-generator',
      version: 1,
      project: {
        ...legacy,
        pcb: legacyPcb,
      },
    });

    const parsed = parseProjectFile(contents);

    expect(parsed.pcb.connectorCutouts).toEqual([]);
  });

  it('loads older project payloads that omit fastener profile ids', () => {
    const legacy = structuredClone(defaultProject);
    const legacyEnclosure: Record<string, unknown> = { ...legacy.enclosure };
    delete legacyEnclosure.fastenerProfileId;
    const contents = JSON.stringify({
      format: 'pcb-enclosure-generator',
      version: 1,
      project: {
        ...legacy,
        enclosure: legacyEnclosure,
      },
    });

    const parsed = parseProjectFile(contents);

    expect(parsed.enclosure.fastenerProfileId).toBe('m2_5_self_tapping');
  });

  it('loads older project payloads that omit ventilation regions', () => {
    const legacy = structuredClone(defaultProject);
    const legacyEnclosure: Record<string, unknown> = { ...legacy.enclosure };
    delete legacyEnclosure.ventilationRegions;
    const contents = JSON.stringify({
      format: 'pcb-enclosure-generator',
      version: 1,
      project: {
        ...legacy,
        enclosure: legacyEnclosure,
      },
    });

    const parsed = parseProjectFile(contents);

    expect(parsed.enclosure.ventilationRegions).toEqual([]);
  });

  it('loads older project payloads that omit design features', () => {
    const legacy = structuredClone(defaultProject);
    const legacyEnclosure: Record<string, unknown> = { ...legacy.enclosure };
    delete legacyEnclosure.designFeatures;
    const contents = JSON.stringify({
      format: 'pcb-enclosure-generator',
      version: 1,
      project: {
        ...legacy,
        enclosure: legacyEnclosure,
      },
    });

    const parsed = parseProjectFile(contents);

    expect(parsed.enclosure.designFeatures).toEqual([]);
  });

  it('rejects non-project JSON', () => {
    expect(() => parseProjectFile('{"hello": "world"}')).toThrow('Project file schema is invalid');
  });

  it('rejects project files with invalid geometry parameters', () => {
    const project = structuredClone(defaultProject);
    project.pcb.width = 0;

    expect(() =>
      parseProjectFile(
        JSON.stringify({
          format: 'pcb-enclosure-generator',
          version: 1,
          project,
        }),
      ),
    ).toThrow('Project file contains invalid parameters');
  });
});
