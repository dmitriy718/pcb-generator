import { describe, expect, it } from 'vitest';
import { defaultProject, validateProject, type DesignFeature } from '../src/shared/domain';
import {
  autoArrangeDesignFeatures,
  autoArrangeLidLayout,
  placeDesignFeaturePreset,
} from '../src/shared/layout/lidPlacement';

describe('lid feature placement', () => {
  it('places new feature presets away from existing lid features', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.ventilationRegions = [];
    project.enclosure.designFeatures = [buttonFeature('feature-button', 32, 18)];

    const placed = placeDesignFeaturePreset(
      project,
      {
        label: 'Battery tray',
        kind: 'battery_tray',
        shape: 'rounded_rectangle',
        operation: 'recess',
        xRatio: 0.5,
        yRatio: 0.5,
        width: 24,
        height: 10,
        diameter: 10,
        depth: 0.4,
        cornerRadius: 1,
        spacing: 3,
        rows: 1,
        columns: 1,
        text: 'BAT',
      },
      'feature-battery',
    );

    expect(placed).toBeDefined();
    if (!placed) {
      throw new Error('Expected battery preset placement.');
    }
    expect(
      validateProject({
        ...project,
        enclosure: {
          ...project.enclosure,
          designFeatures: [...project.enclosure.designFeatures, placed],
        },
      }).issues,
    ).toEqual([]);
    expect(placed.x).not.toBe(32);
  });

  it('auto-arranges existing overlapping lid features into valid positions', () => {
    const project = structuredClone(defaultProject);
    project.pcb.width = 100;
    project.pcb.height = 70;
    project.pcb.connectorCutouts = [{ ...project.pcb.connectorCutouts[0], offset: 50 } as NonNullable<typeof project.pcb.connectorCutouts[0]>];
    project.enclosure.ventilationRegions = [];
    project.enclosure.designFeatures = [
      buttonFeature('feature-button', 52, 38),
      batteryFeature('feature-battery', 52, 38),
      fanFeature('feature-fan', 52, 38),
    ];

    expect(validateProject(project).issues.map((issue) => issue.code)).toContain('design_feature_overlaps_feature');

    const result = autoArrangeDesignFeatures(project);

    expect(result.unresolvedLabels).toEqual([]);
    expect(result.movedCount).toBeGreaterThan(0);
    expect(validateProject(result.project).issues).toEqual([]);
  });

  it('auto-arranges existing vents and features into a valid combined lid layout', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.ventilationRegions = [
      {
        id: 'vent-crowded',
        label: 'Crowded vent',
        x: 32,
        y: 18,
        width: 24,
        height: 10,
        slotWidth: 3,
        slotHeight: 8,
        spacing: 3,
      },
    ];
    project.enclosure.designFeatures = [
      buttonFeature('feature-button', 32, 18),
      batteryFeature('feature-battery', 32, 18),
    ];

    expect(validateProject(project).issues.map((issue) => issue.code)).toContain('design_feature_overlaps_vent');

    const result = autoArrangeLidLayout(project);

    expect(result.unresolvedLabels).toEqual([]);
    expect(result.movedCount).toBeGreaterThan(0);
    expect(validateProject(result.project).issues).toEqual([]);
  });
});

function buttonFeature(id: string, x: number, y: number): DesignFeature {
  return {
    id,
    label: 'Button opening',
    kind: 'button_opening',
    shape: 'circle',
    operation: 'through_cut',
    x,
    y,
    width: 7,
    height: 7,
    diameter: 7,
    depth: defaultProject.enclosure.lidThickness,
    cornerRadius: 0,
    spacing: 3,
    rows: 1,
    columns: 1,
    text: '',
  };
}

function batteryFeature(id: string, x: number, y: number): DesignFeature {
  return {
    id,
    label: 'Battery tray',
    kind: 'battery_tray',
    shape: 'rounded_rectangle',
    operation: 'recess',
    x,
    y,
    width: 24,
    height: 10,
    diameter: 10,
    depth: 0.4,
    cornerRadius: 1,
    spacing: 3,
    rows: 1,
    columns: 1,
    text: 'BAT',
  };
}

function fanFeature(id: string, x: number, y: number): DesignFeature {
  return {
    id,
    label: 'Fan grill',
    kind: 'fan_grill',
    shape: 'circle',
    operation: 'through_cut',
    x,
    y,
    width: 3,
    height: 3,
    diameter: 3,
    depth: defaultProject.enclosure.lidThickness,
    cornerRadius: 0,
    spacing: 4,
    rows: 5,
    columns: 5,
    text: '',
  };
}
