import { designFeatureFootprints } from '../cad/designFeatureGeometry';
import type {
  ConnectorCutout,
  DesignFeature,
  EnclosureProject,
  ManufacturingMetadata,
  VentilationRegion,
} from '../domain';

interface DrawingDimensions {
  internalWidth: number;
  internalHeight: number;
  outerWidth: number;
  outerHeight: number;
  baseHeight: number;
  pcbOriginX: number;
  pcbOriginY: number;
}

export function exportSvgDrawing(project: EnclosureProject): string {
  const dims = drawingDimensions(project);
  const margin = 12;
  const elevationGap = 18;
  const width = dims.outerWidth + margin * 2;
  const height = dims.outerHeight + dims.baseHeight + elevationGap + margin * 2;
  const topOrigin = { x: margin, y: margin };
  const elevationOrigin = { x: margin, y: margin + dims.outerHeight + elevationGap };

  const frontCutouts = project.pcb.connectorCutouts.filter((cutout) => cutout.side === 'front');
  const ventElements = project.enclosure.ventilationRegions
    .flatMap((region) => ventilationSlotFootprints(region))
    .map((slot) => {
      const x = topOrigin.x + slot.x - slot.width / 2;
      const y = topOrigin.y + slot.y - slot.height / 2;
      return `  <rect class="vent" x="${format(x)}" y="${format(y)}" width="${format(slot.width)}" height="${format(
        slot.height,
      )}" />`;
    })
    .join('\n');
  const featureElements = project.enclosure.designFeatures
    .flatMap((feature) =>
      designFeatureFootprints(feature).map((footprint, index) => svgFeatureFootprint(topOrigin.x, topOrigin.y, feature, footprint, index)),
    )
    .join('\n');
  const holeElements = project.pcb.mountingHoles
    .map((hole) => {
      const cx = topOrigin.x + dims.pcbOriginX + hole.x;
      const cy = topOrigin.y + dims.pcbOriginY + hole.y;
      return `  <circle class="hole" cx="${format(cx)}" cy="${format(cy)}" r="${format(hole.diameter / 2)}" />`;
    })
    .join('\n');

  const cutoutElements = frontCutouts
    .map((cutout) => {
      const x = elevationOrigin.x + project.enclosure.wallThickness + cutout.offset - cutout.width / 2;
      const y = elevationOrigin.y + dims.baseHeight - (cutout.z + cutout.height / 2);
      return [
        `  <rect class="cutout" x="${format(x)}" y="${format(y)}" width="${format(cutout.width)}" height="${format(
          cutout.height,
        )}" />`,
        `  <text class="label" x="${format(x)}" y="${format(y - 1.5)}">${escapeXml(cutout.label)}</text>`,
      ].join('\n');
    })
    .join('\n');

  return `${[
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${format(width)}mm" height="${format(height)}mm" viewBox="0 0 ${format(
      width,
    )} ${format(height)}">`,
    '  <style>',
    '    .outer{fill:none;stroke:#111827;stroke-width:0.35}',
    '    .inner{fill:none;stroke:#64748b;stroke-width:0.25;stroke-dasharray:2 1}',
    '    .pcb{fill:#d9f99d;stroke:#3f6212;stroke-width:0.25}',
    '    .hole{fill:none;stroke:#0f172a;stroke-width:0.25}',
    '    .cutout{fill:#fee2e2;stroke:#991b1b;stroke-width:0.25}',
    '    .vent{fill:#e0f2fe;stroke:#0369a1;stroke-width:0.2}',
    '    .feature{fill:#fef3c7;stroke:#92400e;stroke-width:0.2}',
    '    .feature-cut{fill:#fee2e2;stroke:#991b1b;stroke-width:0.2}',
    '    .feature-emboss{fill:#dcfce7;stroke:#166534;stroke-width:0.2}',
    '    .label{font-family:Arial,sans-serif;font-size:3px;fill:#111827}',
    '  </style>',
    `  <text class="label" x="${margin}" y="6">${escapeXml(project.name)} - top view and front elevation - units mm</text>`,
    `  <rect class="outer" x="${format(topOrigin.x)}" y="${format(topOrigin.y)}" width="${format(
      dims.outerWidth,
    )}" height="${format(dims.outerHeight)}" />`,
    `  <rect class="inner" x="${format(topOrigin.x + project.enclosure.wallThickness)}" y="${format(
      topOrigin.y + project.enclosure.wallThickness,
    )}" width="${format(dims.internalWidth)}" height="${format(dims.internalHeight)}" />`,
    `  <rect class="pcb" x="${format(topOrigin.x + dims.pcbOriginX)}" y="${format(
      topOrigin.y + dims.pcbOriginY,
    )}" width="${format(project.pcb.width)}" height="${format(project.pcb.height)}" />`,
    holeElements,
    ventElements,
    featureElements,
    `  <rect class="outer" x="${format(elevationOrigin.x)}" y="${format(elevationOrigin.y)}" width="${format(
      dims.outerWidth,
    )}" height="${format(dims.baseHeight)}" />`,
    `  <text class="label" x="${format(elevationOrigin.x)}" y="${format(
      elevationOrigin.y - 3,
    )}">Front elevation</text>`,
    cutoutElements,
    '</svg>',
  ]
    .filter(Boolean)
    .join('\n')}\n`;
}

export function exportDxfDrawing(project: EnclosureProject): string {
  const dims = drawingDimensions(project);
  const elevationGap = 18;
  const elevationY = -(dims.outerHeight + elevationGap);
  const lines: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$INSUNITS',
    '70',
    '4',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ];

  addText(lines, 0, 8, `${project.name} - units mm`, 3, 'ANNOTATION');
  addRectangle(lines, 0, 0, dims.outerWidth, dims.outerHeight, 'ENCLOSURE');
  addRectangle(
    lines,
    project.enclosure.wallThickness,
    project.enclosure.wallThickness,
    dims.internalWidth,
    dims.internalHeight,
    'INTERNAL',
  );
  addRectangle(lines, dims.pcbOriginX, dims.pcbOriginY, project.pcb.width, project.pcb.height, 'PCB');

  for (const hole of project.pcb.mountingHoles) {
    addCircle(lines, dims.pcbOriginX + hole.x, dims.pcbOriginY + hole.y, hole.diameter / 2, 'HOLES');
  }
  for (const region of project.enclosure.ventilationRegions) {
    for (const slot of ventilationSlotFootprints(region)) {
      addRectangle(lines, slot.x - slot.width / 2, slot.y - slot.height / 2, slot.width, slot.height, 'VENTS');
    }
  }
  for (const feature of project.enclosure.designFeatures) {
    for (const footprint of designFeatureFootprints(feature)) {
      if (feature.shape === 'circle') {
        addCircle(lines, footprint.x, footprint.y, footprint.diameter / 2, 'LID_FEATURES');
      } else {
        addRectangle(
          lines,
          footprint.x - footprint.width / 2,
          footprint.y - footprint.height / 2,
          footprint.width,
          footprint.height,
          'LID_FEATURES',
        );
      }
    }
    addText(lines, feature.x - feature.width / 2, feature.y + feature.height / 2 + 1.5, feature.label, 2.5, 'ANNOTATION');
  }

  addText(lines, 0, elevationY + 5, 'Front elevation', 3, 'ANNOTATION');
  addRectangle(lines, 0, elevationY - dims.baseHeight, dims.outerWidth, dims.baseHeight, 'ENCLOSURE');
  for (const cutout of project.pcb.connectorCutouts.filter((current) => current.side === 'front')) {
    addCutoutElevation(lines, project, cutout, elevationY, dims.baseHeight);
  }

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return `${lines.join('\n')}\n`;
}

export function exportAssemblySvgDrawing(
  project: EnclosureProject,
  metadata: ManufacturingMetadata,
): string {
  const dims = drawingDimensions(project);
  const margin = 12;
  const partGap = 22;
  const textColumnWidth = 92;
  const width = dims.outerWidth * 2 + partGap + textColumnWidth + margin * 2;
  const height = Math.max(dims.outerHeight + 62, 118);
  const baseOrigin = { x: margin, y: 34 };
  const lidOrigin = { x: margin + dims.outerWidth + partGap, y: 34 };
  const textOrigin = { x: lidOrigin.x + dims.outerWidth + partGap, y: 18 };
  const fastenerLabel = metadata.assemblyInstructions[0] ?? 'Install closure hardware.';

  const hardwareCallouts = project.pcb.mountingHoles
    .map((hole, index) => {
      const baseX = baseOrigin.x + dims.pcbOriginX + hole.x;
      const baseY = baseOrigin.y + dims.pcbOriginY + hole.y;
      const lidX = lidOrigin.x + dims.pcbOriginX + hole.x;
      const lidY = lidOrigin.y + dims.pcbOriginY + hole.y;
      return [
        `  <circle class="hardware" cx="${format(baseX)}" cy="${format(baseY)}" r="${format(project.enclosure.standoffDiameter / 2)}" />`,
        `  <circle class="hardware" cx="${format(lidX)}" cy="${format(lidY)}" r="${format(project.enclosure.screwBossDiameter / 2)}" />`,
        `  <text class="tiny" x="${format(lidX + 3)}" y="${format(lidY - 3)}">H${index + 1}</text>`,
      ].join('\n');
    })
    .join('\n');
  const cutoutLabels = project.pcb.connectorCutouts
    .map((cutout, index) => {
      const y = textOrigin.y + 57 + index * 5;
      return `  <text class="tiny" x="${format(textOrigin.x)}" y="${format(y)}">${escapeXml(
        `${cutout.label}: ${cutout.side} side, offset ${format(cutout.offset)} mm`,
      )}</text>`;
    })
    .join('\n');
  const assemblySteps = metadata.assemblyInstructions
    .slice(0, 5)
    .map((step, index) => {
      const y = textOrigin.y + 82 + index * 6;
      return `  <text class="tiny" x="${format(textOrigin.x)}" y="${format(y)}">${escapeXml(
        `${index + 1}. ${step}`,
      )}</text>`;
    })
    .join('\n');

  return `${[
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${format(width)}mm" height="${format(height)}mm" viewBox="0 0 ${format(
      width,
    )} ${format(height)}">`,
    '  <style>',
    '    .part{fill:#f8fafc;stroke:#111827;stroke-width:0.35}',
    '    .cavity{fill:none;stroke:#64748b;stroke-width:0.25;stroke-dasharray:2 1}',
    '    .pcb{fill:#d9f99d;stroke:#3f6212;stroke-width:0.25}',
    '    .hardware{fill:none;stroke:#7c2d12;stroke-width:0.25}',
    '    .arrow{stroke:#256d85;stroke-width:0.35;marker-end:url(#arrow)}',
    '    .label{font-family:Arial,sans-serif;font-size:3px;font-weight:bold;fill:#111827}',
    '    .tiny{font-family:Arial,sans-serif;font-size:2.6px;fill:#1f2937}',
    '  </style>',
    '  <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#256d85" /></marker></defs>',
    `  <text class="label" x="${margin}" y="9">${escapeXml(project.name)} - assembly drawing - units mm</text>`,
    `  <text class="tiny" x="${margin}" y="15">${escapeXml(metadata.layout.modelArrangement)}</text>`,
    `  <rect class="part" x="${format(baseOrigin.x)}" y="${format(baseOrigin.y)}" width="${format(dims.outerWidth)}" height="${format(dims.outerHeight)}" />`,
    `  <rect class="cavity" x="${format(baseOrigin.x + project.enclosure.wallThickness)}" y="${format(
      baseOrigin.y + project.enclosure.wallThickness,
    )}" width="${format(dims.internalWidth)}" height="${format(dims.internalHeight)}" />`,
    `  <rect class="pcb" x="${format(baseOrigin.x + dims.pcbOriginX)}" y="${format(
      baseOrigin.y + dims.pcbOriginY,
    )}" width="${format(project.pcb.width)}" height="${format(project.pcb.height)}" />`,
    `  <text class="label" x="${format(baseOrigin.x)}" y="${format(baseOrigin.y - 4)}">Base + PCB</text>`,
    `  <rect class="part" x="${format(lidOrigin.x)}" y="${format(lidOrigin.y)}" width="${format(dims.outerWidth)}" height="${format(dims.outerHeight)}" />`,
    `  <text class="label" x="${format(lidOrigin.x)}" y="${format(lidOrigin.y - 4)}">Lid underside / closure points</text>`,
    hardwareCallouts,
    `  <line class="arrow" x1="${format(baseOrigin.x + dims.outerWidth + 5)}" y1="${format(
      baseOrigin.y + dims.outerHeight / 2,
    )}" x2="${format(lidOrigin.x - 5)}" y2="${format(lidOrigin.y + dims.outerHeight / 2)}" />`,
    `  <text class="label" x="${format(textOrigin.x)}" y="${format(textOrigin.y)}">Assembly checklist</text>`,
    `  <text class="tiny" x="${format(textOrigin.x)}" y="${format(textOrigin.y + 8)}">${escapeXml(fastenerLabel)}</text>`,
    `  <text class="tiny" x="${format(textOrigin.x)}" y="${format(textOrigin.y + 16)}">Material: ${escapeXml(
      metadata.material.name,
    )}, ${format(metadata.layerHeight)} mm layers, ${metadata.infillPercent}% infill</text>`,
    `  <text class="tiny" x="${format(textOrigin.x)}" y="${format(textOrigin.y + 24)}">Print: ${escapeXml(
      metadata.printOrientation,
    )}</text>`,
    `  <text class="tiny" x="${format(textOrigin.x)}" y="${format(textOrigin.y + 32)}">Parts: ${escapeXml(
      metadata.layout.printableParts.join(', '),
    )}</text>`,
    `  <text class="label" x="${format(textOrigin.x)}" y="${format(textOrigin.y + 49)}">Connector checks</text>`,
    cutoutLabels ||
      `  <text class="tiny" x="${format(textOrigin.x)}" y="${format(textOrigin.y + 57)}">No connector cutouts defined.</text>`,
    `  <text class="label" x="${format(textOrigin.x)}" y="${format(textOrigin.y + 74)}">Steps</text>`,
    assemblySteps,
    '</svg>',
  ]
    .filter(Boolean)
    .join('\n')}\n`;
}

interface Footprint {
  x: number;
  y: number;
  width: number;
  height: number;
  diameter: number;
}

function svgFeatureFootprint(
  originX: number,
  originY: number,
  feature: DesignFeature,
  footprint: Footprint,
  index: number,
): string {
  const className =
    feature.operation === 'through_cut'
      ? 'feature feature-cut'
      : feature.operation === 'emboss'
        ? 'feature feature-emboss'
        : 'feature';
  const label =
    index === 0
      ? `\n  <text class="label" x="${format(originX + feature.x - feature.width / 2)}" y="${format(
          originY + feature.y + feature.height / 2 + 3,
        )}">${escapeXml(feature.label)}</text>`
      : '';
  if (feature.shape === 'circle') {
    return `  <circle class="${className}" cx="${format(originX + footprint.x)}" cy="${format(
      originY + footprint.y,
    )}" r="${format(footprint.diameter / 2)}" />${label}`;
  }
  return `  <rect class="${className}" x="${format(originX + footprint.x - footprint.width / 2)}" y="${format(
    originY + footprint.y - footprint.height / 2,
  )}" width="${format(footprint.width)}" height="${format(footprint.height)}" />${label}`;
}

