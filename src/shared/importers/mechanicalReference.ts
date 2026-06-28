import type { PcbSpecification } from '../domain';

type ReferenceSource = 'STL' | 'STEP';
type ReferenceAxis = 'x' | 'y' | 'z';

interface ReferenceExtent {
  axis: ReferenceAxis;
  size: number;
}

interface MechanicalReferenceInferenceOptions {
  source: ReferenceSource;
  extents: ReferenceExtent[];
  candidateBoardThickness?: number | undefined;
}

interface MechanicalReferenceInference {
  pcb: PcbSpecification;
  warnings: string[];
}

const defaultBoardThickness = 1.6;
const flatThicknessThreshold = 0.05;
const populatedAssemblyThicknessThreshold = 4;
const minimumLikelyPcbThickness = 0.6;
const maximumLikelyPcbThickness = 3.2;
const smallBoardDimensionWarningThreshold = 5;
const largeBoardDimensionWarningThreshold = 1_000;

export function inferPcbFromMechanicalReference(
  options: MechanicalReferenceInferenceOptions,
): MechanicalReferenceInference {
  const sortedExtents = [...options.extents]
    .map((extent) => ({ ...extent, size: round(extent.size) }))
    .sort((a, b) => b.size - a.size);
  const width = sortedExtents[0]?.size ?? 0;
  const height = sortedExtents[1]?.size ?? 0;
  const measuredThickness = sortedExtents[2]?.size ?? 0;
  const thinAxis = sortedExtents[2]?.axis;

  if (width <= 0 || height <= 0) {
    throw new Error(`${options.source} PCB import could not determine positive board width and height.`);
  }

  const warnings = baseWarnings(options.source);
  if (thinAxis && thinAxis !== 'z') {
    warnings.push(
      `${options.source} thin axis was ${thinAxis.toUpperCase()}, so dimensions were reoriented from model extents; verify PCB orientation.`,
    );
  }
  if (width < smallBoardDimensionWarningThreshold || height < smallBoardDimensionWarningThreshold) {
    warnings.push(`${options.source} extents are unusually small for a PCB; verify the file uses millimeters.`);
  }
  if (width > largeBoardDimensionWarningThreshold || height > largeBoardDimensionWarningThreshold) {
    warnings.push(`${options.source} extents are unusually large for a PCB; verify the file uses millimeters.`);
  }

  let thickness = measuredThickness;
  let componentHeight = 0;
  if (thickness <= flatThicknessThreshold) {
    thickness = defaultBoardThickness;
    warnings.push(`${options.source} thickness was flat or missing; defaulted board thickness to 1.6 mm.`);
  } else if (thickness > populatedAssemblyThicknessThreshold) {
    const inferredBoardThickness = likelyPcbThickness(options.candidateBoardThickness)
      ? round(options.candidateBoardThickness)
      : defaultBoardThickness;
    thickness = inferredBoardThickness;
    componentHeight = Math.max(0, round(measuredThickness - inferredBoardThickness));
    warnings.push(
      `${options.source} reference height (${measuredThickness} mm) looks like a populated assembly; board thickness was set to ${formatMillimeters(
        thickness,
      )} mm and component height to ${formatMillimeters(componentHeight)} mm.`,
    );
  }

  return {
    pcb: {
      width,
      height,
      thickness,
      componentHeight,
      cornerRadius: 0,
      mountingHoles: [],
      connectorCutouts: [],
    },
    warnings,
  };
}

function baseWarnings(source: ReferenceSource): string[] {
  if (source === 'STL') {
    return [
      'STL has no PCB semantics; board dimensions were inferred from mesh bounds.',
      'Mounting holes, connector cutouts, components, and ports must be verified or added manually.',
    ];
  }
  return [
    'STEP geometry was imported from model bounds; verify PCB orientation and dimensions.',
    'Mounting holes, connector cutouts, and components must be verified or added manually when STEP metadata is unavailable.',
  ];
}

function likelyPcbThickness(value: number | undefined): value is number {
  return (
    value !== undefined &&
    Number.isFinite(value) &&
    value >= minimumLikelyPcbThickness &&
    value <= maximumLikelyPcbThickness
  );
}

function formatMillimeters(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(3).replace(/0+$/u, '').replace(/\.$/u, '');
}

function round(value: number | undefined): number {
  return Math.round((value ?? 0) * 1000) / 1000;
}
