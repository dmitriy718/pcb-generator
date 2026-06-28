import { describe, expect, it } from 'vitest';
import { generateTwoPieceScrewCase, validateMesh } from '../src/shared/cad';
import { defaultProject, type TriangleMesh } from '../src/shared/domain';

describe('generateTwoPieceScrewCase', () => {
  it('generates a validated triangle mesh with manufacturing metadata', () => {
    const generated = generateTwoPieceScrewCase(defaultProject);
    const meshValidation = validateMesh(generated.mesh);

    expect(meshValidation.ok).toBe(true);
    expect(generated.mesh.vertices.length).toBeGreaterThan(0);
    expect(generated.mesh.indices.length).toBeGreaterThan(0);
    expect(generated.mesh.groups.map((group) => group.name)).toEqual([
      'base-shell',
      'base-standoffs',
      'lid-panel',
      'lid-screw-bosses',
    ]);
    expect(generated.metadata.supportRequired).toBe(false);
    expect(generated.metadata.makerWorld.tags).toContain('pcb-enclosure');
  });

  it('throws before generation when parameters are invalid', () => {
    const project = structuredClone(defaultProject);
    project.pcb.width = -1;

    expect(() => generateTwoPieceScrewCase(project)).toThrow('PCB width');
  });

  it('leaves connector cutout aperture open in the generated front wall mesh', () => {
    const generated = generateTwoPieceScrewCase(defaultProject);
    const cutout = defaultProject.pcb.connectorCutouts[0];
    if (!cutout) {
      throw new Error('Default project should include a connector cutout.');
    }

    const internalWidth = defaultProject.pcb.width + defaultProject.enclosure.boardClearance * 2;
    const outerWidth = internalWidth + defaultProject.enclosure.wallThickness * 2;
    const outerHeight =
      defaultProject.pcb.height +
      defaultProject.enclosure.boardClearance * 2 +
      defaultProject.enclosure.wallThickness * 2;
    const frontWallY = -outerHeight / 2;
    const apertureCenterX = -outerWidth / 2 + defaultProject.enclosure.wallThickness + cutout.offset;
    const trianglesInAperture = countTriangleCentroidsInBox(generated.mesh, {
      minX: apertureCenterX - cutout.width / 2 + 0.1,
      maxX: apertureCenterX + cutout.width / 2 - 0.1,
      minY: frontWallY - 0.01,
      maxY: frontWallY + defaultProject.enclosure.wallThickness + 0.01,
      minZ: cutout.z - cutout.height / 2 + 0.1,
      maxZ: cutout.z + cutout.height / 2 - 0.1,
    });

    expect(trianglesInAperture).toBe(0);
  });

  it('leaves lid ventilation slot apertures open in the generated lid mesh', () => {
    const generated = generateTwoPieceScrewCase(defaultProject);
    const region = defaultProject.enclosure.ventilationRegions[0];
    if (!region) {
      throw new Error('Default project should include a ventilation region.');
    }

    const internalWidth = defaultProject.pcb.width + defaultProject.enclosure.boardClearance * 2;
    const internalHeight = defaultProject.pcb.height + defaultProject.enclosure.boardClearance * 2;
    const outerWidth = internalWidth + defaultProject.enclosure.wallThickness * 2;
    const outerHeight = internalHeight + defaultProject.enclosure.wallThickness * 2;
    const lidOffsetX = -outerWidth / 2 + outerWidth + 12;
    const lidOffsetY = -outerHeight / 2;
    const columnCount = Math.floor((region.width + region.spacing) / (region.slotWidth + region.spacing));
    const totalWidth = columnCount * region.slotWidth + (columnCount - 1) * region.spacing;
    const firstSlotXMin = region.x - totalWidth / 2;
    const firstSlotXMax = firstSlotXMin + region.slotWidth;
    const firstSlotYMin = region.y - region.slotHeight / 2;
    const firstSlotYMax = firstSlotYMin + region.slotHeight;

    const trianglesInSlot = countTriangleCentroidsInBox(generated.mesh, {
      minX: lidOffsetX + firstSlotXMin + 0.1,
      maxX: lidOffsetX + firstSlotXMax - 0.1,
      minY: lidOffsetY + firstSlotYMin + 0.1,
      maxY: lidOffsetY + firstSlotYMax - 0.1,
      minZ: 0.01,
      maxZ: defaultProject.enclosure.lidThickness - 0.01,
    });

    expect(trianglesInSlot).toBe(0);
  });
});

function countTriangleCentroidsInBox(
  mesh: TriangleMesh,
  box: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
): number {
  let count = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = vertexAt(mesh, mesh.indices[i] ?? 0);
    const b = vertexAt(mesh, mesh.indices[i + 1] ?? 0);
    const c = vertexAt(mesh, mesh.indices[i + 2] ?? 0);
    const centroid = {
      x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3,
      z: (a.z + b.z + c.z) / 3,
    };
    if (
      centroid.x >= box.minX &&
      centroid.x <= box.maxX &&
      centroid.y >= box.minY &&
      centroid.y <= box.maxY &&
      centroid.z >= box.minZ &&
      centroid.z <= box.maxZ
    ) {
      count += 1;
    }
  }
  return count;
}

function vertexAt(mesh: TriangleMesh, index: number): { x: number; y: number; z: number } {
  const offset = index * 3;
  return {
    x: mesh.vertices[offset] ?? 0,
    y: mesh.vertices[offset + 1] ?? 0,
    z: mesh.vertices[offset + 2] ?? 0,
  };
}
