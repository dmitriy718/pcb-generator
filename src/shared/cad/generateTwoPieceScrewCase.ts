import { getMaterialProfile } from '../domain/materials';
import { fastenerProfileById } from '../fasteners';
import { analyzePrintability } from '../printability';
import type {
  ConnectorCutout,
  CutoutSide,
  DesignFeature,
  EnclosureProject,
  GeneratedEnclosure,
  MeshTopologyReport,
  PrintabilityReport,
  VentilationRegion,
} from '../domain/types';
import { validateProject } from '../domain/validation';
import { MeshBuilder } from './meshBuilder';
import { analyzeMeshTopology, validateMesh } from './meshValidation';
import type { FastenerProfile } from '../fasteners';
import { designFeatureFootprints } from './designFeatureGeometry';

export function generateTwoPieceScrewCase(project: EnclosureProject): GeneratedEnclosure {
  const validation = validateProject(project);
  if (!validation.ok) {
    throw new Error(validation.issues.map((current) => current.message).join('\n'));
  }

  const { pcb, enclosure } = project;
  const material = getMaterialProfile(enclosure.material);
  const fastenerProfile = fastenerProfileById(enclosure.fastenerProfileId);
  if (!fastenerProfile) {
    throw new Error(`Unknown fastener profile: ${enclosure.fastenerProfileId}`);
  }
  const internalWidth = pcb.width + enclosure.boardClearance * 2;
  const internalHeight = pcb.height + enclosure.boardClearance * 2;
  const outerWidth = internalWidth + enclosure.wallThickness * 2;
  const outerHeight = internalHeight + enclosure.wallThickness * 2;
  const baseOuterHeight =
    enclosure.floorThickness + enclosure.standoffHeight + pcb.thickness + enclosure.baseInternalHeight;
  const builder = new MeshBuilder();
  const offsetX = -outerWidth / 2;
  const offsetY = -outerHeight / 2;
  const partSpacing = 12;
  const lidOffsetX = offsetX + outerWidth + partSpacing;
  const lidOffsetY = offsetY;
  const pcbOriginX = offsetX + enclosure.wallThickness + enclosure.boardClearance;
  const pcbOriginY = offsetY + enclosure.wallThickness + enclosure.boardClearance;

  builder.addGroup('base-shell', () => {
    addBaseShellWithCutouts(builder, {
      origin: { x: offsetX, y: offsetY, z: 0 },
      size: { x: outerWidth, y: outerHeight, z: baseOuterHeight },
      wall: enclosure.wallThickness,
      floor: enclosure.floorThickness,
      cutouts: pcb.connectorCutouts,
    });
  });

  builder.addGroup('base-standoffs', () => {
    for (const hole of pcb.mountingHoles) {
      builder.addTube(
        {
          x: pcbOriginX + hole.x,
          y: pcbOriginY + hole.y,
          z: enclosure.floorThickness,
        },
        enclosure.standoffDiameter / 2,
        (enclosure.standoffHoleDiameter + material.holeCompensation) / 2,
        enclosure.standoffHeight,
        40,
      );
    }
  });

  builder.addGroup('lid-panel', () => {
    addLidPanelWithVentSlots(builder, {
      origin: { x: lidOffsetX, y: lidOffsetY, z: 0 },
      size: { x: outerWidth, y: outerHeight, z: enclosure.lidThickness },
      regions: enclosure.ventilationRegions,
      designFeatures: enclosure.designFeatures,
    });
  });

  builder.addGroup('lid-design-features', () => {
    addPreviewDesignFeatures(builder, {
      lidOrigin: { x: lidOffsetX, y: lidOffsetY, z: enclosure.lidThickness },
      designFeatures: enclosure.designFeatures,
    });
  });

  builder.addGroup('lid-screw-bosses', () => {
    for (const hole of pcb.mountingHoles) {
      const lidBossOptions: LidBossOptions = {
        center: {
          x: lidOffsetX + enclosure.wallThickness + enclosure.boardClearance + hole.x,
          y: lidOffsetY + enclosure.wallThickness + enclosure.boardClearance + hole.y,
          z: enclosure.lidThickness,
        },
        outerRadius: enclosure.screwBossDiameter / 2,
        screwRadius: (enclosure.screwHoleDiameter + material.holeCompensation) / 2,
        height: enclosure.standoffHeight,
      };
      if (fastenerProfile.kind === 'heat_set_insert' && fastenerProfile.insertOuterDiameter) {
        lidBossOptions.insertRadius = (fastenerProfile.insertOuterDiameter + material.holeCompensation) / 2;
      }
      if (fastenerProfile.insertDepth) {
        lidBossOptions.insertDepth = fastenerProfile.insertDepth;
      }
      addLidBoss(builder, fastenerProfile, lidBossOptions);
    }
  });

  const mesh = builder.build();
  const meshValidation = validateMesh(mesh);
  if (!meshValidation.ok) {
    throw new Error(meshValidation.issues.map((current) => current.message).join('\n'));
  }

  const roughVolumeMm3 = estimateMeshVolume(mesh);
  const meshTopology = analyzeMeshTopology(mesh);
  const printability = addTopologyToPrintability(analyzePrintability(project), meshTopology);
  return {
    mesh,
    metadata: {
      modelName: project.name,
      material,
      printOrientation: 'Print base open-side up and lid outer-face down on the build plate.',
      supportRequired: false,
      layerHeight: material.recommendedLayerHeight,
      infillPercent: material.recommendedInfillPercent,
      estimatedFilamentGrams: Math.max(1, Math.round(roughVolumeMm3 * 0.00124 * 100) / 100),
      estimatedPrintMinutes: Math.max(10, Math.round(roughVolumeMm3 / 650)),
      assemblyInstructions: [
        `Install the PCB on the standoffs using ${fastenerProfile.name}.`,
        'Inspect all connector openings for clearance before final assembly.',
        'Inspect screw boss alignment before tightening the lid.',
        fastenerProfile.notes,
      ],
      makerWorld: {
        title: project.name,
        summary: 'Parametric two-piece screw PCB enclosure generated from editable dimensions.',
        tags: ['pcb-enclosure', 'electronics', 'bambu-lab', material.name.toLowerCase()],
      },
      layout: {
        modelArrangement:
          'Build-plate layout with base and lid separated. Base is open-side up; lid outer face is on the build plate with bosses upward.',
        printableParts: ['base-shell', 'base-standoffs', 'lid-panel', 'lid-screw-bosses'],
      },
      meshTopology,
      printability,
    },
  };
}

