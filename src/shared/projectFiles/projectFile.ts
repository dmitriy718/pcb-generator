import { z } from 'zod';
import type { EnclosureProject } from '../domain';
import { validateProject } from '../domain';

const materialIdSchema = z.enum(['pla', 'petg', 'abs', 'asa', 'tpu', 'cf_pla', 'nylon']);
const cutoutSideSchema = z.enum(['front', 'back', 'left', 'right']);

const mountingHoleSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  diameter: z.number(),
});

const connectorCutoutSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  side: cutoutSideSchema,
  offset: z.number(),
  z: z.number(),
  width: z.number(),
  height: z.number(),
});

const ventilationRegionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  slotWidth: z.number(),
  slotHeight: z.number(),
  spacing: z.number(),
});

const designFeatureSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  kind: z.enum([
    'display_opening',
    'button_opening',
    'antenna_hole',
    'speaker_grill',
    'fan_grill',
    'label_recess',
    'text_engraving',
    'logo_badge',
    'cable_slot',
    'zip_tie_anchor',
    'qr_recess',
  ]),
  shape: z.enum(['rectangle', 'rounded_rectangle', 'circle']),
  operation: z.enum(['through_cut', 'recess', 'emboss']),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  diameter: z.number(),
  depth: z.number(),
  cornerRadius: z.number(),
  spacing: z.number(),
  rows: z.number(),
  columns: z.number(),
  text: z.string().default(''),
  customFootprints: z
    .array(
      z.object({
        xRatio: z.number(),
        yRatio: z.number(),
        widthRatio: z.number(),
        heightRatio: z.number(),
        cornerRadiusRatio: z.number(),
      }),
    )
    .optional(),
});

const pcbSchema = z.object({
  width: z.number(),
  height: z.number(),
  thickness: z.number(),
  componentHeight: z.number().default(0),
  cornerRadius: z.number(),
  mountingHoles: z.array(mountingHoleSchema),
  connectorCutouts: z.array(connectorCutoutSchema).default([]),
});

const enclosureSchema = z.object({
  type: z.literal('two_piece_screw_case'),
  material: materialIdSchema,
  fastenerProfileId: z.string().default('m2_5_self_tapping'),
  wallThickness: z.number(),
  floorThickness: z.number(),
  lidThickness: z.number(),
  baseInternalHeight: z.number(),
  boardClearance: z.number(),
  lidGap: z.number(),
  cornerRadius: z.number(),
  standoffDiameter: z.number(),
  standoffHoleDiameter: z.number(),
  standoffHeight: z.number(),
  screwBossDiameter: z.number(),
  screwHoleDiameter: z.number(),
  chamfer: z.number(),
  ventilationRegions: z.array(ventilationRegionSchema).default([]),
  designFeatures: z.array(designFeatureSchema).default([]),
});

const projectSchema = z.object({
  name: z.string(),
  pcb: pcbSchema,
  enclosure: enclosureSchema,
});

const projectFileSchema = z.object({
  format: z.literal('pcb-enclosure-generator'),
  version: z.literal(1),
  project: projectSchema,
});

export type ProjectFile = z.infer<typeof projectFileSchema>;

export function serializeProjectFile(project: EnclosureProject): string {
  const validation = validateProject(project);
  if (!validation.ok) {
    throw new Error(validation.issues.map((issue) => issue.message).join('\n'));
  }

  const file: ProjectFile = {
    format: 'pcb-enclosure-generator',
    version: 1,
    project,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseProjectFile(contents: string): EnclosureProject {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Project file is not valid JSON: ${errorMessage(error)}`);
  }

  const parsed = projectFileSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`Project file schema is invalid: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
  }

  const project = parsed.data.project;
  const validation = validateProject(project);
  if (!validation.ok) {
    throw new Error(`Project file contains invalid parameters: ${validation.issues.map((issue) => issue.message).join('; ')}`);
  }

  return project;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
