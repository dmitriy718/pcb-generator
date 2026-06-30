import type {
  ConnectorCutout,
  CutoutSide,
  DesignFeature,
  EnclosureProject,
  MaterialId,
  VentilationRegion,
} from '../domain';
import { materialProfiles } from '../domain';

export interface DesignAssistantResult {
  project: EnclosureProject;
  applied: string[];
  warnings: string[];
  intent?: DesignPromptIntent;
}

export interface DesignPromptIntent {
  material?: MaterialId;
  style?: 'compact' | 'handheld' | 'desktop' | 'wall_mount';
  connectors?: { type: 'usb-c' | 'micro_usb' | 'ethernet' | 'hdmi' | 'sma' | 'gpio'; side?: CutoutSide }[];
  display?: 'oled' | 'touchscreen';
  button?: boolean;
  switch?: boolean;
  battery?: boolean;
  speaker?: boolean;
  ventilation?: boolean;
  logo?: string;
}

export interface DesignPromptProviderRequest {
  prompt: string;
  project: EnclosureProject;
}

export type DesignPromptProvider = (request: DesignPromptProviderRequest) => Promise<DesignPromptIntent>;

interface ConnectorIntent {
  key: string;
  label: string;
  width: number;
  height: number;
  defaultSide: CutoutSide;
}

const connectorIntents: ConnectorIntent[] = [
  { key: 'usb-c', label: 'USB-C', width: 10, height: 4, defaultSide: 'front' },
  { key: 'usbc', label: 'USB-C', width: 10, height: 4, defaultSide: 'front' },
  { key: 'micro usb', label: 'Micro USB', width: 9, height: 4, defaultSide: 'front' },
  { key: 'ethernet', label: 'Ethernet', width: 16, height: 14, defaultSide: 'right' },
  { key: 'rj45', label: 'Ethernet', width: 16, height: 14, defaultSide: 'right' },
  { key: 'hdmi', label: 'HDMI', width: 15, height: 6, defaultSide: 'front' },
  { key: 'sma', label: 'SMA', width: 8, height: 8, defaultSide: 'back' },
  { key: 'gpio', label: 'GPIO header', width: 28, height: 6, defaultSide: 'left' },
];

