import type { EnclosureProject, TwoPieceScrewCaseParameters } from '../domain';
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
      chamfer: Math.max(project.enclosure.chamfer, 0.8),
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
    apply: (project) => ({
      ...project.enclosure,
      wallThickness: Math.max(project.enclosure.wallThickness, 2.4),
      floorThickness: Math.max(project.enclosure.floorThickness, 2),
      boardClearance: Math.max(project.enclosure.boardClearance, 3),
      cornerRadius: Math.max(project.enclosure.cornerRadius, 6),
      chamfer: Math.max(project.enclosure.chamfer, 0.6),
    }),
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
