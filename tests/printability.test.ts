import { describe, expect, it } from 'vitest';
import { defaultProject } from '../src/shared/domain';
import { analyzePrintability } from '../src/shared/printability';

describe('printability analysis', () => {
  it('reports dimensions and Bambu profile guidance for the default project', () => {
    const report = analyzePrintability(defaultProject);

    expect(report.outerDimensions.width).toBeGreaterThan(defaultProject.pcb.width);
    expect(report.outerDimensions.height).toBeGreaterThan(defaultProject.pcb.height);
    expect(report.supportRequired).toBe(false);
    expect(report.materialProfile).toBe('PLA');
    expect(report.bambuProfileHint).toContain('BBL');
  });

  it('flags material wall recommendations without blocking valid geometry', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.material = 'nylon';
    project.enclosure.wallThickness = 1.2;

    const report = analyzePrintability(project);

    expect(report.overall).toBe('review');
    expect(report.issues.map((issue) => issue.code)).toContain('wall_below_material_profile');
  });

  it('flags large side openings for slicer review', () => {
    const project = structuredClone(defaultProject);
    project.pcb.connectorCutouts[0] = {
      id: 'large',
      label: 'Ethernet',
      side: 'front',
      offset: 25,
      z: 9,
      width: 24,
      height: 10,
    };

    const report = analyzePrintability(project);

    expect(report.issues.map((issue) => issue.code)).toContain('large_side_opening');
  });
});