export function applyDesignPrompt(project: EnclosureProject, prompt: string): DesignAssistantResult {
  const normalizedPrompt = normalize(prompt);
  if (!normalizedPrompt) {
    return {
      project,
      applied: [],
      warnings: ['Enter a design prompt before applying assistant changes.'],
    };
  }

  const next = structuredClone(project);
  const applied: string[] = [];
  const warnings: string[] = [];
  const outer = outerDimensions(next);

  const material = materialFromPrompt(normalizedPrompt);
  if (material) {
    next.enclosure.material = material;
    next.enclosure.wallThickness = Math.max(next.enclosure.wallThickness, materialProfiles[material].wallThickness);
    next.enclosure.baseInternalHeight = Math.max(
      next.enclosure.baseInternalHeight,
      Number((next.pcb.componentHeight + materialProfiles[material].clearance).toFixed(1)),
    );
    applied.push(`Material set to ${materialProfiles[material].name}`);
  }

  if (hasAny(normalizedPrompt, ['handheld', 'portable', 'rounded'])) {
    next.enclosure.cornerRadius = Math.max(next.enclosure.cornerRadius, 8);
    next.enclosure.chamfer = Math.max(next.enclosure.chamfer, 0.8);
    next.enclosure.boardClearance = Math.max(next.enclosure.boardClearance, 2.5);
    applied.push('Rounded handheld ergonomics');
  }

  for (const connector of connectorIntents) {
    if (!normalizedPrompt.includes(connector.key)) {
      continue;
    }
    const side = sideNearKeyword(normalizedPrompt, connector.key) ?? connector.defaultSide;
    if (!hasConnector(next.pcb.connectorCutouts, connector.label, side)) {
      next.pcb.connectorCutouts.push({
        id: uniqueId(
          next.pcb.connectorCutouts.map((cutout) => cutout.id),
          `assistant-${slug(connector.label)}`,
        ),
        label: connector.label,
        side,
        offset: connectorOffset(next, side),
        z: next.enclosure.floorThickness + 5,
        width: connector.width,
        height: connector.height,
      });
      applied.push(`${connector.label} cutout on ${side}`);
    }
  }

  if (hasAny(normalizedPrompt, ['oled', 'display', 'screen', 'touchscreen'])) {
    addFeature(next, applied, {
      label: normalizedPrompt.includes('touchscreen') ? 'Touchscreen opening' : 'OLED display opening',
      kind: 'display_opening',
      shape: 'rounded_rectangle',
      operation: 'through_cut',
      x: round(outer.width * 0.8),
      y: round(outer.height * 0.48),
      width: normalizedPrompt.includes('touchscreen') ? 28 : 18,
      height: normalizedPrompt.includes('touchscreen') ? 18 : 9,
      diameter: 14,
      depth: next.enclosure.lidThickness,
      cornerRadius: 2,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: '',
    });
  }

  if (hasAny(normalizedPrompt, ['button', 'switch'])) {
    addFeature(next, applied, {
      label: normalizedPrompt.includes('switch') ? 'Switch opening' : 'Button opening',
      kind: 'button_opening',
      shape: 'circle',
      operation: 'through_cut',
      x: round(outer.width * 0.32),
      y: round(outer.height * 0.68),
      width: 7,
      height: 7,
      diameter: 7,
      depth: next.enclosure.lidThickness,
      cornerRadius: 0,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: '',
    });
  }

  if (hasAny(normalizedPrompt, ['battery', 'lipo', 'li-po', '18650'])) {
    addFeature(next, applied, {
      label: 'Battery tray',
      kind: 'battery_tray',
      shape: 'rounded_rectangle',
      operation: 'recess',
      x: round(outer.width * 0.68),
      y: round(outer.height * 0.82),
      width: Math.min(16, round(outer.width * 0.25)),
      height: Math.min(7, round(outer.height * 0.2)),
      diameter: 7,
      depth: Math.min(0.55, next.enclosure.lidThickness * 0.35),
      cornerRadius: 1.5,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: 'BAT',
    });
  }

  if (hasAny(normalizedPrompt, ['speaker', 'audio holes'])) {
    addFeature(next, applied, {
      label: 'Speaker grill',
      kind: 'speaker_grill',
      shape: 'circle',
      operation: 'through_cut',
      x: round(outer.width * 0.36),
      y: round(outer.height * 0.72),
      width: 2,
      height: 2,
      diameter: 2,
      depth: next.enclosure.lidThickness,
      cornerRadius: 0,
      spacing: 4,
      rows: 3,
      columns: 3,
      text: '',
    });
  }

  if (hasAny(normalizedPrompt, ['vent', 'ventilation', 'airflow', 'cooling'])) {
    addVent(next, applied, {
      id: uniqueId(
        next.enclosure.ventilationRegions.map((region) => region.id),
        'assistant-vent',
      ),
      label: 'Assistant ventilation',
      x: round(outer.width * 0.37),
      y: round(outer.height * 0.29),
      width: Math.min(24, round(outer.width * 0.32)),
      height: Math.min(10, round(outer.height * 0.22)),
      slotWidth: 2.4,
      slotHeight: 10,
      spacing: 2.4,
    });
  }

  if (normalizedPrompt.includes('logo')) {
    addFeature(next, applied, {
      label: 'Logo badge',
      kind: 'logo_badge',
      shape: 'rounded_rectangle',
      operation: 'emboss',
      x: round(outer.width * 0.66),
      y: round(outer.height * 0.76),
      width: 10,
      height: 5,
      diameter: 10,
      depth: Math.max(0.8, materialProfiles[next.enclosure.material].minimumFeatureSize),
      cornerRadius: 2,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: 'OSHW',
    });
  }

  if (applied.length === 0) {
    warnings.push('No supported design phrases were found. Try words like USB-C, OLED, battery, speaker, ventilation, button, rounded, handheld, or material names.');
  }

  return { project: next, applied, warnings };
}

export async function applyDesignPromptWithProvider(
  project: EnclosureProject,
  prompt: string,
  provider: DesignPromptProvider,
): Promise<DesignAssistantResult> {
  const intent = sanitizeIntent(await provider({ prompt, project: structuredClone(project) }));
  const result = applyDesignPrompt(project, intentToPrompt(intent));
  return {
    ...result,
    intent,
    warnings: [
      ...result.warnings,
      ...(prompt.trim() ? [] : ['Provider was called with an empty original prompt.']),
    ],
  };
}

function sanitizeIntent(intent: DesignPromptIntent): DesignPromptIntent {
  const sanitized: DesignPromptIntent = {};
  if (intent.material) {
    sanitized.material = intent.material;
  }
  if (intent.style) {
    sanitized.style = intent.style;
  }
  const connectors = intent.connectors
    ?.filter((connector) =>
      ['usb-c', 'micro_usb', 'ethernet', 'hdmi', 'sma', 'gpio'].includes(connector.type),
    )
    .map((connector) => ({
      type: connector.type,
      ...(connector.side ? { side: connector.side } : {}),
    }));
  if (connectors && connectors.length > 0) {
    sanitized.connectors = connectors;
  }
  if (intent.display) {
    sanitized.display = intent.display;
  }
  if (intent.button === true) {
    sanitized.button = true;
  }
  if (intent.switch === true) {
    sanitized.switch = true;
  }
  if (intent.battery === true) {
    sanitized.battery = true;
  }
  if (intent.speaker === true) {
    sanitized.speaker = true;
  }
  if (intent.ventilation === true) {
    sanitized.ventilation = true;
  }
  if (intent.logo?.trim()) {
    sanitized.logo = intent.logo.trim();
  }
  return sanitized;
}

