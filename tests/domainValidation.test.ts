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

  it('rejects design features that do not fit on the lid', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.designFeatures = [
      {
        id: 'feature-bad',
        label: 'Oversize speaker grille',
        kind: 'speaker_grill',
        shape: 'circle',
        operation: 'through_cut',
        x: 2,
        y: 2,
        width: 3,
        height: 3,
        diameter: 3,
        depth: project.enclosure.lidThickness,
        cornerRadius: 0,
        spacing: 3,
        rows: 4,
        columns: 4,
        text: '',
      },
    ];

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('design_feature_outside_lid');
  });

  it('rejects recess design features deeper than the lid', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.designFeatures = [
      {
        id: 'feature-bad-recess',
        label: 'Deep label pocket',
        kind: 'label_recess',
        shape: 'rectangle',
        operation: 'recess',
        x: 30,
        y: 18,
        width: 12,
        height: 5,
        diameter: 5,
        depth: project.enclosure.lidThickness,
        cornerRadius: 0,
        spacing: 4,
        rows: 1,
        columns: 1,
        text: 'ID',
      },
    ];

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('design_feature_recess_too_deep');
  });

  it('rejects overlapping lid design features', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.ventilationRegions = [];
    project.enclosure.designFeatures = [
      {
        id: 'feature-display',
        label: 'Display',
        kind: 'display_opening',
        shape: 'rectangle',
        operation: 'through_cut',
        x: 30,
        y: 18,
        width: 16,
        height: 8,
        diameter: 8,
        depth: project.enclosure.lidThickness,
        cornerRadius: 0,
        spacing: 4,
        rows: 1,
        columns: 1,
        text: '',
      },
      {
        id: 'feature-button',
        label: 'Button',
        kind: 'button_opening',
        shape: 'circle',
        operation: 'through_cut',
        x: 36,
        y: 18,
        width: 6,
        height: 6,
        diameter: 6,
        depth: project.enclosure.lidThickness,
        cornerRadius: 0,
        spacing: 4,
        rows: 1,
        columns: 1,
        text: '',
      },
    ];

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('design_feature_overlaps_feature');
  });

  it('rejects design features that overlap ventilation regions', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.designFeatures = [
      {
        id: 'feature-label',
        label: 'Label',
        kind: 'label_recess',
        shape: 'rectangle',
        operation: 'recess',
        x: 25,
        y: 12,
        width: 8,
        height: 4,
        diameter: 4,
        depth: 0.4,
        cornerRadius: 0,
        spacing: 4,
        rows: 1,
        columns: 1,
        text: 'ID',
      },
    ];

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('design_feature_overlaps_vent');
  });

  it('rejects design features that overlap screw bosses', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.ventilationRegions = [];
    project.enclosure.designFeatures = [
      {
        id: 'feature-button',
        label: 'Button over boss',
        kind: 'button_opening',
        shape: 'circle',
        operation: 'through_cut',
        x: 6.8,
        y: 6.8,
        width: 5,
        height: 5,
        diameter: 5,
        depth: project.enclosure.lidThickness,
        cornerRadius: 0,
        spacing: 4,
        rows: 1,
        columns: 1,
        text: '',
      },
    ];

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('design_feature_overlaps_screw_boss');
  });

  it('rejects ventilation regions that overlap screw bosses', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.ventilationRegions = [
      {
        id: 'vent-over-boss',
        label: 'Vent over boss',
        x: 6.8,
        y: 6.8,
        width: 8,
        height: 8,
        slotWidth: 2,
        slotHeight: 2,
        spacing: 2,
      },
    ];

    const result = validateProject(project);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('vent_region_overlaps_screw_boss');
  });
});