function ventilationSlotFootprints(region: VentilationRegion): Footprint[] {
  const columnCount = Math.floor((region.width + region.spacing) / (region.slotWidth + region.spacing));
  const rowCount = Math.floor((region.height + region.spacing) / (region.slotHeight + region.spacing));
  if (columnCount < 1 || rowCount < 1) {
    return [];
  }

  const totalWidth = columnCount * region.slotWidth + (columnCount - 1) * region.spacing;
  const totalHeight = rowCount * region.slotHeight + (rowCount - 1) * region.spacing;
  const startX = region.x - totalWidth / 2 + region.slotWidth / 2;
  const startY = region.y - totalHeight / 2 + region.slotHeight / 2;
  const slots: Footprint[] = [];

  for (let column = 0; column < columnCount; column += 1) {
    for (let row = 0; row < rowCount; row += 1) {
      slots.push({
        x: startX + column * (region.slotWidth + region.spacing),
        y: startY + row * (region.slotHeight + region.spacing),
        width: region.slotWidth,
        height: region.slotHeight,
        diameter: Math.min(region.slotWidth, region.slotHeight),
      });
    }
  }
  return slots;
}

function addCutoutElevation(
  lines: string[],
  project: EnclosureProject,
  cutout: ConnectorCutout,
  elevationY: number,
  baseHeight: number,
): void {
  const x = project.enclosure.wallThickness + cutout.offset - cutout.width / 2;
  const y = elevationY - baseHeight + cutout.z - cutout.height / 2;
  addRectangle(lines, x, y, cutout.width, cutout.height, 'CUTOUTS');
  addText(lines, x, y + cutout.height + 1.5, cutout.label, 2.5, 'ANNOTATION');
}

