import type { MountingHole, PcbSpecification } from '../domain';

interface DxfPair {
  code: number;
  value: string;
}

interface Point {
  x: number;
  y: number;
}

interface LineEntity {
  type: 'LINE';
  layer: string;
  start: Point;
  end: Point;
}

interface PolylineEntity {
  type: 'LWPOLYLINE';
  layer: string;
  points: Point[];
  closed: boolean;
}

interface CircleEntity {
  type: 'CIRCLE';
  layer: string;
  center: Point;
  radius: number;
}

type DxfEntity = CircleEntity | LineEntity | PolylineEntity;

export interface DxfImportResult {
  pcb: PcbSpecification;
  warnings: string[];
}

export function importDxfPcb(contents: string): DxfImportResult {
  const pairs = parsePairs(contents);
  const scale = unitScale(findInsUnits(pairs));
  const entities = parseEntities(pairs);
  const warnings: string[] = [];
  const outlineEntities = preferredOutlineEntities(entities);
  const outlinePoints = outlineEntities.flatMap((entity) =>
    entity.type === 'LINE' ? [entity.start, entity.end] : entity.points,
  );

  if (outlinePoints.length === 0) {
    throw new Error('DXF PCB outline import found no LINE or LWPOLYLINE outline geometry.');
  }

  const bounds = boundsFor(outlinePoints);
  const width = round((bounds.maxX - bounds.minX) * scale);
  const height = round((bounds.maxY - bounds.minY) * scale);
  if (width <= 0 || height <= 0) {
    throw new Error('DXF PCB outline import did not produce a positive board width and height.');
  }

  if (outlineEntities.some((entity) => entity.type === 'LWPOLYLINE' && !entity.closed)) {
    warnings.push('At least one DXF outline polyline is open; dimensions were inferred from its bounds.');
  }

  const mountingHoles = extractMountingHoles(entities, bounds, scale);
  if (mountingHoles.length === 0) {
    warnings.push('No circular mounting holes were detected in the DXF.');
  }

  return {
    pcb: {
      width,
      height,
      thickness: 1.6,
      cornerRadius: 0,
      mountingHoles,
      connectorCutouts: [],
    },
    warnings,
  };
}

function parsePairs(contents: string): DxfPair[] {
  const lines = contents
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const pairs: DxfPair[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = Number(lines[i]?.trim());
    const value = lines[i + 1]?.trim();
    if (!Number.isInteger(code) || value === undefined) {
      continue;
    }
    pairs.push({ code, value });
  }
  return pairs;
}

function parseEntities(pairs: DxfPair[]): DxfEntity[] {
  const entities: DxfEntity[] = [];
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (pair?.code !== 0 || !isSupportedEntity(pair.value)) {
      continue;
    }

    const entityPairs: DxfPair[] = [];
    for (let cursor = index + 1; cursor < pairs.length; cursor += 1) {
      const current = pairs[cursor];
      if (current?.code === 0) {
        break;
      }
      if (current) {
        entityPairs.push(current);
      }
    }

    const entity = parseEntity(pair.value, entityPairs);
    if (entity) {
      entities.push(entity);
    }
  }
  return entities;
}

function parseEntity(type: string, pairs: DxfPair[]): DxfEntity | undefined {
  const layer = firstString(pairs, 8) ?? '';
  if (type === 'LINE') {
    const start = pointFromCodes(pairs, 10, 20);
    const end = pointFromCodes(pairs, 11, 21);
    return start && end ? { type, layer, start, end } : undefined;
  }
  if (type === 'LWPOLYLINE') {
    const points = polylinePoints(pairs);
    const flags = firstNumber(pairs, 70) ?? 0;
    return points.length >= 2 ? { type, layer, points, closed: (flags & 1) === 1 } : undefined;
  }
  if (type === 'CIRCLE') {
    const center = pointFromCodes(pairs, 10, 20);
    const radius = firstNumber(pairs, 40);
    return center && radius !== undefined && radius > 0 ? { type, layer, center, radius } : undefined;
  }
  return undefined;
}

