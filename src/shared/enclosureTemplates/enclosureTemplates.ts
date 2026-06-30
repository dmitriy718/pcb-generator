import type { DesignFeature, EnclosureProject, TwoPieceScrewCaseParameters } from '../domain';
import { materialProfiles } from '../domain';

export interface EnclosureTemplate {
  id: string;
  name: string;
  family: string;
  closure: string;
  productionStatus: 'validated_two_piece_generator';
  description: string;
  apply(project: EnclosureProject): TwoPieceScrewCaseParameters;
}

export const enclosureTemplates: EnclosureTemplate[] = [
  {
    id: 'compact-screw-case',
    name: 'Compact screw case',
    family: 'Two-piece screw cases',
    closure: 'Machine-screw or insert closure',
    productionStatus: 'validated_two_piece_generator',
    description: 'Tight two-piece screw case for low-profile boards.',
    apply: (project) => ({
      ...project.enclosure,
      boardClearance: Math.max(project.enclosure.boardClearance, 1),
      baseInternalHeight: Math.max(
        project.enclosure.baseInternalHeight,
        project.pcb.componentHeight + materialProfiles[project.enclosure.material].clearance,
      ),
      cornerRadius: Math.max(project.enclosure.cornerRadius, 4),
      chamfer: Math.max(project.enclosure.chamfer, 0.5),
    }),
  },
  {
    id: 'rounded-handheld',
    name: 'Rounded handheld',
    family: 'Handheld enclosures',
    closure: 'Machine-screw or insert closure',
    productionStatus: 'validated_two_piece_generator',
    description: 'Larger ergonomic shell with rounded corners and extra grip clearance.',
    apply: (project) => roundedHandheldParameters(project),
  },
  {
    id: 'portable-handheld',
    name: 'Portable handheld',
    family: 'Handheld enclosures',
    closure: 'Machine-screw or insert closure',
    productionStatus: 'validated_two_piece_generator',
    description: 'Handheld proportions with generated lanyard and status-light openings.',
    apply: (project) => portableHandheldParameters(project),
  },
  {
    id: 'tall-component-clearance',
    name: 'Tall component clearance',
    family: 'Electronics project boxes',
    closure: 'Machine-screw or insert closure',
    productionStatus: 'validated_two_piece_generator',
    description: 'More internal height for headers, radios, heat sinks, and stacked modules.',
    apply: (project) => ({
      ...project.enclosure,
      wallThickness: Math.max(project.enclosure.wallThickness, 2),
      baseInternalHeight: Math.max(
        project.enclosure.baseInternalHeight,
        project.pcb.componentHeight + materialProfiles[project.enclosure.material].clearance + 6,
      ),
      boardClearance: Math.max(project.enclosure.boardClearance, 2),
      chamfer: Math.max(project.enclosure.chamfer, 0.6),
    }),
  },
  {
    id: 'wall-mount-starter',
    name: 'Wall mount starter',
    family: 'Mounted enclosures',
    closure: 'Machine-screw or insert closure',
    productionStatus: 'validated_two_piece_generator',
    description: 'Screw-case parameters with extra wall thickness and clearance for wall-mount features.',
    apply: (project) => wallMountParameters(project),
  },
  {
    id: 'din-rail-backplate',
    name: 'DIN rail backplate',
    family: 'Mounted enclosures',
    closure: 'DIN rail backplate ribs plus screw-case closure',
    productionStatus: 'validated_two_piece_generator',
    description: 'Starter backplate layout with editable raised DIN rail reference ribs.',
    apply: (project) => dinRailBackplateParameters(project),
  },
  {
    id: 'desktop-project-box',
    name: 'Desktop project box',
    family: 'Electronics project boxes',
    closure: 'Machine-screw or insert closure',
    productionStatus: 'validated_two_piece_generator',
    description: 'Stable electronics project-box proportions for bench and desktop use.',
    apply: (project) => desktopProjectBoxParameters(project),
  },
  {
    id: 'battery-access-case',
    name: 'Battery access case',
    family: 'Battery enclosures',
    closure: 'Machine-screw or insert closure',
    productionStatus: 'validated_two_piece_generator',
    description: 'Two-piece case proportions with generated editable battery tray and cable-exit features.',
    apply: (project) => batteryAccessParameters(project),
  },
];