function addRectangle(lines: string[], x: number, y: number, width: number, height: number, layer: string): void {
  addLine(lines, x, y, x + width, y, layer);
  addLine(lines, x + width, y, x + width, y + height, layer);
  addLine(lines, x + width, y + height, x, y + height, layer);
  addLine(lines, x, y + height, x, y, layer);
}

function addLine(lines: string[], x1: number, y1: number, x2: number, y2: number, layer: string): void {
  lines.push(
    '0',
    'LINE',
    '8',
    layer,
    '10',
    format(x1),
    '20',
    format(y1),
    '30',
    '0',
    '11',
    format(x2),
    '21',
    format(y2),
    '31',
    '0',
  );
}

function addCircle(lines: string[], x: number, y: number, radius: number, layer: string): void {
  lines.push('0', 'CIRCLE', '8', layer, '10', format(x), '20', format(y), '30', '0', '40', format(radius));
}

function addText(lines: string[], x: number, y: number, value: string, height: number, layer: string): void {
  lines.push('0', 'TEXT', '8', layer, '10', format(x), '20', format(y), '30', '0', '40', format(height), '1', value);
}

function drawingDimensions(project: EnclosureProject): DrawingDimensions {
  const internalWidth = project.pcb.width + project.enclosure.boardClearance * 2;
  const internalHeight = project.pcb.height + project.enclosure.boardClearance * 2;
  const outerWidth = internalWidth + project.enclosure.wallThickness * 2;
  const outerHeight = internalHeight + project.enclosure.wallThickness * 2;
  return {
    internalWidth,
    internalHeight,
    outerWidth,
    outerHeight,
    baseHeight:
      project.enclosure.floorThickness +
      project.enclosure.standoffHeight +
      project.pcb.thickness +
      project.enclosure.baseInternalHeight,
    pcbOriginX: project.enclosure.wallThickness + project.enclosure.boardClearance,
    pcbOriginY: project.enclosure.wallThickness + project.enclosure.boardClearance,
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
