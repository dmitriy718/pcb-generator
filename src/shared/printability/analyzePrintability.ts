import { fastenerProfileById } from '../fasteners';
import { getMaterialProfile } from '../domain/materials';
import type { EnclosureProject, PrintabilityIssue, PrintabilityReport } from '../domain';

export function analyzePrintability(project: EnclosureProject): PrintabilityReport {
  const material = getMaterialProfile(project.enclosure.material);
  const fastener = fastenerProfileById(project.enclosure.fastenerProfileId);
  const internalWidth = project.pcb.width + project.enclosure.boardClearance * 2;
  const internalHeight = project.pcb.height + project.enclosure.boardClearance * 2;
  const outerWidth = internalWidth + project.enclosure.wallThickness * 2;
  const outerHeight = internalHeight + project.enclosure.wallThickness * 2;
  const baseHeight =
    project.enclosure.floorThickness +
    project.enclosure.standoffHeight +
    project.pcb.thickness +
    project.enclosure.baseInternalHeight;
  const issues: PrintabilityIssue[] = [];

  if (project.enclosure.wallThickness < material.wallThickness) {
    issues.push({
      severity: 'warning',
      code: 'wall_below_material_profile',
      message: `Wall thickness is below the ${material.name} profile recommendation.`,
      recommendation: `Use at least ${material.wallThickness} mm walls for ${material.name}.`,
    });
  }

  if (project.enclosure.floorThickness < material.minimumFeatureSize * 1.5) {
    issues.push({
      severity: 'warning',
      code: 'thin_floor',
      message: 'Floor thickness is close to the selected material minimum feature size.',
      recommendation: 'Increase floor thickness for better first-layer tolerance and stiffness.',
    });
  }

  for (const cutout of project.pcb.connectorCutouts) {
    if (cutout.width > 18 && cutout.height > 8) {
      issues.push({
        severity: 'info',
        code: 'large_side_opening',
        message: `${cutout.label} is a large side opening.`,
        recommendation: 'Orient the base open-side up and inspect bridging around the opening in the slicer.',
      });
    }
  }

  const ventSlotCount = project.enclosure.ventilationRegions.reduce((count, region) => {
    const columns = Math.floor((region.width + region.spacing) / (region.slotWidth + region.spacing));
    const rows = Math.floor((region.height + region.spacing) / (region.slotHeight + region.spacing));
    return count + Math.max(0, columns) * Math.max(0, rows);
  }, 0);
  if (ventSlotCount > 24) {
    issues.push({
      severity: 'info',
      code: 'many_vent_slots',
      message: `The lid contains ${ventSlotCount} ventilation slots.`,
      recommendation: 'Use at least three top/bottom layers and inspect small slot perimeters in preview.',
    });
  }

  if (fastener?.kind === 'heat_set_insert' && project.enclosure.screwBossDiameter < 7) {
    issues.push({
      severity: 'warning',
      code: 'small_insert_boss',
      message: 'Heat-set insert boss diameter is small for repeated installation heat.',
      recommendation: 'Increase boss diameter or verify the insert manufacturer boss recommendation.',
    });
  }

  const hasError = issues.some((issue) => issue.severity === 'error');
  const hasWarning = issues.some((issue) => issue.severity === 'warning');

  return {
    overall: hasError ? 'blocked' : hasWarning ? 'review' : 'ready',
    outerDimensions: {
      width: round(outerWidth),
      height: round(outerHeight),
      baseHeight: round(baseHeight),
      lidHeight: round(project.enclosure.lidThickness + project.enclosure.standoffHeight),
    },
    recommendedOrientation:
      'Print base open-side up; print lid outer face on the build plate with bosses and vents facing upward.',
    supportRequired: false,
    materialProfile: material.name,
    bambuProfileHint: material.bambuProfileHint,
    issues,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
