import { z } from 'zod';
import type { BoardProfile, TwoPieceScrewCaseParameters } from '../domain';
import { defaultProject, validateProject } from '../domain';
import { validateBoardProfile } from '../boards/boardProfileFile';
import type { EnclosureTemplate } from '../enclosureTemplates';
import { parsePluginManifest, PluginRegistry, type PluginManifest } from './pluginManifest';

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

const boardProfileContributionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  family: z.string().min(1),
  notes: z.string(),
  pcb: pcbSchema,
});

const enclosurePatchSchema = z.object({
  wallThickness: z.number().optional(),
  floorThickness: z.number().optional(),
  lidThickness: z.number().optional(),
  baseInternalHeight: z.number().optional(),
  boardClearance: z.number().optional(),
  lidGap: z.number().optional(),
  cornerRadius: z.number().optional(),
  standoffDiameter: z.number().optional(),
  standoffHoleDiameter: z.number().optional(),
  standoffHeight: z.number().optional(),
  screwBossDiameter: z.number().optional(),
  screwHoleDiameter: z.number().optional(),
  chamfer: z.number().optional(),
});

const enclosureTemplateContributionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  patch: enclosurePatchSchema,
});

const pluginPackageSchema = z.object({
  format: z.literal('pcb-enclosure-plugin-package'),
  manifest: z.record(z.string(), z.unknown()),
  contributions: z
    .object({
      boardProfiles: z.array(boardProfileContributionSchema).default([]),
      enclosureTemplates: z.array(enclosureTemplateContributionSchema).default([]),
    })
    .default({ boardProfiles: [], enclosureTemplates: [] }),
});

export interface LoadedPluginPackage {
  manifest: PluginManifest;
  boardProfiles: BoardProfile[];
  enclosureTemplates: EnclosureTemplate[];
}

export function loadDeclarativePluginPackage(
  contents: string | Record<string, unknown>,
  registry = new PluginRegistry(),
): LoadedPluginPackage {
  const parsedJson = typeof contents === 'string' ? parseJson(contents) : contents;
  const parsed = pluginPackageSchema.parse(parsedJson);
  const manifest = parsePluginManifest(parsed.manifest);
  registry.register(manifest);

  const boardProfiles = parsed.contributions.boardProfiles.map((profile) => {
    const normalized: BoardProfile = { ...profile, source: 'custom' };
    validateBoardProfile(normalized);
    return normalized;
  });
  const enclosureTemplates = parsed.contributions.enclosureTemplates.map((template): EnclosureTemplate => ({
    id: `${manifest.id}.${template.id}`,
    name: template.name,
    description: template.description,
    apply: (project) => {
      const patch = definedPatch(template.patch) as Partial<TwoPieceScrewCaseParameters>;
      return {
        ...project.enclosure,
        ...patch,
        type: 'two_piece_screw_case',
      };
    },
  }));

  for (const template of enclosureTemplates) {
    const validationProject = {
      ...defaultProject,
      enclosure: template.apply(defaultProject),
    };
    const validation = validateProject(validationProject);
    if (!validation.ok) {
      throw new Error(
        `Plugin enclosure template ${template.id} is invalid: ${validation.issues
          .map((issue) => issue.message)
          .join('; ')}`,
      );
    }
  }

  return { manifest, boardProfiles, enclosureTemplates };
}

function definedPatch<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function parseJson(contents: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(contents) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('expected a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid plugin package JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
