import { describe, expect, it } from 'vitest';
import { generateTwoPieceScrewCase } from '../src/shared/cad';
import { defaultProject, validateProject } from '../src/shared/domain';
import { builtInFastenerProfiles, fastenerProfileById } from '../src/shared/fasteners';
import { validateMesh } from '../src/shared/cad/meshValidation';

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

  it('defines modeled insert socket dimensions for heat-set insert profiles', () => {
    const heatSetProfiles = builtInFastenerProfiles.filter((profile) => profile.kind === 'heat_set_insert');

    expect(heatSetProfiles.length).toBeGreaterThan(0);
    for (const profile of heatSetProfiles) {
      expect(profile.insertOuterDiameter, profile.id).toBeGreaterThan(profile.screwHoleDiameter);
      expect(profile.insertDepth, profile.id).toBeGreaterThan(0);
      expect(profile.insertDepth, profile.id).toBeLessThanOrEqual(profile.recommendedStandoffHeight);
      expect(profile.insertLeadInDiameter, profile.id).toBeGreaterThanOrEqual(profile.insertOuterDiameter ?? 0);
      expect(profile.insertLeadInDepth, profile.id).toBeGreaterThan(0);
      expect(profile.vendorStyle, profile.id).toBeTruthy();
      expect((profile.screwBossDiameter - (profile.insertOuterDiameter ?? 0)) / 2, profile.id).toBeGreaterThan(
        profile.minimumWallAroundHole,
      );
      expect((profile.screwBossDiameter - (profile.insertLeadInDiameter ?? 0)) / 2, profile.id).toBeGreaterThan(
        0.4,
      );
    }
  });

  it('generates valid preview mesh geometry for a heat-set insert boss profile', () => {
    const profile = fastenerProfileById('m3_heat_set_insert');
    expect(profile).toBeDefined();
    const project = structuredClone(defaultProject);
    project.enclosure.fastenerProfileId = profile?.id ?? '';
    project.enclosure.standoffDiameter = profile?.standoffDiameter ?? project.enclosure.standoffDiameter;
    project.enclosure.standoffHoleDiameter =
      profile?.standoffHoleDiameter ?? project.enclosure.standoffHoleDiameter;
    project.enclosure.standoffHeight =
      profile?.recommendedStandoffHeight ?? project.enclosure.standoffHeight;
    project.enclosure.screwBossDiameter = profile?.screwBossDiameter ?? project.enclosure.screwBossDiameter;
    project.enclosure.screwHoleDiameter = profile?.screwHoleDiameter ?? project.enclosure.screwHoleDiameter;

    const generated = generateTwoPieceScrewCase(project);

    expect(validateMesh(generated.mesh).ok).toBe(true);
    expect(generated.metadata.assemblyInstructions.join('\n')).toContain('M3 heat-set insert');
  });

  it('rejects heat-set insert lead-ins that leave too little boss wall', () => {
    const profile = fastenerProfileById('m3_heat_set_insert');
    expect(profile).toBeDefined();
    const project = structuredClone(defaultProject);
    project.enclosure.fastenerProfileId = profile?.id ?? '';
    project.enclosure.screwBossDiameter = 5.2;
    project.enclosure.screwHoleDiameter = profile?.screwHoleDiameter ?? project.enclosure.screwHoleDiameter;
    project.enclosure.standoffDiameter = profile?.standoffDiameter ?? project.enclosure.standoffDiameter;
    project.enclosure.standoffHoleDiameter = profile?.standoffHoleDiameter ?? project.enclosure.standoffHoleDiameter;
    project.enclosure.standoffHeight = profile?.recommendedStandoffHeight ?? project.enclosure.standoffHeight;

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('heat_set_insert_lead_in_too_wide');
  });

  it('rejects unknown fastener profile ids', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.fastenerProfileId = 'unknown-fastener';

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('unknown_fastener_profile');
  });
});
