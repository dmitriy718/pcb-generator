import { describe, expect, it } from 'vitest';
import { generateTwoPieceScrewCase } from '../src/shared/cad';
import { defaultProject, validateProject } from '../src/shared/domain';
import { builtInFastenerProfiles, fastenerProfileById } from '../src/shared/fasteners';

describe('fastener profiles', () => {
  it('has unique profile ids', () => {
    const ids = builtInFastenerProfiles.map((profile) => profile.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves profiles by id', () => {
    expect(fastenerProfileById('m3_heat_set_insert')?.name).toBe('M3 heat-set insert');
  });

  it('can drive valid enclosure dimensions for every built-in profile', () => {
    for (const profile of builtInFastenerProfiles) {
      const project = structuredClone(defaultProject);
      project.enclosure.fastenerProfileId = profile.id;
      project.enclosure.standoffDiameter = profile.standoffDiameter;
      project.enclosure.standoffHoleDiameter = profile.standoffHoleDiameter;
      project.enclosure.standoffHeight = profile.recommendedStandoffHeight;
      project.enclosure.screwBossDiameter = profile.screwBossDiameter;
      project.enclosure.screwHoleDiameter = profile.screwHoleDiameter;

      const validation = validateProject(project);
      const generated = generateTwoPieceScrewCase(project);

      expect(validation.issues, profile.id).toEqual([]);
      expect(generated.metadata.assemblyInstructions.join('\n')).toContain(profile.name);
    }
  });

  it('rejects unknown fastener profile ids', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.fastenerProfileId = 'unknown-fastener';

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('unknown_fastener_profile');
  });
});