export function enclosureTemplateById(id: string): EnclosureTemplate | undefined {
  return enclosureTemplates.find((template) => template.id === id);
}

function roundedHandheldParameters(project: EnclosureProject): TwoPieceScrewCaseParameters {
  return {
    ...project.enclosure,
    wallThickness: Math.max(project.enclosure.wallThickness, 2.2),
    boardClearance: Math.max(project.enclosure.boardClearance, 3),
    baseInternalHeight: Math.max(
      project.enclosure.baseInternalHeight,
      project.pcb.componentHeight + materialProfiles[project.enclosure.material].clearance + 1,
    ),
    cornerRadius: Math.max(project.enclosure.cornerRadius, 9),
    chamfer: 0,
  };
}

function portableHandheldParameters(project: EnclosureProject): TwoPieceScrewCaseParameters {
  const enclosure: TwoPieceScrewCaseParameters = {
    ...roundedHandheldParameters(project),
    wallThickness: Math.max(project.enclosure.wallThickness, 2.4),
    boardClearance: Math.max(project.enclosure.boardClearance, 3.5),
    baseInternalHeight: Math.max(
      project.enclosure.baseInternalHeight,
      project.pcb.componentHeight + materialProfiles[project.enclosure.material].clearance + 2,
    ),
    cornerRadius: Math.max(project.enclosure.cornerRadius, 10),
  };

  return {
    ...enclosure,
    designFeatures: replaceGeneratedFeatures(enclosure.designFeatures, portableHandheldFeatures(project, enclosure)),
  };
}

function portableHandheldFeatures(project: EnclosureProject, enclosure: TwoPieceScrewCaseParameters): DesignFeature[] {
  const { outerWidth, outerHeight } = enclosureOuterDimensions(project, enclosure);
  const lanyardDiameter = round(Math.max(4, enclosure.screwHoleDiameter + 1.2));
  const indicatorDiameter = 3.2;
  const featureWallMargin = 0.25;
  const lanyardX = clamp(
    outerWidth / 2,
    enclosure.wallThickness + lanyardDiameter / 2 + featureWallMargin,
    outerWidth - enclosure.wallThickness - lanyardDiameter / 2 - featureWallMargin,
  );
  const lanyardY = clamp(
    outerHeight - enclosure.wallThickness - lanyardDiameter / 2 - featureWallMargin,
    enclosure.wallThickness + lanyardDiameter / 2 + featureWallMargin,
    outerHeight - enclosure.wallThickness - lanyardDiameter / 2 - featureWallMargin,
  );
  const indicatorX = clamp(
    outerWidth * 0.5,
    enclosure.wallThickness + indicatorDiameter / 2 + featureWallMargin,
    outerWidth - enclosure.wallThickness - indicatorDiameter / 2 - featureWallMargin,
  );
  const indicatorY = clamp(
    outerHeight * 0.62,
    enclosure.wallThickness + indicatorDiameter / 2 + featureWallMargin,
    outerHeight - enclosure.wallThickness - indicatorDiameter / 2 - featureWallMargin,
  );

  return [
    {
      id: 'template-handheld-lanyard-hole',
      label: 'Lanyard hole',
      kind: 'antenna_hole',
      shape: 'circle',
      operation: 'through_cut',
      x: round(lanyardX),
      y: round(lanyardY),
      width: lanyardDiameter,
      height: lanyardDiameter,
      diameter: lanyardDiameter,
      depth: enclosure.lidThickness,
      cornerRadius: 0,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: '',
    },
    {
      id: 'template-handheld-status-light',
      label: 'Status light opening',
      kind: 'button_opening',
      shape: 'circle',
      operation: 'through_cut',
      x: round(indicatorX),
      y: round(indicatorY),
      width: indicatorDiameter,
      height: indicatorDiameter,
      diameter: indicatorDiameter,
      depth: enclosure.lidThickness,
      cornerRadius: 0,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: '',
    },
  ];
}

