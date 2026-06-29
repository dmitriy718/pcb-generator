import type { DesignFeature, EnclosureProject, TwoPieceScrewCaseParameters } from '../domain';
import { materialProfiles } from '../domain';

export interface EnclosureTemplate {
  id: string;
  name: string;
  description: string;
  apply(project: EnclosureProject): TwoPieceScrewCaseParameters;
}

export const enclosureTemplates: EnclosureTemplate[] = [
  {
    id: 'compact-screw-case',
    name: 'Compact screw case',
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
    description: 'Larger ergonomic shell with rounded corners and extra grip clearance.',
    apply: (project) => ({
      ...project.enclosure,
      wallThickness: Math.max(project.enclosure.wallThickness, 2.2),
      boardClearance: Math.max(project.enclosure.boardClearance, 3),
      baseInternalHeight: Math.max(
        project.enclosure.baseInternalHeight,
        project.pcb.componentHeight + materialProfiles[project.enclosure.material].clearance + 1,
      ),
      cornerRadius: Math.max(project.enclosure.cornerRadius, 9),
      chamfer: 0,
    }),
  },
  {
    id: 'tall-component-clearance',
    name: 'Tall component clearance',
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
    description: 'Screw-case parameters with extra wall thickness and clearance for wall-mount features.',
    apply: (project) => wallMountParameters(project),
  },
  {
    id: 'desktop-project-box',
    name: 'Desktop project box',
    description: 'Stable electronics project-box proportions for bench and desktop use.',
    apply: (project) => ({
      ...project.enclosure,
      wallThickness: Math.max(project.enclosure.wallThickness, 2),
      floorThickness: Math.max(project.enclosure.floorThickness, 2),
      lidThickness: Math.max(project.enclosure.lidThickness, 2),
      boardClearance: Math.max(project.enclosure.boardClearance, 2.5),
      cornerRadius: Math.max(project.enclosure.cornerRadius, 5),
      chamfer: Math.max(project.enclosure.chamfer, 0.7),
    }),
  },
];

export function enclosureTemplateById(id: string): EnclosureTemplate | undefined {
  return enclosureTemplates.find((template) => template.id === id);
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
    designFeatures: [
      ...enclosure.designFeatures.filter((feature) => !feature.id.startsWith('template-wall-mount-')),
      ...wallMountFeatures(project, enclosure),
    ],
  };
}

function wallMountFeatures(project: EnclosureProject, enclosure: TwoPieceScrewCaseParameters): DesignFeature[] {
  const internalWidth = project.pcb.width + enclosure.boardClearance * 2;
  const internalHeight = project.pcb.height + enclosure.boardClearance * 2;
  const outerWidth = internalWidth + enclosure.wallThickness * 2;
  const outerHeight = internalHeight + enclosure.wallThickness * 2;
  const diameter = round(Math.max(4.5, enclosure.screwHoleDiameter + 1.8));
  const y = clamp(outerHeight / 2, enclosure.wallThickness + diameter / 2, outerHeight - enclosure.wallThickness - diameter / 2);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
