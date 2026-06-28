import { z } from 'zod';

export const currentPluginApiVersion = '1';

const pluginIdSchema = z.string().regex(/^[a-z0-9][a-z0-9.-]{2,63}$/u);
const semverSchema = z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u);
const capabilityKindSchema = z.enum([
  'connector_library',
  'board_library',
  'fastener_profile',
  'enclosure_template',
  'vent_generator',
  'exporter',
  'material_profile',
]);

const pluginCapabilitySchema = z.object({
  kind: capabilityKindSchema,
  id: pluginIdSchema,
  name: z.string().min(1),
  version: semverSchema.default('1.0.0'),
  description: z.string().default(''),
});

const pluginManifestSchema = z.object({
  format: z.literal('pcb-enclosure-plugin'),
  apiVersion: z.string().min(1),
  id: pluginIdSchema,
  name: z.string().min(1),
  version: semverSchema,
  description: z.string().default(''),
  author: z.string().default(''),
  capabilities: z.array(pluginCapabilitySchema).min(1),
  sandbox: z
    .object({
      permissions: z
        .array(z.enum(['read_project', 'write_project', 'file_import', 'file_export', 'network']))
        .default([]),
    })
    .default({ permissions: [] }),
});

export type PluginCapabilityKind = z.infer<typeof capabilityKindSchema>;
export type PluginCapability = z.infer<typeof pluginCapabilitySchema>;
export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export interface RegisteredPluginCapability extends PluginCapability {
  pluginId: string;
  pluginName: string;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, PluginManifest>();

  register(manifest: PluginManifest): void {
    if (!isPluginApiCompatible(manifest.apiVersion)) {
      throw new Error(
        `Plugin ${manifest.id} targets unsupported plugin API ${manifest.apiVersion}; this app supports API ${currentPluginApiVersion}.`,
      );
    }
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin id ${manifest.id} is already registered.`);
    }
    this.plugins.set(manifest.id, manifest);
  }

  listPlugins(): PluginManifest[] {
    return [...this.plugins.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  pluginById(id: string): PluginManifest | undefined {
    return this.plugins.get(id);
  }

  capabilities(kind?: PluginCapabilityKind): RegisteredPluginCapability[] {
    return this.listPlugins().flatMap((plugin) =>
      plugin.capabilities
        .filter((capability) => kind === undefined || capability.kind === kind)
        .map((capability) => ({
          ...capability,
          pluginId: plugin.id,
          pluginName: plugin.name,
        })),
    );
  }
}

export function parsePluginManifest(contents: string | Record<string, unknown>): PluginManifest {
  const parsed = typeof contents === 'string' ? parseJson(contents) : contents;
  return pluginManifestSchema.parse(parsed);
}

export function isPluginApiCompatible(apiVersion: string): boolean {
  return apiVersion.split('.')[0] === currentPluginApiVersion;
}

function parseJson(contents: string): unknown {
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`Invalid plugin manifest JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
