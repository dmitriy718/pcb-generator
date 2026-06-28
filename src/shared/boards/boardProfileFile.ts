import { z } from 'zod';
import { defaultProject, type BoardProfile } from '../domain';
import { validateProject } from '../domain';

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

const pcbSchema = z.object({
  width: z.number(),
  height: z.number(),
  thickness: z.number(),
  componentHeight: z.number().default(0),
  cornerRadius: z.number(),
  mountingHoles: z.array(mountingHoleSchema),
  connectorCutouts: z.array(connectorCutoutSchema).default([]),
});

const boardProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  family: z.string().min(1),
  source: z.literal('custom').default('custom'),
  notes: z.string(),
  pcb: pcbSchema,
});

const boardProfileFileSchema = z.object({
  format: z.literal('pcb-enclosure-board-profile'),
  version: z.literal(1),
  profile: boardProfileSchema,
});

export type BoardProfileFile = z.infer<typeof boardProfileFileSchema>;

export function serializeBoardProfileFile(profile: BoardProfile): string {
  const normalized = { ...profile, source: 'custom' as const };
  validateBoardProfile(normalized);
  const file: BoardProfileFile = {
    format: 'pcb-enclosure-board-profile',
    version: 1,
    profile: normalized,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseBoardProfileFile(contents: string): BoardProfile {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Board profile file is not valid JSON: ${errorMessage(error)}`);
  }

  const parsed = boardProfileFileSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `Board profile file schema is invalid: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
    );
  }

  validateBoardProfile(parsed.data.profile);
  return parsed.data.profile;
}

export function validateBoardProfile(profile: BoardProfile): void {
  const validation = validateProject({
    ...defaultProject,
    name: `${profile.name} Enclosure`,
    pcb: profile.pcb,
    enclosure: {
      ...defaultProject.enclosure,
      baseInternalHeight: Math.max(defaultProject.enclosure.baseInternalHeight, profile.pcb.componentHeight + 0.3),
    },
  });
  if (!validation.ok) {
    throw new Error(
      `Board profile contains invalid geometry: ${validation.issues.map((issue) => issue.message).join('; ')}`,
    );
  }
}

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'custom-board';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