function intentToPrompt(intent: DesignPromptIntent): string {
  const phrases: string[] = [];
  if (intent.style === 'handheld') phrases.push('handheld rounded');
  if (intent.style === 'desktop') phrases.push('desktop');
  if (intent.style === 'wall_mount') phrases.push('wall mount');
  if (intent.material) phrases.push(intent.material.replace('_', ' '));
  for (const connector of intent.connectors ?? []) {
    const label = connector.type === 'micro_usb' ? 'micro usb' : connector.type;
    phrases.push(`${label}${connector.side ? ` on the ${connector.side}` : ''}`);
  }
  if (intent.display === 'touchscreen') phrases.push('touchscreen');
  if (intent.display === 'oled') phrases.push('oled');
  if (intent.button) phrases.push('button');
  if (intent.switch) phrases.push('switch');
  if (intent.battery) phrases.push('battery');
  if (intent.speaker) phrases.push('speaker holes');
  if (intent.ventilation) phrases.push('ventilation');
  if (intent.logo) phrases.push('logo');
  return phrases.join(', ');
}

function addFeature(
  project: EnclosureProject,
  applied: string[],
  feature: Omit<DesignFeature, 'id'>,
): void {
  if (project.enclosure.designFeatures.some((existing) => existing.label === feature.label)) {
    return;
  }
  project.enclosure.designFeatures.push({
    ...feature,
    id: uniqueId(
      project.enclosure.designFeatures.map((existing) => existing.id),
      `assistant-${slug(feature.label)}`,
    ),
  });
  applied.push(feature.label);
}

function addVent(project: EnclosureProject, applied: string[], region: VentilationRegion): void {
  if (project.enclosure.ventilationRegions.length > 0) {
    applied.push('Existing ventilation retained');
    return;
  }
  if (project.enclosure.ventilationRegions.some((existing) => existing.label === region.label)) {
    return;
  }
  project.enclosure.ventilationRegions.push(region);
  applied.push(region.label);
}

function materialFromPrompt(prompt: string): MaterialId | undefined {
  if (prompt.includes('petg')) return 'petg';
  if (prompt.includes('abs')) return 'abs';
  if (prompt.includes('asa')) return 'asa';
  if (prompt.includes('tpu')) return 'tpu';
  if (prompt.includes('nylon')) return 'nylon';
  if (prompt.includes('carbon') || prompt.includes('cf pla')) return 'cf_pla';
  if (prompt.includes('pla')) return 'pla';
  return undefined;
}

function sideNearKeyword(prompt: string, keyword: string): CutoutSide | undefined {
  const index = prompt.indexOf(keyword);
  const context = prompt.slice(Math.max(0, index - 24), index + keyword.length + 24);
  if (context.includes('left')) return 'left';
  if (context.includes('right')) return 'right';
  if (context.includes('back') || context.includes('rear')) return 'back';
  if (context.includes('front')) return 'front';
  return undefined;
}

function hasConnector(cutouts: ConnectorCutout[], label: string, side: CutoutSide): boolean {
  return cutouts.some((cutout) => cutout.label.toLowerCase() === label.toLowerCase() && cutout.side === side);
}

function connectorOffset(project: EnclosureProject, side: CutoutSide): number {
  const span =
    side === 'front' || side === 'back'
      ? project.pcb.width + project.enclosure.boardClearance * 2
      : project.pcb.height + project.enclosure.boardClearance * 2;
  return round(span / 2);
}

function outerDimensions(project: EnclosureProject): { width: number; height: number } {
  return {
    width: project.pcb.width + project.enclosure.boardClearance * 2 + project.enclosure.wallThickness * 2,
    height: project.pcb.height + project.enclosure.boardClearance * 2 + project.enclosure.wallThickness * 2,
  };
}

function hasAny(prompt: string, phrases: string[]): boolean {
  return phrases.some((phrase) => prompt.includes(phrase));
}

function normalize(prompt: string): string {
  return prompt.toLowerCase().replace(/usb[\s-]?c/gu, 'usb-c').trim();
}

function uniqueId(existingIds: string[], base: string): string {
  const existing = new Set(existingIds);
  let candidate = base;
  let counter = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