interface LidBossOptions {
  center: { x: number; y: number; z: number };
  outerRadius: number;
  screwRadius: number;
  height: number;
  insertRadius?: number;
  insertDepth?: number;
}

function addLidBoss(
  builder: MeshBuilder,
  fastenerProfile: FastenerProfile,
  options: LidBossOptions,
): void {
  if (
    fastenerProfile.kind === 'heat_set_insert' &&
    options.insertRadius !== undefined &&
    options.insertDepth !== undefined &&
    options.insertRadius > options.screwRadius
  ) {
    builder.addSteppedTube(
      options.center,
      options.outerRadius,
      options.screwRadius,
      options.insertRadius,
      options.height,
      Math.min(options.insertDepth, options.height),
      40,
    );
    return;
  }

  builder.addTube(
    options.center,
    options.outerRadius,
    options.screwRadius,
    options.height,
    40,
  );
}

interface ShellCutoutOptions {
  origin: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  wall: number;
  floor: number;
  cutouts: ConnectorCutout[];
}

interface LocalCutoutRect {
  uMin: number;
  uMax: number;
  zMin: number;
  zMax: number;
}

interface LidVentOptions {
  origin: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  regions: VentilationRegion[];
  designFeatures: DesignFeature[];
}

interface SlotRect {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function addBaseShellWithCutouts(builder: MeshBuilder, options: ShellCutoutOptions): void {
  const { origin, size, floor } = options;
  const max = { x: origin.x + size.x, y: origin.y + size.y, z: origin.z + size.z };
  builder.addBox(origin, { x: max.x, y: max.y, z: origin.z + floor });

