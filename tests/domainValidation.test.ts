import { describe, expect, it } from 'vitest';
import { defaultProject, validateProject } from '../src/shared/domain';

describe('validateProject', () => {
  it('accepts the default project', () => {
    const result = validateProject(defaultProject);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('reports actionable validation issues for invalid dimensions', () => {
    const project = structuredClone(defaultProject);
    project.pcb.width = 0;
    project.enclosure.standoffHoleDiameter = project.enclosure.standoffDiameter;

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('positive_number_required');
    expect(result.issues.map((issue) => issue.code)).toContain('standoff_wall_too_thin');
  });

  it('rejects mounting holes outside the board outline', () => {
    const project = structuredClone(defaultProject);
    project.pcb.mountingHoles[0] = { id: 'bad-hole', x: 1000, y: 1000, diameter: 3 };

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('mounting_hole_outside_board');
  });

  it('returns a validation issue instead of throwing for unknown material input', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.material = 'mystery' as typeof project.enclosure.material;

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('unknown_material');
  });

  it('rejects fastener dimensions below the selected wall requirement', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.fastenerProfileId = 'm3_heat_set_insert';
    project.enclosure.standoffDiameter = 4;
    project.enclosure.standoffHoleDiameter = 3.2;
    project.enclosure.screwBossDiameter = 4;
    project.enclosure.screwHoleDiameter = 3.2;

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('standoff_below_fastener_wall_minimum');
    expect(result.issues.map((issue) => issue.code)).toContain('boss_below_fastener_wall_minimum');
  });

  it('rejects heat-set insert bosses that are too short for the modeled socket', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.fastenerProfileId = 'm3_heat_set_insert';
    project.enclosure.standoffDiameter = 8;
    project.enclosure.standoffHoleDiameter = 3.2;
    project.enclosure.screwBossDiameter = 8.5;
    project.enclosure.screwHoleDiameter = 3.2;
    project.enclosure.standoffHeight = 5.2;

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('heat_set_insert_boss_too_short');
  });

  it('rejects connector cutouts that do not fit on the selected wall', () => {
    const project = structuredClone(defaultProject);
    project.pcb.connectorCutouts[0] = {
      id: 'bad-cutout',
      label: 'USB-C',
      side: 'front',
      offset: 1,
      z: 2,
      width: 20,
      height: 6,
    };

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('cutout_outside_wall_span');
    expect(result.issues.map((issue) => issue.code)).toContain('cutout_outside_wall_height');
  });

  it('rejects ventilation regions that do not fit on the lid', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.ventilationRegions[0] = {
      id: 'bad-vent',
      label: 'Bad vent',
      x: 1,
      y: 1,
      width: 40,
      height: 20,
      slotWidth: 50,
      slotHeight: 5,
      spacing: 2,
    };

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('vent_slot_larger_than_region');
    expect(result.issues.map((issue) => issue.code)).toContain('vent_region_outside_lid');
  });
});
