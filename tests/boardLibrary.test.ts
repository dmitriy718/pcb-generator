import { describe, expect, it } from 'vitest';
import { boardProfileById, builtInBoardProfiles } from '../src/shared/boards';
import { defaultProject, validateProject } from '../src/shared/domain';

describe('built-in board library', () => {
  it('has unique profile ids', () => {
    const ids = builtInBoardProfiles.map((profile) => profile.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves profiles by id', () => {
    const profile = boardProfileById('arduino-uno-r3');

    expect(profile?.name).toBe('Arduino Uno R3');
  });

  it('contains usable PCB definitions for every built-in profile', () => {
    for (const profile of builtInBoardProfiles) {
      const result = validateProject({
        ...defaultProject,
        name: `${profile.name} Enclosure`,
        pcb: profile.pcb,
        enclosure: {
          ...defaultProject.enclosure,
          ventilationRegions: [],
          designFeatures: [],
        },
      });

      expect(result.issues, profile.id).toEqual([]);
      expect(result.ok, profile.id).toBe(true);
      expect(profile.pcb.width, profile.id).toBeGreaterThan(0);
      expect(profile.pcb.height, profile.id).toBeGreaterThan(0);
    }
  });
});