  addSideWallWithCutouts(builder, options, 'left');
  addSideWallWithCutouts(builder, options, 'right');
  addSideWallWithCutouts(builder, options, 'front');
  addSideWallWithCutouts(builder, options, 'back');
}

function addSideWallWithCutouts(
  builder: MeshBuilder,
  options: ShellCutoutOptions,
  side: CutoutSide,
): void {
  const { size, wall, cutouts } = options;
  const span = side === 'front' || side === 'back' ? size.x - wall * 2 : size.y - wall * 2;
  const wallCutouts = cutouts
    .filter((cutout) => cutout.side === side)
    .map((cutout) => ({
      uMin: cutout.offset - cutout.width / 2,
      uMax: cutout.offset + cutout.width / 2,
      zMin: cutout.z - cutout.height / 2,
      zMax: cutout.z + cutout.height / 2,
    }));

  const uBreaks = uniqueSorted([0, span, ...wallCutouts.flatMap((cutout) => [cutout.uMin, cutout.uMax])]);
  const zBreaks = uniqueSorted([0, size.z, ...wallCutouts.flatMap((cutout) => [cutout.zMin, cutout.zMax])]);

  for (let uIndex = 0; uIndex < uBreaks.length - 1; uIndex += 1) {
    for (let zIndex = 0; zIndex < zBreaks.length - 1; zIndex += 1) {
      const uMin = uBreaks[uIndex] ?? 0;
      const uMax = uBreaks[uIndex + 1] ?? 0;
      const zMin = zBreaks[zIndex] ?? 0;
      const zMax = zBreaks[zIndex + 1] ?? 0;
      if (uMax <= uMin || zMax <= zMin) {
        continue;
      }
      if (insideAnyCutout({ uMin, uMax, zMin, zMax }, wallCutouts)) {
        continue;
      }
      addWallCell(builder, options, side, uMin, uMax, zMin, zMax);
    }
  }
}

function addWallCell(
  builder: MeshBuilder,
  options: ShellCutoutOptions,
  side: CutoutSide,
  uMin: number,
  uMax: number,
  zMin: number,
  zMax: number,
): void {
  const { origin, size, wall } = options;
  const max = { x: origin.x + size.x, y: origin.y + size.y };
  if (side === 'front') {
    builder.addBox(
      { x: origin.x + wall + uMin, y: origin.y, z: origin.z + zMin },
      { x: origin.x + wall + uMax, y: origin.y + wall, z: origin.z + zMax },
    );
    return;
  }
  if (side === 'back') {
    builder.addBox(
      { x: origin.x + wall + uMin, y: max.y - wall, z: origin.z + zMin },
      { x: origin.x + wall + uMax, y: max.y, z: origin.z + zMax },
    );
    return;
  }
  if (side === 'left') {
    builder.addBox(
      { x: origin.x, y: origin.y + wall + uMin, z: origin.z + zMin },
      { x: origin.x + wall, y: origin.y + wall + uMax, z: origin.z + zMax },
    );
    return;
  }
  builder.addBox(
    { x: max.x - wall, y: origin.y + wall + uMin, z: origin.z + zMin },
    { x: max.x, y: origin.y + wall + uMax, z: origin.z + zMax },
  );
}

function insideAnyCutout(cell: LocalCutoutRect, cutouts: LocalCutoutRect[]): boolean {
  const uCenter = (cell.uMin + cell.uMax) / 2;
  const zCenter = (cell.zMin + cell.zMax) / 2;
  return cutouts.some(
    (cutout) =>
      uCenter > cutout.uMin &&
      uCenter < cutout.uMax &&
      zCenter > cutout.zMin &&
      zCenter < cutout.zMax,
  );
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value * 1000000) / 1000000))].sort(
    (a, b) => a - b,
  );
}

function addLidPanelWithVentSlots(builder: MeshBuilder, options: LidVentOptions): void {
  const slots = [...ventilationSlots(options.regions), ...designFeaturePreviewCutSlots(options.designFeatures)];
  if (slots.length === 0) {
    builder.addBox(options.origin, {
      x: options.origin.x + options.size.x,
      y: options.origin.y + options.size.y,
      z: options.origin.z + options.size.z,
    });
    return;
  }

  const xBreaks = uniqueSorted([0, options.size.x, ...slots.flatMap((slot) => [slot.xMin, slot.xMax])]);
  const yBreaks = uniqueSorted([0, options.size.y, ...slots.flatMap((slot) => [slot.yMin, slot.yMax])]);

  for (let xIndex = 0; xIndex < xBreaks.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < yBreaks.length - 1; yIndex += 1) {
      const xMin = xBreaks[xIndex] ?? 0;
      const xMax = xBreaks[xIndex + 1] ?? 0;
      const yMin = yBreaks[yIndex] ?? 0;
      const yMax = yBreaks[yIndex + 1] ?? 0;
      if (xMax <= xMin || yMax <= yMin) {
        continue;
      }
      if (insideAnySlot({ xMin, xMax, yMin, yMax }, slots)) {
        continue;
      }
      builder.addBox(
        { x: options.origin.x + xMin, y: options.origin.y + yMin, z: options.origin.z },
        { x: options.origin.x + xMax, y: options.origin.y + yMax, z: options.origin.z + options.size.z },
      );
    }
  }
}

