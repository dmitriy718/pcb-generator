import type { MountingHole, PcbSpecification } from '../domain';

interface SvgNumber {
  value: number;
  unit: string;
}

interface Point {
  x: number;
  y: number;
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

interface PathOutline {
  d: string;
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

  if (rects.length > 0 && !viewBox) {
    return rects.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  }

  if (rects.length > 0 && viewBox) {
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

  const pathBounds = findOutlinePathBounds(contents, viewBox);
  if (pathBounds) {
    return pathBounds;
  }

  return viewBox;
}

function findOutlinePathBounds(contents: string, viewBox: Rect | undefined): Rect | undefined {
  const paths = [...contents.matchAll(/<path\b([^>]*)\/?>/giu)]
    .map((match) => parsePathOutline(match[1] ?? ''))
    .filter((path): path is PathOutline => path !== undefined);
  const preferredPaths = paths.filter((path) => isOutlineName(`${path.id ?? ''} ${path.className ?? ''}`));
  const bounds = (preferredPaths.length > 0 ? preferredPaths : paths)
    .map((path) => parseSvgPathBounds(path.d))
    .filter((rect): rect is Rect => rect !== undefined);

  if (bounds.length === 0) {
    return undefined;
  }

  if (viewBox) {
    return (
      bounds.find(
      (rect) =>
        nearlyEqual(rect.x, viewBox.x) &&
        nearlyEqual(rect.y, viewBox.y) &&
        nearlyEqual(rect.width, viewBox.width) &&
        nearlyEqual(rect.height, viewBox.height),
      ) ?? bounds.sort((a, b) => b.width * b.height - a.width * a.height)[0]
    );
  }

  return bounds.sort((a, b) => b.width * b.height - a.width * a.height)[0];
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

function parsePathOutline(attributesText: string): PathOutline | undefined {
  const attributes = parseAttributes(attributesText);
  if (!attributes.d) {
    return undefined;
  }
  return {
    d: attributes.d,
    id: attributes.id,
    className: attributes.class,
  };
}

function parseSvgPathBounds(path: string): Rect | undefined {
  const points = parseSvgPathPoints(path);
  if (!points || points.length === 0) {
    return undefined;
  }
  const bounds = points.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      minY: Math.min(current.minY, point.y),
      maxX: Math.max(current.maxX, point.x),
      maxY: Math.max(current.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
  return { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY };
}

function parseSvgPathPoints(path: string): Point[] | undefined {
  const tokens = [...path.matchAll(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gu)].map(
    (match) => match[0],
  );
  const points: Point[] = [];
  let cursor = 0;
  let command = '';
  let current: Point = { x: 0, y: 0 };
  let subpathStart: Point = { x: 0, y: 0 };

  const isCommand = (token: string | undefined): boolean => token !== undefined && /^[A-Za-z]$/u.test(token);
  const readNumber = (): number | undefined => {
    const token = tokens[cursor];
    if (token === undefined || isCommand(token)) {
      return undefined;
    }
    cursor += 1;
    const value = Number(token);
    return Number.isFinite(value) ? value : undefined;
  };
  const hasNumber = (): boolean => tokens[cursor] !== undefined && !isCommand(tokens[cursor]);

  while (cursor < tokens.length) {
    if (isCommand(tokens[cursor])) {
      command = tokens[cursor] ?? '';
      cursor += 1;
    }
    if (!command) {
      return undefined;
    }

    const relative = command === command.toLowerCase();
    switch (command.toLowerCase()) {
      case 'm': {
        const x = readNumber();
        const y = readNumber();
        if (x === undefined || y === undefined) {
          return undefined;
        }
        current = relativePoint(current, { x, y }, relative);
        subpathStart = current;
        points.push(current);
        command = relative ? 'l' : 'L';
        break;
      }
      case 'l': {
        while (hasNumber()) {
          const x = readNumber();
          const y = readNumber();
          if (x === undefined || y === undefined) {
            return undefined;
          }
          current = relativePoint(current, { x, y }, relative);
          points.push(current);
        }
        break;
      }
      case 'h': {
        while (hasNumber()) {
          const x = readNumber();
          if (x === undefined) {
            return undefined;
          }
          current = { x: relative ? current.x + x : x, y: current.y };
          points.push(current);
        }
        break;
      }
      case 'v': {
        while (hasNumber()) {
          const y = readNumber();
          if (y === undefined) {
            return undefined;
          }
          current = { x: current.x, y: relative ? current.y + y : y };
          points.push(current);
        }
        break;
      }
      case 'a': {
        while (hasNumber()) {
          const rx = readNumber();
          const ry = readNumber();
          const rotation = readNumber();
          const largeArcFlag = readNumber();
          const sweepFlag = readNumber();
          const x = readNumber();
          const y = readNumber();
          if (
            rx === undefined ||
            ry === undefined ||
            rotation === undefined ||
            largeArcFlag === undefined ||
            sweepFlag === undefined ||
            x === undefined ||
            y === undefined
          ) {
            return undefined;
          }
          const end = relativePoint(current, { x, y }, relative);
          points.push(...svgArcPoints(current, end, rx, ry, rotation, largeArcFlag !== 0, sweepFlag !== 0));
          current = end;
        }
        break;
      }
      case 'z': {
        current = subpathStart;
        points.push(current);
        command = '';
        break;
      }
      default:
        return undefined;
    }
  }

  return points;
}

function relativePoint(current: Point, point: Point, relative: boolean): Point {
  return relative ? { x: current.x + point.x, y: current.y + point.y } : point;
}

function svgArcPoints(
  start: Point,
  end: Point,
  rxInput: number,
  ryInput: number,
  rotationDegrees: number,
  largeArc: boolean,
  sweep: boolean,
): Point[] {
  let rx = Math.abs(rxInput);
  let ry = Math.abs(ryInput);
  if (rx <= 0 || ry <= 0 || (nearlyEqual(start.x, end.x) && nearlyEqual(start.y, end.y))) {
    return [end];
  }

  const phi = (rotationDegrees * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (start.x - end.x) / 2;
  const dy = (start.y - end.y) / 2;
  const x1Prime = cosPhi * dx + sinPhi * dy;
  const y1Prime = -sinPhi * dx + cosPhi * dy;
  const radiusScale = x1Prime ** 2 / rx ** 2 + y1Prime ** 2 / ry ** 2;
  if (radiusScale > 1) {
    const scale = Math.sqrt(radiusScale);
    rx *= scale;
    ry *= scale;
  }

  const numerator = rx ** 2 * ry ** 2 - rx ** 2 * y1Prime ** 2 - ry ** 2 * x1Prime ** 2;
  const denominator = rx ** 2 * y1Prime ** 2 + ry ** 2 * x1Prime ** 2;
  const coefficient = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxPrime = coefficient * ((rx * y1Prime) / ry);
  const cyPrime = coefficient * (-(ry * x1Prime) / rx);
  const center = {
    x: cosPhi * cxPrime - sinPhi * cyPrime + (start.x + end.x) / 2,
    y: sinPhi * cxPrime + cosPhi * cyPrime + (start.y + end.y) / 2,
  };

  const startVector = { x: (x1Prime - cxPrime) / rx, y: (y1Prime - cyPrime) / ry };
  const endVector = { x: (-x1Prime - cxPrime) / rx, y: (-y1Prime - cyPrime) / ry };
  const startAngle = vectorAngle({ x: 1, y: 0 }, startVector);
  let deltaAngle = vectorAngle(startVector, endVector);
  if (!sweep && deltaAngle > 0) {
    deltaAngle -= Math.PI * 2;
  } else if (sweep && deltaAngle < 0) {
    deltaAngle += Math.PI * 2;
  }

  const segmentCount = Math.max(4, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 24)));
  const points: Point[] = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    const angle = startAngle + (deltaAngle * index) / segmentCount;
    const x = cosPhi * rx * Math.cos(angle) - sinPhi * ry * Math.sin(angle) + center.x;
    const y = sinPhi * rx * Math.cos(angle) + cosPhi * ry * Math.sin(angle) + center.y;
    points.push({ x, y });
  }
  return points;
}

function vectorAngle(a: Point, b: Point): number {
  const dot = a.x * b.x + a.y * b.y;
  const determinant = a.x * b.y - a.y * b.x;
  return Math.atan2(determinant, dot);
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

function isOutlineName(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('edge') || normalized.includes('outline') || normalized.includes('board') || normalized.includes('pcb');
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