function wallMountParameters(project: EnclosureProject): TwoPieceScrewCaseParameters {
  const enclosure: TwoPieceScrewCaseParameters = {
    ...project.enclosure,
    wallThickness: Math.max(project.enclosure.wallThickness, 2.4),
    floorThickness: Math.max(project.enclosure.floorThickness, 2),
    boardClearance: Math.max(project.enclosure.boardClearance, 3),
    cornerRadius: Math.max(project.enclosure.cornerRadius, 6),
    chamfer: Math.max(project.enclosure.chamfer, 0.6),
  };

  return {
    ...enclosure,
    designFeatures: replaceGeneratedFeatures(enclosure.designFeatures, wallMountFeatures(project, enclosure)),
  };
}

function wallMountFeatures(project: EnclosureProject, enclosure: TwoPieceScrewCaseParameters): DesignFeature[] {
  const { outerWidth, outerHeight } = enclosureOuterDimensions(project, enclosure);
  const diameter = round(Math.max(4.5, enclosure.screwHoleDiameter + 1.8));
  const y = clamp(
    outerHeight * 0.72,
    enclosure.wallThickness + diameter / 2,
    outerHeight - enclosure.wallThickness - diameter / 2,
  );
  const xs = [outerWidth * 0.35, outerWidth * 0.65].map((x) =>
    clamp(x, enclosure.wallThickness + diameter / 2, outerWidth - enclosure.wallThickness - diameter / 2),
  );

  return xs.map((x, index) => ({
    id: `template-wall-mount-${index + 1}`,
    label: `Wall mount hole ${index + 1}`,
    kind: 'antenna_hole',
    shape: 'circle',
    operation: 'through_cut',
    x: round(x),
    y: round(y),
    width: diameter,
    height: diameter,
    diameter,
    depth: enclosure.lidThickness,
    cornerRadius: 0,
    spacing: diameter,
    rows: 1,
    columns: 1,
    text: '',
  }));
}

function dinRailBackplateParameters(project: EnclosureProject): TwoPieceScrewCaseParameters {
  const enclosure: TwoPieceScrewCaseParameters = {
    ...project.enclosure,
    wallThickness: Math.max(project.enclosure.wallThickness, 2.4),
    floorThickness: Math.max(project.enclosure.floorThickness, 2),
    lidThickness: Math.max(project.enclosure.lidThickness, 2.2),
    boardClearance: Math.max(project.enclosure.boardClearance, 3),
    cornerRadius: Math.max(project.enclosure.cornerRadius, 4),
    chamfer: Math.max(project.enclosure.chamfer, 0.6),
    ventilationRegions: [],
  };

  return {
    ...enclosure,
    designFeatures: replaceGeneratedFeatures(enclosure.designFeatures, dinRailBackplateFeatures(project, enclosure)),
  };
}

function dinRailBackplateFeatures(project: EnclosureProject, enclosure: TwoPieceScrewCaseParameters): DesignFeature[] {
  const { outerWidth, outerHeight } = enclosureOuterDimensions(project, enclosure);
  const bossClearance = materialProfiles[enclosure.material].clearance;
  const bossPlacementMargin = 0.6;
  const bossKeepout = enclosure.screwBossDiameter + bossClearance * 2 + bossPlacementMargin;
  const holeXs = project.pcb.mountingHoles.map((hole) => hole.x);
  const holeYs = project.pcb.mountingHoles.map((hole) => hole.y);
  const availableBossGapX =
    holeXs.length >= 2
      ? Math.max(12, Math.max(...holeXs) - Math.min(...holeXs) - bossKeepout)
      : outerWidth - enclosure.wallThickness * 2;
  const availableBossGapY =
    holeYs.length >= 2
      ? Math.max(7, Math.max(...holeYs) - Math.min(...holeYs) - bossKeepout)
      : outerHeight - enclosure.wallThickness * 2;
  const ribWidth = round(Math.min(42, Math.max(12, outerWidth * 0.46), availableBossGapX));
  const ribHeight = round(Math.min(3.2, Math.max(1.6, availableBossGapY * 0.24)));
  const ribSpacing = round(Math.min(10.5, Math.max(3, availableBossGapY - ribHeight * 2)));
  const patternHeight = ribHeight * 2 + ribSpacing;
  const featureWallMargin = 0.35;
  const bossCenterX =
    holeXs.length >= 2
      ? enclosure.wallThickness + enclosure.boardClearance + (Math.min(...holeXs) + Math.max(...holeXs)) / 2
      : outerWidth * 0.5;
  const bossCenterY =
    holeYs.length >= 2
      ? enclosure.wallThickness + enclosure.boardClearance + (Math.min(...holeYs) + Math.max(...holeYs)) / 2
      : outerHeight * 0.5;
  const x = clamp(
    bossCenterX,
    enclosure.wallThickness + ribWidth / 2 + featureWallMargin,
    outerWidth - enclosure.wallThickness - ribWidth / 2 - featureWallMargin,
  );
  const y = clamp(
    bossCenterY,
    enclosure.wallThickness + patternHeight / 2 + featureWallMargin,
    outerHeight - enclosure.wallThickness - patternHeight / 2 - featureWallMargin,
  );

  return [
    {
      id: 'template-din-rail-ribs',
      label: 'DIN rail backplate ribs',
      kind: 'din_rail_clip',
      shape: 'rounded_rectangle',
      operation: 'emboss',
      x: round(x),
      y: round(y),
      width: ribWidth,
      height: ribHeight,
      diameter: ribHeight,
      depth: 1.2,
      cornerRadius: 0.8,
      spacing: ribSpacing,
      rows: 2,
      columns: 1,
      text: '',
    },
  ];
}