function polylinePoints(pairs: DxfPair[]): Point[] {
  const points: Point[] = [];
  let pendingX: number | undefined;
  for (const pair of pairs) {
    if (pair.code === 10) {
      pendingX = Number(pair.value);
    } else if (pair.code === 20 && pendingX !== undefined) {
      const y = Number(pair.value);
      if (Number.isFinite(pendingX) && Number.isFinite(y)) {
        points.push({ x: pendingX, y });
      }
      pendingX = undefined;
    }
  }
  return points;
}

function preferredOutlineEntities(entities: DxfEntity[]): (LineEntity | PolylineEntity)[] {
  const outlines = entities.filter(
    (entity): entity is LineEntity | PolylineEntity =>
      entity.type !== 'CIRCLE' && isOutlineLayer(entity.layer),
  );
  if (outlines.length > 0) {
    return outlines;
  }
  return entities.filter((entity): entity is LineEntity | PolylineEntity => entity.type !== 'CIRCLE');
}

function extractMountingHoles(
  entities: DxfEntity[],
  outlineBounds: { minX: number; minY: number; maxX: number; maxY: number },
  scale: number,
): MountingHole[] {
  const boardWidth = outlineBounds.maxX - outlineBounds.minX;
  const boardHeight = outlineBounds.maxY - outlineBounds.minY;
  const maxAutoHoleRadius = Math.min(boardWidth, boardHeight) * 0.08;
  return entities
    .filter((entity): entity is CircleEntity => entity.type === 'CIRCLE')
    .filter(
      (circle) =>
        pointInsideBounds(circle.center, outlineBounds) &&
        (isHoleLayer(circle.layer) || circle.radius <= maxAutoHoleRadius),
    )
    .map((circle, index) => ({
      id: `mh-${index + 1}`,
      x: round((circle.center.x - outlineBounds.minX) * scale),
      y: round((circle.center.y - outlineBounds.minY) * scale),
      diameter: round(circle.radius * 2 * scale),
    }));
}

function pointFromCodes(pairs: DxfPair[], xCode: number, yCode: number): Point | undefined {
  const x = firstNumber(pairs, xCode);
  const y = firstNumber(pairs, yCode);
  return x === undefined || y === undefined ? undefined : { x, y };
}

function firstNumber(pairs: DxfPair[], code: number): number | undefined {
  const value = firstString(pairs, code);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstString(pairs: DxfPair[], code: number): string | undefined {
  return pairs.find((pair) => pair.code === code)?.value;
}

function findInsUnits(pairs: DxfPair[]): number | undefined {
  for (let index = 0; index < pairs.length - 1; index += 1) {
    if (pairs[index]?.code === 9 && pairs[index]?.value.toUpperCase() === '$INSUNITS') {
      return Number(pairs[index + 1]?.value);
    }
  }
  return undefined;
}

function unitScale(insUnits: number | undefined): number {
  if (insUnits === 1) {
    return 25.4;
  }
  if (insUnits === 5) {
    return 10;
  }
  if (insUnits === 6) {
    return 1000;
  }
  return 1;
}

function boundsFor(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );
}

function pointInsideBounds(
  point: Point,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function isSupportedEntity(type: string): boolean {
  return type === 'LINE' || type === 'LWPOLYLINE' || type === 'CIRCLE';
}

function isOutlineLayer(layer: string): boolean {
  const normalized = layer.toLowerCase();
  return (
    normalized.includes('edge') ||
    normalized.includes('outline') ||
    normalized.includes('board') ||
    normalized.includes('pcb')
  );
}

function isHoleLayer(layer: string): boolean {
  const normalized = layer.toLowerCase();
  return normalized.includes('hole') || normalized.includes('mount') || normalized.includes('drill');
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
