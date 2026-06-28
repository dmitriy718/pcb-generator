import type { DesignFeatureCustomFootprint } from '../domain';

interface SvgNumber {
  value: number;
  unit: string;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
}

interface Circle {
  cx: number;
  cy: number;
  r: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SvgLogoImportResult {
  footprints: DesignFeatureCustomFootprint[];
  warnings: string[];
}

export function importSvgLogoFootprints(contents: string): SvgLogoImportResult {
  const svgTag = tagMatch(contents, 'svg');
  if (svgTag === undefined) {
    throw new Error('SVG logo import requires a root <svg> element.');
  }

  const svgAttributes = parseAttributes(svgTag);
  const viewBox = parseViewBox(svgAttributes.viewBox);
  const rects = [...contents.matchAll(/<rect\b([^>]*)\/?>/giu)]
    .map((match) => parseRect(match[1] ?? ''))
    .filter((rect): rect is Rect => rect !== undefined);
  const circles = [...contents.matchAll(/<circle\b([^>]*)\/?>/giu)]
    .map((match) => parseCircle(match[1] ?? ''))
    .filter((circle): circle is Circle => circle !== undefined);
  const shapeBounds = [
    ...rects.map((rect) => ({ minX: rect.x, minY: rect.y, maxX: rect.x + rect.width, maxY: rect.y + rect.height })),
    ...circles.map((circle) => ({
      minX: circle.cx - circle.r,
      minY: circle.cy - circle.r,
      maxX: circle.cx + circle.r,
      maxY: circle.cy + circle.r,
    })),
  ];

  if (shapeBounds.length === 0) {
    throw new Error('SVG logo import supports filled rect and circle elements; none were found.');
  }

  const bounds = viewBox ?? mergeBounds(shapeBounds);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width <= 0 || height <= 0) {
    throw new Error('SVG logo import could not determine positive logo bounds.');
  }

  const footprints: DesignFeatureCustomFootprint[] = [
    ...rects.map((rect) => ({
      xRatio: ((rect.x + rect.width / 2) - bounds.minX) / width,
      yRatio: ((rect.y + rect.height / 2) - bounds.minY) / height,
      widthRatio: rect.width / width,
      heightRatio: rect.height / height,
      cornerRadiusRatio: rect.rx > 0 ? Math.min(rect.rx / Math.min(rect.width, rect.height), 0.5) : 0,
    })),
    ...circles.map((circle) => ({
      xRatio: (circle.cx - bounds.minX) / width,
      yRatio: (circle.cy - bounds.minY) / height,
      widthRatio: (circle.r * 2) / width,
      heightRatio: (circle.r * 2) / height,
      cornerRadiusRatio: 0.5,
    })),
  ].filter(isUsableFootprint);

  if (footprints.length === 0) {
    throw new Error('SVG logo import found shapes, but none fit inside the logo bounds.');
  }

  const warnings: string[] = [];
  if (/<path\b/iu.exec(contents)) {
    warnings.push('SVG path elements are not imported yet; convert logo paths to rect/circle primitives or use a supported SVG.');
  }

  return { footprints, warnings };
}

function parseRect(attributesText: string): Rect | undefined {
  const attributes = parseAttributes(attributesText);
  const width = parseFloatAttribute(attributes.width);
  const height = parseFloatAttribute(attributes.height);
  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    return undefined;
  }
  return {
    x: parseFloatAttribute(attributes.x) ?? 0,
    y: parseFloatAttribute(attributes.y) ?? 0,
    width,
    height,
    rx: parseFloatAttribute(attributes.rx) ?? 0,
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
  return { cx, cy, r };
}

function mergeBounds(bounds: Bounds[]): Bounds {
  return bounds.reduce(
    (current, boundsItem) => ({
      minX: Math.min(current.minX, boundsItem.minX),
      minY: Math.min(current.minY, boundsItem.minY),
      maxX: Math.max(current.maxX, boundsItem.maxX),
      maxY: Math.max(current.maxY, boundsItem.maxY),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

function isUsableFootprint(footprint: DesignFeatureCustomFootprint): boolean {
  return (
    footprint.xRatio >= 0 &&
    footprint.xRatio <= 1 &&
    footprint.yRatio >= 0 &&
    footprint.yRatio <= 1 &&
    footprint.widthRatio > 0 &&
    footprint.heightRatio > 0
  );
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

function parseViewBox(value: string | undefined): Bounds | undefined {
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
  const x = parts[0] ?? 0;
  const y = parts[1] ?? 0;
  const width = parts[2] ?? 0;
  const height = parts[3] ?? 0;
  return { minX: x, minY: y, maxX: x + width, maxY: y + height };
}

function parseFloatAttribute(value: string | undefined): number | undefined {
  const parsed = parseSvgNumber(value);
  return parsed ? parsed.value * unitScale(parsed.unit) : undefined;
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

function unitScale(unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized === 'mm' || normalized === '') return 1;
  if (normalized === 'cm') return 10;
  if (normalized === 'in') return 25.4;
  if (normalized === 'px') return 25.4 / 96;
  return 1;
}

function tagMatch(contents: string, tagName: string): string | undefined {
  return new RegExp(`<${tagName}\\b([^>]*)>`, 'iu').exec(contents)?.[1];
}