function addPreviewDesignFeatures(
  builder: MeshBuilder,
  options: {
    lidOrigin: { x: number; y: number; z: number };
    designFeatures: DesignFeature[];
  },
): void {
  for (const feature of options.designFeatures) {
    if (feature.operation !== 'emboss') {
      continue;
    }
    const height = Math.max(0.2, feature.depth);
    for (const footprint of designFeatureFootprints(feature)) {
      const x = options.lidOrigin.x + footprint.x;
      const y = options.lidOrigin.y + footprint.y;
      if (feature.shape === 'circle') {
        builder.addCylinder({ x, y, z: options.lidOrigin.z }, footprint.diameter / 2, height, 40);
        continue;
      }
      builder.addBox(
        {
          x: x - footprint.width / 2,
          y: y - footprint.height / 2,
          z: options.lidOrigin.z,
        },
        {
          x: x + footprint.width / 2,
          y: y + footprint.height / 2,
          z: options.lidOrigin.z + height,
        },
      );
    }
  }
}

function designFeaturePreviewCutSlots(features: DesignFeature[]): SlotRect[] {
  return features.flatMap((feature) => {
    if (feature.operation !== 'through_cut') {
      return [];
    }
    return designFeatureFootprints(feature).map((footprint) => ({
      xMin: footprint.x - footprint.width / 2,
      xMax: footprint.x + footprint.width / 2,
      yMin: footprint.y - footprint.height / 2,
      yMax: footprint.y + footprint.height / 2,
    }));
  });
}

function ventilationSlots(regions: VentilationRegion[]): SlotRect[] {
  return regions.flatMap((region) => {
    const columnCount = Math.floor((region.width + region.spacing) / (region.slotWidth + region.spacing));
    const rowCount = Math.floor((region.height + region.spacing) / (region.slotHeight + region.spacing));
    if (columnCount < 1 || rowCount < 1) {
      return [];
    }

    const totalWidth = columnCount * region.slotWidth + (columnCount - 1) * region.spacing;
    const totalHeight = rowCount * region.slotHeight + (rowCount - 1) * region.spacing;
    const startX = region.x - totalWidth / 2;
    const startY = region.y - totalHeight / 2;
    const slots: SlotRect[] = [];

    for (let column = 0; column < columnCount; column += 1) {
      for (let row = 0; row < rowCount; row += 1) {
        const xMin = startX + column * (region.slotWidth + region.spacing);
        const yMin = startY + row * (region.slotHeight + region.spacing);
        slots.push({
          xMin,
          xMax: xMin + region.slotWidth,
          yMin,
          yMax: yMin + region.slotHeight,
        });
      }
    }

    return slots;
  });
}

function insideAnySlot(cell: SlotRect, slots: SlotRect[]): boolean {
  const xCenter = (cell.xMin + cell.xMax) / 2;
  const yCenter = (cell.yMin + cell.yMax) / 2;
  return slots.some(
    (slot) =>
      xCenter > slot.xMin && xCenter < slot.xMax && yCenter > slot.yMin && yCenter < slot.yMax,
  );
}

function addTopologyToPrintability(
  report: PrintabilityReport,
  topology: MeshTopologyReport,
): PrintabilityReport {
  const issues = [...report.issues];
  if (topology.boundaryEdges > 0) {
    issues.push({
      severity: 'error',
      code: 'mesh_not_watertight',
      message: `Generated mesh has ${topology.boundaryEdges} boundary edge(s).`,
      recommendation: 'Adjust geometry or regenerate before exporting production files.',
    });
  }
  if (topology.nonManifoldEdges > 0) {
    issues.push({
      severity: 'warning',
      code: 'mesh_non_manifold_edges',
      message: `Generated mesh has ${topology.nonManifoldEdges} non-manifold edge(s).`,
      recommendation:
        'Review the exported model in the slicer and prioritize CAD-kernel generation before production use.',
    });
  }
  const hasError = issues.some((issue) => issue.severity === 'error');
  const hasWarning = issues.some((issue) => issue.severity === 'warning');
  return {
    ...report,
    overall: hasError ? 'blocked' : hasWarning ? 'review' : 'ready',
    issues,
  };
}

function estimateMeshVolume(mesh: { vertices: number[]; indices: number[] }): number {
  let signedVolume = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = vertexAt(mesh.vertices, mesh.indices[i] ?? 0);
    const b = vertexAt(mesh.vertices, mesh.indices[i + 1] ?? 0);
    const c = vertexAt(mesh.vertices, mesh.indices[i + 2] ?? 0);
    signedVolume +=
      (a.x * (b.y * c.z - b.z * c.y) -
        a.y * (b.x * c.z - b.z * c.x) +
        a.z * (b.x * c.y - b.y * c.x)) /
      6;
  }
  return Math.abs(signedVolume);
}

function vertexAt(vertices: number[], index: number): { x: number; y: number; z: number } {
  const offset = index * 3;
  return {
    x: vertices[offset] ?? 0,
    y: vertices[offset + 1] ?? 0,
    z: vertices[offset + 2] ?? 0,
  };
}
