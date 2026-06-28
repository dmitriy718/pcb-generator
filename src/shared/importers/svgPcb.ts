import type { MountingHole, PcbSpecification } from '../domain';

interface SvgNumber {
  value: number;
  unit: string;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Circle {
  cx: number;
  cy: number;
  r: number;
  id: string | undefined;
  className: string | undefined;
}

export interface SvgImportResult {
  pcb: PcbSpecification;
  warnings: string[];
}

export function importSvgPcb(contents: string): SvgImportResult {
  const svgTag = tagMatch(contents, 'svg');
  if (svgTag === undefined) {
    throw new Error('SVG PCB outline import requires a root <svg> element.');
  }

  const svgAttributes = parseAttributes(svgTag);
  const viewBox = parseViewBox(svgAttributes.viewBox);
  const width = parseSvgNumber(svgAttributes.width);
  const height = parseSvgNumber(svgAttributes.height);
  const scale = unitScale(width?.unit ?? height?.unit ?? 'mm');
  const warnings: string[] = [];
  const outline = findOutlineRect(contents, viewBox);

  const boardWidth = outline
    ? outline.width * scale
    : width
      ? width.value * unitScale(width.unit)
      : viewBox?.width;
  const boardHeight = outline
    ? outline.height * scale
    : height
      ? height.value * unitScale(height.unit)
      : viewBox?.height;

  if (!boardWidth || !boardHeight || boardWidth <= 0 || boardHeight <= 0) {
    throw new Error('SVG PCB outline import could not determine a positive board width and height.');
  }

  if (!outline && !viewBox) {
    warnings.push('No rectangular outline or viewBox was found; dimensions were inferred from SVG width and height.');
  }

  const origin = outline ? { x: outline.x, y: outline.y } : viewBox ? { x: viewBox.x, y: viewBox.y } : { x: 0, y: 0 };
  const mountingHoles = extractMountingHoles(contents, origin, scale);
  if (mountingHoles.length === 0) {
    warnings.push('No circular mounting holes were detected in the SVG.');
  }

  return {
    pcb: {
      width: round(boardWidth),
      height: round(boardHeight),
      thickness: 1.6,
      componentHeight: 0,
      cornerRadius: 0,
      mountingHoles,
      connectorCutouts: [],
    },
    warnings,
  };
}

function findOutlineRect(contents: string, viewBox: Rect | undefined): Rect | undefined {
  const rects = [...contents.matchAll(/<rect\b([^>]*)\/?>/giu)]
    .map((match) => parseRect(match[1] ?? ''))
    .filter((rect): rect is Rect => rect !== undefined);

  if (rects.length === 0) {
    return viewBox;
  }

  if (!viewBox) {
    return rects.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  }

  return (
    rects.find(
      (rect) =>
        nearlyEqual(rect.x, viewBox.x) &&
        nearlyEqual(rect.y, viewBox.y) &&
        nearlyEqual(rect.width, viewBox.width) &&
        nearlyEqual(rect.height, viewBox.height),
    ) ?? rects.sort((a, b) => b.width * b.height - a.width * a.height)[0]
  );
}

function extractMountingHoles(contents: string, origin: { x: number; y: number }, scale: number): MountingHole[] {
  const circles = [...contents.matchAll(/<circle\b([^>]*)\/?>/giu)]
    .map((match) => parseCircle(match[1] ?? ''))
    .filter((circle): circle is Circle => circle !== undefined);

  return circles
    .filter((circle) => isHoleCircle(circle))
    .map((circle, index) => ({
      id: circle.id ?? `mh-${index + 1}`,
      x: round((circle.cx - origin.x) * scale),
      y: round((circle.cy - origin.y) * scale),
      diameter: round(circle.r * 2 * scale),
    }));
}

function isHoleCircle(circle: Circle): boolean {
  const haystack = `${circle.id ?? ''} ${circle.className ?? ''}`.toLowerCase();
  return haystack.includes('hole') || haystack.includes('mount');
}

function parseRect(attributesText: string): Rect | undefined {
  const attributes = parseAttributes(attributesText);
  const width = parseFloatAttribute(attributes.width);
  const height = parseFloatAttribute(attributes.height);
  if (width === undefined || height === undefined) {
    return undefined;
  }
  return {
    x: parseFloatAttribute(attributes.x) ?? 0,
    y: parseFloatAttribute(attributes.y) ?? 0,
    width,
    height,
  };
}

function parseCircle(attributesText: string): Circle | undefined {
  const attributes = parseAttributes(attributesText);
  const cx = parseFloatAttribute(attributes.cx);
  const cy = parseFloatAttribute(attributes.cy);
  const r = parseFloatAttribute(attributes.r);
  if (cx === undefined || cy === undefined || r === undefined || r <= 0) {
    return undefined;
  }
  return {
    cx,
    cy,
    r,
    id: attributes.id,
    className: attributes.class,
  };
}

function parseAttributes(attributesText: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of attributesText.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(['"])(.*?)\2/gu)) {
    const key = match[1];
    const value = match[3];
    if (key && value !== undefined) {
      attributes[key] = value;
    }
  }
  return attributes;
}

function parseViewBox(value: string | undefined): Rect | undefined {
  if (!value) {
    return undefined;
  }
  const parts = value
    .trim()
    .split(/[\s,]+/u)
    .map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }
  return { x: parts[0] ?? 0, y: parts[1] ?? 0, width: parts[2] ?? 0, height: parts[3] ?? 0 };
}

function parseSvgNumber(value: string | undefined): SvgNumber | undefined {
  if (!value) {
    return undefined;
  }
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*([A-Za-z]*)$/u.exec(value.trim());
  if (!match) {
    return undefined;
  }
  return { value: Number(match[1]), unit: match[2] ?? '' };
}

function parseFloatAttribute(value: string | undefined): number | undefined {
  const parsed = parseSvgNumber(value);
  return parsed ? parsed.value * unitScale(parsed.unit) : undefined;
}

function unitScale(unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized === 'mm' || normalized === '') {
    return 1;
  }
  if (normalized === 'cm') {
    return 10;
  }
  if (normalized === 'in') {
    return 25.4;
  }
  if (normalized === 'px') {
    return 25.4 / 96;
  }
  return 1;
}

function tagMatch(contents: string, tagName: string): string | undefined {
  return new RegExp(`<${tagName}\\b([^>]*)>`, 'iu').exec(contents)?.[1];
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
