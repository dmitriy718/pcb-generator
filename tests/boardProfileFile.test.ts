import { describe, expect, it } from 'vitest';
import { defaultProject, type BoardProfile } from '../src/shared/domain';
import {
  parseBoardProfileFile,
  serializeBoardProfileFile,
  slugify,
} from '../src/shared/boards';

const profile: BoardProfile = {
  id: 'custom-controller',
  name: 'Custom Controller',
  family: 'Custom',
  source: 'custom',
  notes: 'Test board profile.',
  pcb: defaultProject.pcb,
};

describe('board profile files', () => {
  it('round-trips a custom board profile', () => {
    const contents = serializeBoardProfileFile(profile);
    const parsed = parseBoardProfileFile(contents);

    expect(parsed).toEqual(profile);
    expect(JSON.parse(contents)).toMatchObject({
      format: 'pcb-enclosure-board-profile',
      version: 1,
      profile: { id: 'custom-controller' },
    });
  });

  it('loads older profile payloads that omit connector cutouts', () => {
    const legacyPcb = {
      width: profile.pcb.width,
      height: profile.pcb.height,
      thickness: profile.pcb.thickness,
      cornerRadius: profile.pcb.cornerRadius,
      mountingHoles: profile.pcb.mountingHoles,
    };
    const contents = JSON.stringify({
      format: 'pcb-enclosure-board-profile',
      version: 1,
      profile: {
        ...profile,
        pcb: legacyPcb,
      },
    });

    const parsed = parseBoardProfileFile(contents);

    expect(parsed.pcb.connectorCutouts).toEqual([]);
  });

  it('loads older profile payloads that omit component height', () => {
    const legacyPcb: Record<string, unknown> = { ...profile.pcb };
    delete legacyPcb.componentHeight;
    const contents = JSON.stringify({
      format: 'pcb-enclosure-board-profile',
      version: 1,
      profile: {
        ...profile,
        pcb: legacyPcb,
      },
    });

    const parsed = parseBoardProfileFile(contents);

    expect(parsed.pcb.componentHeight).toBe(0);
  });

  it('rejects invalid profile schema', () => {
    expect(() => parseBoardProfileFile('{"format":"wrong"}')).toThrow(
      'Board profile file schema is invalid',
    );
  });

  it('rejects invalid profile geometry', () => {
    const invalid = structuredClone(profile);
    invalid.pcb.mountingHoles[0] = { id: 'bad', x: 1000, y: 1000, diameter: 3 };

    expect(() => serializeBoardProfileFile(invalid)).toThrow(
      'Board profile contains invalid geometry',
    );
  });

  it('creates stable slugs for profile filenames', () => {
    expect(slugify(' Custom RF Board! ')).toBe('custom-rf-board');
    expect(slugify('***')).toBe('custom-board');
  });
});
