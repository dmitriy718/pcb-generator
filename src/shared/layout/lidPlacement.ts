import { validateProject } from '../domain';
import type { DesignFeature, EnclosureProject, VentilationRegion } from '../domain';

export type DesignFeaturePlacementPreset = Omit<DesignFeature, 'id' | 'x' | 'y'> & {
  xRatio: number;
  yRatio: number;
};

export type VentilationPlacementPreset = Omit<VentilationRegion, 'id' | 'x' | 'y'>;

export interface AutoArrangeResult {
  project: EnclosureProject;
  movedCount: number;
  unresolvedLabels: string[];
}

export function placeDesignFeaturePreset(
  project: EnclosureProject,
  preset: DesignFeaturePlacementPreset,
  id: string,
): DesignFeature | undefined {
  const { xRatio, yRatio, ...feature } = preset;
  return placeDesignFeature(project, { id, ...feature }, xRatio, yRatio);
}

export function placeVentilationPreset(
  project: EnclosureProject,
  preset: VentilationPlacementPreset,
  id: string,
): VentilationRegion | undefined {
  const dims = outerLidDimensions(project);
  const newIndex = project.enclosure.ventilationRegions.length;

  for (const center of placementCenters(0.5, 0.5)) {
    const candidate: VentilationRegion = {
      id,
      label: preset.label,
      x: roundPlacement(clampToLid(center.xRatio * dims.outerWidth, project.enclosure.wallThickness, dims.outerWidth, preset.width)),
      y: roundPlacement(clampToLid(center.yRatio * dims.outerHeight, project.enclosure.wallThickness, dims.outerHeight, preset.height)),
      width: preset.width,
      height: preset.height,
      slotWidth: preset.slotWidth,
      slotHeight: preset.slotHeight,
      spacing: preset.spacing,
    };
    const candidateProject: EnclosureProject = {
      ...project,
      enclosure: {
        ...project.enclosure,
        ventilationRegions: [...project.enclosure.ventilationRegions, candidate],
      },
    };

    if (!hasBlockingPlacementIssue(candidateProject, `enclosure.ventilationRegions.${newIndex}`, candidate.label)) {
      return candidate;
    }
  }

  return undefined;
}

export function autoArrangeDesignFeatures(project: EnclosureProject): AutoArrangeResult {
  const dims = outerLidDimensions(project);
  const arrangedFeatures: DesignFeature[] = [];
  const unresolvedFeatures: DesignFeature[] = [];

  for (const feature of project.enclosure.designFeatures) {
    const baseProject: EnclosureProject = {
      ...project,
      enclosure: {
        ...project.enclosure,
        designFeatures: arrangedFeatures,
      },
    };
    const placed = placeDesignFeature(
      baseProject,
      feature,
      clampRatio(feature.x / dims.outerWidth),
      clampRatio(feature.y / dims.outerHeight),
    );
    if (placed) {
      arrangedFeatures.push(placed);
    } else {
      unresolvedFeatures.push(feature);
    }
  }

  const arrangedProject: EnclosureProject = {
    ...project,
    enclosure: {
      ...project.enclosure,
      designFeatures: [...arrangedFeatures, ...unresolvedFeatures],
    },
  };

  return {
    project: arrangedProject,
    movedCount: arrangedFeatures.filter((feature) => {
      const original = project.enclosure.designFeatures.find((current) => current.id === feature.id);
      return original !== undefined && (original.x !== feature.x || original.y !== feature.y);
    }).length,
    unresolvedLabels: unresolvedFeatures.map((feature) => feature.label),
  };
}

function placeDesignFeature(
  project: EnclosureProject,
  feature: Omit<DesignFeature, 'x' | 'y'>,
  preferredXRatio: number,
  preferredYRatio: number,
): DesignFeature | undefined {
  const dims = outerLidDimensions(project);
  const size = featurePatternSize(feature);
  const newIndex = project.enclosure.designFeatures.length;

  for (const center of placementCenters(preferredXRatio, preferredYRatio)) {
    const candidate: DesignFeature = {
      ...feature,
      x: roundPlacement(clampToLid(center.xRatio * dims.outerWidth, project.enclosure.wallThickness, dims.outerWidth, size.width)),
      y: roundPlacement(clampToLid(center.yRatio * dims.outerHeight, project.enclosure.wallThickness, dims.outerHeight, size.height)),
    };
    const candidateProject: EnclosureProject = {
      ...project,
      enclosure: {
        ...project.enclosure,
        designFeatures: [...project.enclosure.designFeatures, candidate],
      },
    };

    if (!hasBlockingPlacementIssue(candidateProject, `enclosure.designFeatures.${newIndex}`, candidate.label)) {
      return candidate;
    }
  }

  return undefined;
}

function hasBlockingPlacementIssue(project: EnclosureProject, path: string, label: string): boolean {
  return validateProject(project).issues.some((issue) => issue.path === path || issue.message.includes(label));
}

function placementCenters(primaryX: number, primaryY: number): { xRatio: number; yRatio: number }[] {
  const xRatios = uniqueRatios([primaryX, 0.5, 0.25, 0.75, 0.35, 0.65, 0.15, 0.85]);
  const yRatios = uniqueRatios([primaryY, 0.5, 0.25, 0.75, 0.35, 0.65, 0.15, 0.85]);
  return xRatios.flatMap((xRatio) => yRatios.map((yRatio) => ({ xRatio, yRatio })));
}

function uniqueRatios(values: number[]): number[] {
  return [...new Set(values.map((value) => Number(clampRatio(value).toFixed(3))))];
}

function featurePatternSize(feature: Omit<DesignFeature, 'x' | 'y'>): { width: number; height: number } {
  const footprintWidth = feature.shape === 'circle' ? feature.diameter : feature.width;
  const footprintHeight = feature.shape === 'circle' ? feature.diameter : feature.height;
  return {
    width: feature.columns * footprintWidth + (feature.columns - 1) * feature.spacing,
    height: feature.rows * footprintHeight + (feature.rows - 1) * feature.spacing,
  };
}

function outerLidDimensions(project: EnclosureProject): { outerWidth: number; outerHeight: number } {
  const internalWidth = project.pcb.width + project.enclosure.boardClearance * 2;
  const internalHeight = project.pcb.height + project.enclosure.boardClearance * 2;
  return {
    outerWidth: internalWidth + project.enclosure.wallThickness * 2,
    outerHeight: internalHeight + project.enclosure.wallThickness * 2,
  };
}

function clampToLid(value: number, wallThickness: number, outerSize: number, featureSize: number): number {
  const margin = 0.25;
  const min = wallThickness + featureSize / 2 + margin;
  const max = outerSize - wallThickness - featureSize / 2 - margin;
  if (max < min) {
    return value;
  }
  return Math.min(Math.max(value, min), max);
}

function clampRatio(value: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0.5, 0.1), 0.9);
}

function roundPlacement(value: number): number {
  return Number(value.toFixed(1));
}