function desktopProjectBoxParameters(project: EnclosureProject): TwoPieceScrewCaseParameters {
  const enclosure: TwoPieceScrewCaseParameters = {
    ...project.enclosure,
    wallThickness: Math.max(project.enclosure.wallThickness, 2),
    floorThickness: Math.max(project.enclosure.floorThickness, 2),
    lidThickness: Math.max(project.enclosure.lidThickness, 2),
    boardClearance: Math.max(project.enclosure.boardClearance, 2.5),
    cornerRadius: Math.max(project.enclosure.cornerRadius, 5),
    chamfer: Math.max(project.enclosure.chamfer, 0.7),
  };

  return {
    ...enclosure,
    designFeatures: replaceGeneratedFeatures(enclosure.designFeatures, desktopProjectBoxFeatures(project, enclosure)),
  };
}

function batteryAccessParameters(project: EnclosureProject): TwoPieceScrewCaseParameters {
  const enclosure: TwoPieceScrewCaseParameters = {
    ...project.enclosure,
    wallThickness: Math.max(project.enclosure.wallThickness, 2.2),
    floorThickness: Math.max(project.enclosure.floorThickness, 2),
    lidThickness: Math.max(project.enclosure.lidThickness, 2),
    boardClearance: Math.max(project.enclosure.boardClearance, 3),
    baseInternalHeight: Math.max(
      project.enclosure.baseInternalHeight,
      project.pcb.componentHeight + materialProfiles[project.enclosure.material].clearance + 2,
    ),
    cornerRadius: Math.max(project.enclosure.cornerRadius, 6),
    chamfer: Math.max(project.enclosure.chamfer, 0.6),
  };

  return {
    ...enclosure,
    designFeatures: replaceGeneratedFeatures(enclosure.designFeatures, batteryAccessFeatures(project, enclosure)),
  };
}

function desktopProjectBoxFeatures(project: EnclosureProject, enclosure: TwoPieceScrewCaseParameters): DesignFeature[] {
  const { outerWidth, outerHeight } = enclosureOuterDimensions(project, enclosure);
  const labelWidth = round(Math.min(22, Math.max(16, outerWidth * 0.28)));
  const labelHeight = 6;
  const cableWidth = round(Math.min(16, Math.max(10, outerWidth * 0.2)));
  const cableHeight = 4;
  const labelX = clamp(outerWidth * 0.5, enclosure.wallThickness + labelWidth / 2, outerWidth - enclosure.wallThickness - labelWidth / 2);
  const labelY = clamp(
    outerHeight * 0.7,
    enclosure.wallThickness + labelHeight / 2,
    outerHeight - enclosure.wallThickness - labelHeight / 2,
  );
  const cableX = clamp(outerWidth * 0.5, enclosure.wallThickness + cableWidth / 2, outerWidth - enclosure.wallThickness - cableWidth / 2);
  const cableY = clamp(
    outerHeight - enclosure.wallThickness - cableHeight / 2,
    enclosure.wallThickness + cableHeight / 2,
    outerHeight - enclosure.wallThickness - cableHeight / 2,
  );

  return [
    {
      id: 'template-desktop-label-recess',
      label: 'Desktop label recess',
      kind: 'label_recess',
      shape: 'rectangle',
      operation: 'recess',
      x: round(labelX),
      y: round(labelY),
      width: labelWidth,
      height: labelHeight,
      diameter: labelHeight,
      depth: Math.min(0.4, enclosure.lidThickness * 0.3),
      cornerRadius: 0,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: 'LABEL',
    },
    {
      id: 'template-desktop-cable-slot',
      label: 'Rear cable slot',
      kind: 'cable_slot',
      shape: 'rectangle',
      operation: 'through_cut',
      x: round(cableX),
      y: round(cableY),
      width: cableWidth,
      height: cableHeight,
      diameter: cableHeight,
      depth: enclosure.lidThickness,
      cornerRadius: 0,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: '',
    },
  ];
}

