import { materialProfiles } from './materials';
import { fastenerProfileById } from '../fasteners';
import type { EnclosureProject, ValidationIssue, ValidationResult } from './types';

function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message };
}

function requirePositive(
  issues: ValidationIssue[],
  value: number,
  path: string,
  label: string,
): void {
  if (!Number.isFinite(value) || value <= 0) {
    issues.push(issue('positive_number_required', path, `${label} must be greater than 0 mm.`));
  }
}

function requireNonNegative(
  issues: ValidationIssue[],
  value: number,
  path: string,
  label: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    issues.push(issue('non_negative_number_required', path, `${label} must be 0 mm or greater.`));
  }
}

export function validateProject(project: EnclosureProject): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { pcb, enclosure } = project;

  if (!project.name.trim()) {
    issues.push(issue('name_required', 'name', 'Project name is required.'));
  }

  requirePositive(issues, pcb.width, 'pcb.width', 'PCB width');
  requirePositive(issues, pcb.height, 'pcb.height', 'PCB height');
  requirePositive(issues, pcb.thickness, 'pcb.thickness', 'PCB thickness');
  requireNonNegative(issues, pcb.cornerRadius, 'pcb.cornerRadius', 'PCB corner radius');

  if (pcb.cornerRadius * 2 > Math.min(pcb.width, pcb.height)) {
    issues.push(
      issue('corner_radius_too_large', 'pcb.cornerRadius', 'PCB corner radius exceeds board size.'),
    );
  }

  const materialLookup = materialProfiles as Partial<Record<string, (typeof materialProfiles)[keyof typeof materialProfiles]>>;
  const material = materialLookup[enclosure.material];

  if (!material) {
    issues.push(issue('unknown_material', 'enclosure.material', 'Unknown material profile.'));
  }

  const fastenerProfile = fastenerProfileById(enclosure.fastenerProfileId);
  if (!fastenerProfile) {
    issues.push(issue('unknown_fastener_profile', 'enclosure.fastenerProfileId', 'Unknown fastener profile.'));
  }

  requirePositive(issues, enclosure.wallThickness, 'enclosure.wallThickness', 'Wall thickness');
  requirePositive(issues, enclosure.floorThickness, 'enclosure.floorThickness', 'Floor thickness');
  requirePositive(issues, enclosure.lidThickness, 'enclosure.lidThickness', 'Lid thickness');
  requirePositive(
    issues,
    enclosure.baseInternalHeight,
    'enclosure.baseInternalHeight',
    'Base internal height',
  );
  requireNonNegative(issues, enclosure.boardClearance, 'enclosure.boardClearance', 'Board clearance');
  requireNonNegative(issues, enclosure.lidGap, 'enclosure.lidGap', 'Lid gap');
  requireNonNegative(issues, enclosure.cornerRadius, 'enclosure.cornerRadius', 'Case corner radius');
  requirePositive(
    issues,
    enclosure.standoffDiameter,
    'enclosure.standoffDiameter',
    'Standoff diameter',
  );
  requirePositive(
    issues,
    enclosure.standoffHoleDiameter,
    'enclosure.standoffHoleDiameter',
    'Standoff hole diameter',
  );
  requirePositive(issues, enclosure.standoffHeight, 'enclosure.standoffHeight', 'Standoff height');
  requirePositive(issues, enclosure.screwBossDiameter, 'enclosure.screwBossDiameter', 'Screw boss diameter');
  requirePositive(issues, enclosure.screwHoleDiameter, 'enclosure.screwHoleDiameter', 'Screw hole diameter');
  requireNonNegative(issues, enclosure.chamfer, 'enclosure.chamfer', 'Chamfer');

  if (material && enclosure.wallThickness < material.minimumFeatureSize) {
    issues.push(
      issue(
        'wall_below_material_minimum',
        'enclosure.wallThickness',
        'Wall thickness is below the selected material minimum feature size.',
      ),
    );
  }

  if (enclosure.standoffHoleDiameter >= enclosure.standoffDiameter - 0.8) {
    issues.push(
      issue(
        'standoff_wall_too_thin',
        'enclosure.standoffHoleDiameter',
        'Standoff hole leaves less than 0.4 mm radial wall thickness.',
      ),
    );
  }

  if (
    fastenerProfile &&
    (enclosure.standoffDiameter - enclosure.standoffHoleDiameter) / 2 <
      fastenerProfile.minimumWallAroundHole
  ) {
    issues.push(
      issue(
        'standoff_below_fastener_wall_minimum',
        'enclosure.standoffDiameter',
        'Standoff diameter is below the selected fastener wall requirement.',
      ),
    );
  }

  if (enclosure.screwHoleDiameter >= enclosure.screwBossDiameter - 0.8) {
    issues.push(
      issue(
        'screw_boss_wall_too_thin',
        'enclosure.screwHoleDiameter',
        'Screw boss hole leaves less than 0.4 mm radial wall thickness.',
      ),
    );
  }

  if (
    fastenerProfile &&
    (enclosure.screwBossDiameter - enclosure.screwHoleDiameter) / 2 <
      fastenerProfile.minimumWallAroundHole
  ) {
    issues.push(
      issue(
        'boss_below_fastener_wall_minimum',
        'enclosure.screwBossDiameter',
        'Screw boss diameter is below the selected fastener wall requirement.',
      ),
    );
  }

  for (const [index, hole] of pcb.mountingHoles.entries()) {
    requirePositive(issues, hole.diameter, `pcb.mountingHoles.${index}.diameter`, 'Mounting hole diameter');
    if (hole.x < 0 || hole.x > pcb.width || hole.y < 0 || hole.y > pcb.height) {
      issues.push(
        issue(
          'mounting_hole_outside_board',
          `pcb.mountingHoles.${index}`,
          `Mounting hole ${hole.id} is outside the PCB outline.`,
        ),
      );
    }
  }

  const internalWidth = pcb.width + enclosure.boardClearance * 2;
  const internalHeight = pcb.height + enclosure.boardClearance * 2;
  const outerWidth = internalWidth + enclosure.wallThickness * 2;
  const outerHeight = internalHeight + enclosure.wallThickness * 2;
  const baseOuterHeight =
    enclosure.floorThickness + enclosure.standoffHeight + pcb.thickness + enclosure.baseInternalHeight;

  for (const [index, cutout] of pcb.connectorCutouts.entries()) {
    const path = `pcb.connectorCutouts.${index}`;
    if (!cutout.label.trim()) {
      issues.push(issue('cutout_label_required', `${path}.label`, 'Cutout label is required.'));
    }
    requirePositive(issues, cutout.width, `${path}.width`, 'Cutout width');
    requirePositive(issues, cutout.height, `${path}.height`, 'Cutout height');
    requireNonNegative(issues, cutout.offset, `${path}.offset`, 'Cutout offset');
    requireNonNegative(issues, cutout.z, `${path}.z`, 'Cutout Z center');

    const span = cutout.side === 'front' || cutout.side === 'back' ? internalWidth : internalHeight;
    const minOffset = cutout.offset - cutout.width / 2;
    const maxOffset = cutout.offset + cutout.width / 2;
    if (minOffset < 0 || maxOffset > span) {
      issues.push(
        issue(
          'cutout_outside_wall_span',
          `${path}.offset`,
          `${cutout.label} cutout extends beyond the selected wall span.`,
        ),
      );
    }

    const minZ = cutout.z - cutout.height / 2;
    const maxZ = cutout.z + cutout.height / 2;
    if (minZ < enclosure.floorThickness || maxZ > baseOuterHeight) {
      issues.push(
        issue(
          'cutout_outside_wall_height',
          `${path}.z`,
          `${cutout.label} cutout must fit between the enclosure floor and top edge.`,
        ),
      );
    }
  }

  for (const [index, region] of enclosure.ventilationRegions.entries()) {
    const path = `enclosure.ventilationRegions.${index}`;
    if (!region.label.trim()) {
      issues.push(issue('vent_label_required', `${path}.label`, 'Ventilation region label is required.'));
    }
    requirePositive(issues, region.width, `${path}.width`, 'Ventilation region width');
    requirePositive(issues, region.height, `${path}.height`, 'Ventilation region height');
    requirePositive(issues, region.slotWidth, `${path}.slotWidth`, 'Ventilation slot width');
    requirePositive(issues, region.slotHeight, `${path}.slotHeight`, 'Ventilation slot height');
    requirePositive(issues, region.spacing, `${path}.spacing`, 'Ventilation slot spacing');
    requireNonNegative(issues, region.x, `${path}.x`, 'Ventilation X center');
    requireNonNegative(issues, region.y, `${path}.y`, 'Ventilation Y center');

    if (region.slotWidth > region.width || region.slotHeight > region.height) {
      issues.push(
        issue(
          'vent_slot_larger_than_region',
          path,
          `${region.label} slot dimensions must fit inside the ventilation region.`,
        ),
      );
    }

    if (
      region.x - region.width / 2 < enclosure.wallThickness ||
      region.x + region.width / 2 > outerWidth - enclosure.wallThickness ||
      region.y - region.height / 2 < enclosure.wallThickness ||
      region.y + region.height / 2 > outerHeight - enclosure.wallThickness
    ) {
      issues.push(
        issue(
          'vent_region_outside_lid',
          path,
          `${region.label} ventilation region must fit inside the lid wall boundary.`,
        ),
      );
    }

    const columns = Math.floor((region.width + region.spacing) / (region.slotWidth + region.spacing));
    const rows = Math.floor((region.height + region.spacing) / (region.slotHeight + region.spacing));
    if (columns < 1 || rows < 1) {
      issues.push(
        issue(
          'vent_region_has_no_slots',
          path,
          `${region.label} ventilation region does not produce any slots.`,
        ),
      );
    }
  }

  return { ok: issues.length === 0, issues };
}
