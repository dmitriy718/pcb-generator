import { describe, expect, it } from 'vitest';
import { MeshBuilder, analyzeMeshTopology, generateTwoPieceScrewCase, validateMesh } from '../src/shared/cad';
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
    expect(generated.metadata.meshTopology.triangleCount).toBe(generated.mesh.indices.length / 3);
    expect(generated.metadata.printability.issues.map((issue) => issue.code)).toContain(
      'mesh_non_manifold_edges',
    );
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

  it('leaves lid design feature apertures open in the preview mesh', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.designFeatures = [
      {
        id: 'feature-display',
        label: 'OLED opening',
        kind: 'display_opening',
        shape: 'rectangle',
        operation: 'through_cut',
        x: 32,
        y: 18,
        width: 16,
        height: 7,
        diameter: 7,
        depth: project.enclosure.lidThickness,
        cornerRadius: 0,
        spacing: 4,
        rows: 1,
        columns: 1,
        text: '',
      },
    ];
    const generated = generateTwoPieceScrewCase(project);
    const internalWidth = project.pcb.width + project.enclosure.boardClearance * 2;
    const internalHeight = project.pcb.height + project.enclosure.boardClearance * 2;
    const outerWidth = internalWidth + project.enclosure.wallThickness * 2;
    const outerHeight = internalHeight + project.enclosure.wallThickness * 2;
    const lidOffsetX = -outerWidth / 2 + outerWidth + 12;
    const lidOffsetY = -outerHeight / 2;

    const trianglesInFeature = countTriangleCentroidsInBox(generated.mesh, {
      minX: lidOffsetX + 32 - 7,
      maxX: lidOffsetX + 32 + 7,
      minY: lidOffsetY + 18 - 2.5,
      maxY: lidOffsetY + 18 + 2.5,
      minZ: 0.01,
      maxZ: project.enclosure.lidThickness - 0.01,
    });

    expect(trianglesInFeature).toBe(0);
  });

  it('adds embossed design features to the preview mesh as a separate group', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.designFeatures = [
      {
        id: 'feature-badge',
        label: 'Logo badge',
        kind: 'logo_badge',
        shape: 'rectangle',
        operation: 'emboss',
        x: 32,
        y: 18,
        width: 12,
        height: 5,
        diameter: 5,
        depth: 0.8,
        cornerRadius: 0,
        spacing: 4,
        rows: 1,
        columns: 1,
        text: '',
      },
    ];
    const generated = generateTwoPieceScrewCase(project);

    expect(generated.mesh.groups.map((group) => group.name)).toContain('lid-design-features');
  });

  it('reports mesh topology for export validation', () => {
    const generated = generateTwoPieceScrewCase(defaultProject);
    const topology = analyzeMeshTopology(generated.mesh);

    expect(topology.vertexCount).toBe(generated.mesh.vertices.length / 3);
    expect(topology.triangleCount).toBe(generated.mesh.indices.length / 3);
    expect(topology.edgeCount).toBeGreaterThan(0);
    expect(topology.boundaryEdges).toBeGreaterThanOrEqual(0);
    expect(topology.nonManifoldEdges).toBeGreaterThanOrEqual(0);
  });

  it('can run strict topology validation on a closed manifold solid', () => {
    const builder = new MeshBuilder();
    builder.addBox({ x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });

    const validation = validateMesh(builder.build(), { checkTopology: true });

    expect(validation.ok).toBe(true);
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