function batteryAccessFeatures(project: EnclosureProject, enclosure: TwoPieceScrewCaseParameters): DesignFeature[] {
  const { outerWidth, outerHeight } = enclosureOuterDimensions(project, enclosure);
  const trayWidth = round(Math.min(32, Math.max(18, outerWidth * 0.34)));
  const trayHeight = round(Math.min(14, Math.max(9, outerHeight * 0.28)));
  const cableWidth = round(Math.min(14, Math.max(8, outerWidth * 0.18)));
  const cableHeight = 4;
  const featureWallMargin = 0.35;
  const trayX = clamp(
    outerWidth * 0.5,
    enclosure.wallThickness + trayWidth / 2 + featureWallMargin,
    outerWidth - enclosure.wallThickness - trayWidth / 2 - featureWallMargin,
  );
  const trayY = clamp(
    outerHeight * 0.62,
    enclosure.wallThickness + trayHeight / 2 + featureWallMargin,
    outerHeight - enclosure.wallThickness - trayHeight / 2 - featureWallMargin,
  );
  const cableX = clamp(
    outerWidth * 0.5,
    enclosure.wallThickness + cableWidth / 2 + featureWallMargin,
    outerWidth - enclosure.wallThickness - cableWidth / 2 - featureWallMargin,
  );
  const cableY = clamp(
    outerHeight - enclosure.wallThickness - cableHeight / 2 - featureWallMargin,
    enclosure.wallThickness + cableHeight / 2 + featureWallMargin,
    outerHeight - enclosure.wallThickness - cableHeight / 2 - featureWallMargin,
  );

  return [
    {
      id: 'template-battery-tray-recess',
      label: 'Battery tray recess',
      kind: 'battery_tray',
      shape: 'rounded_rectangle',
      operation: 'recess',
      x: round(trayX),
      y: round(trayY),
      width: trayWidth,
      height: trayHeight,
      diameter: trayHeight,
      depth: Math.min(0.6, enclosure.lidThickness * 0.35),
      cornerRadius: 1.5,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: 'BAT',
    },
    {
      id: 'template-battery-cable-exit',
      label: 'Battery cable exit',
      kind: 'cable_slot',
      shape: 'rectangle',
      operation: 'through_cut',
      x: round(cableX),
      y: round(cableY),
      width: cableWidth,
      height: cableHeight,
      diameter: cableHeight,
      depth: enclosure.lidThickness,
      cornerRadius: 0,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: '',
    },
  ];
}

function enclosureOuterDimensions(
  project: EnclosureProject,
  enclosure: TwoPieceScrewCaseParameters,
): { outerWidth: number; outerHeight: number } {
  const internalWidth = project.pcb.width + enclosure.boardClearance * 2;
  const internalHeight = project.pcb.height + enclosure.boardClearance * 2;
  return {
    outerWidth: internalWidth + enclosure.wallThickness * 2,
    outerHeight: internalHeight + enclosure.wallThickness * 2,
  };
}

function replaceGeneratedFeatures(existingFeatures: DesignFeature[], generatedFeatures: DesignFeature[]): DesignFeature[] {
  const generatedIds = new Set(generatedFeatures.map((feature) => feature.id));
  return [...existingFeatures.filter((feature) => !generatedIds.has(feature.id)), ...generatedFeatures];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
