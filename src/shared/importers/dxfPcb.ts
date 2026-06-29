import type { MountingHole, PcbSpecification } from '../domain';

interface DxfPair {
  code: number;
  value: string;
}

interface Point {
  x: number;
  y: number;
}

interface PolylineVertex extends Point {
  bulge: number;
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

interface ArcEntity {
  type: 'ARC';
  layer: string;
  center: Point;
  radius: number;
  startAngleDegrees: number;
  endAngleDegrees: number;
}

interface SplineEntity {
  type: 'SPLINE';
  layer: string;
  points: Point[];
  evaluated: boolean;
}

type OutlineEntity = ArcEntity | LineEntity | PolylineEntity | SplineEntity;

type DxfEntity = ArcEntity | CircleEntity | LineEntity | PolylineEntity | SplineEntity;

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
  const outlinePoints = outlineEntities.flatMap(outlineEntityPoints);

  if (outlinePoints.length === 0) {
    throw new Error('DXF PCB outline import found no LINE, LWPOLYLINE, ARC, or SPLINE outline geometry.');
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
  if (outlineEntities.some((entity) => entity.type === 'SPLINE' && !entity.evaluated)) {
    warnings.push('At least one DXF outline spline was measured from control/fit point bounds; verify dimensions before production.');
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
      componentHeight: 0,
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
    const flags = firstNumber(pairs, 70) ?? 0;
    const closed = (flags & 1) === 1;
    const points = polylinePoints(pairs, closed);
    return points.length >= 2 ? { type, layer, points, closed: (flags & 1) === 1 } : undefined;
  }
  if (type === 'CIRCLE') {
    const center = pointFromCodes(pairs, 10, 20);
    const radius = firstNumber(pairs, 40);
    return center && radius !== undefined && radius > 0 ? { type, layer, center, radius } : undefined;
  }
  if (type === 'ARC') {
    const center = pointFromCodes(pairs, 10, 20);
    const radius = firstNumber(pairs, 40);
    const startAngleDegrees = firstNumber(pairs, 50);
    const endAngleDegrees = firstNumber(pairs, 51);
    return center &&
      radius !== undefined &&
      radius > 0 &&
      startAngleDegrees !== undefined &&
      endAngleDegrees !== undefined
      ? { type, layer, center, radius, startAngleDegrees, endAngleDegrees }
      : undefined;
  }
  if (type === 'SPLINE') {
    const controlPoints = pointsFromCodes(pairs, 10, 20);
    const fitPoints = pointsFromCodes(pairs, 11, 21);
    const degree = firstNumber(pairs, 71);
    const knots = numbersFromCode(pairs, 40);
    const weights = numbersFromCode(pairs, 41);
    const evaluatedPoints =
      degree !== undefined ? evaluateSplinePoints(controlPoints, degree, knots, weights) : undefined;
    if (evaluatedPoints && evaluatedPoints.length >= 2) {
      return { type, layer, points: evaluatedPoints, evaluated: true };
    }
    const points = controlPoints.length > 0 ? controlPoints : fitPoints;
    return points.length >= 2 ? { type, layer, points, evaluated: false } : undefined;
  }
  return undefined;
}

function polylinePoints(pairs: DxfPair[], closed: boolean): Point[] {
  const vertices = polylineVertices(pairs);
  if (vertices.length < 2) {
    return vertices;
  }

  const points: Point[] = [];
  const segmentCount = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (!start || !end) {
      continue;
    }
    points.push(...bulgeSegmentPoints(start, end));
  }
  return points;
}

function polylineVertices(pairs: DxfPair[]): PolylineVertex[] {
  const vertices: PolylineVertex[] = [];
  let pendingX: number | undefined;
  let pendingY: number | undefined;
  let pendingBulge = 0;

  const pushPending = (): void => {
    if (
      pendingX !== undefined &&
      pendingY !== undefined &&
      Number.isFinite(pendingX) &&
      Number.isFinite(pendingY)
    ) {
      vertices.push({ x: pendingX, y: pendingY, bulge: pendingBulge });
    }
    pendingX = undefined;
    pendingY = undefined;
    pendingBulge = 0;
  };

  for (const pair of pairs) {
    if (pair.code === 10) {
      pushPending();
      pendingX = Number(pair.value);
    } else if (pair.code === 20 && pendingX !== undefined) {
      const y = Number(pair.value);
      if (Number.isFinite(y)) {
        pendingY = y;
      }
    } else if (pair.code === 42) {
      const bulge = Number(pair.value);
      if (Number.isFinite(bulge)) {
        pendingBulge = bulge;
      }
    }
  }
  pushPending();
  return vertices;
}

function pointsFromCodes(pairs: DxfPair[], xCode: number, yCode: number): Point[] {
  const points: Point[] = [];
  let pendingX: number | undefined;
  for (const pair of pairs) {
    if (pair.code === xCode) {
      pendingX = Number(pair.value);
    } else if (pair.code === yCode && pendingX !== undefined) {
      const y = Number(pair.value);
      if (Number.isFinite(pendingX) && Number.isFinite(y)) {
        points.push({ x: pendingX, y });
      }
      pendingX = undefined;
    }
  }
  return points;
}

function preferredOutlineEntities(entities: DxfEntity[]): OutlineEntity[] {
  const outlines = entities.filter(
    (entity): entity is OutlineEntity =>
      entity.type !== 'CIRCLE' && isOutlineLayer(entity.layer),
  );
  if (outlines.length > 0) {
    return outlines;
  }
  return entities.filter((entity): entity is OutlineEntity => entity.type !== 'CIRCLE');
}

function outlineEntityPoints(entity: OutlineEntity): Point[] {
  if (entity.type === 'LINE') {
    return [entity.start, entity.end];
  }
  if (entity.type === 'ARC') {
    return arcEntityPoints(entity);
  }
  return entity.points;
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

function numbersFromCode(pairs: DxfPair[], code: number): number[] {
  return pairs
    .filter((pair) => pair.code === code)
    .map((pair) => Number(pair.value))
    .filter(Number.isFinite);
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
  return type === 'LINE' || type === 'LWPOLYLINE' || type === 'CIRCLE' || type === 'ARC' || type === 'SPLINE';
}

function evaluateSplinePoints(
  controlPoints: Point[],
  degree: number,
  knots: number[],
  weights: number[],
): Point[] | undefined {
  if (
    !Number.isInteger(degree) ||
    degree < 1 ||
    controlPoints.length < degree + 1 ||
    knots.length < controlPoints.length + degree + 1
  ) {
    return undefined;
  }

  const start = knots[degree];
  const end = knots[controlPoints.length];
  if (start === undefined || end === undefined || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return undefined;
  }

  const splineWeights = controlPoints.map((_, index) => {
    const weight = weights[index];
    return weight !== undefined && Number.isFinite(weight) && weight > 0 ? weight : 1;
  });
  const points: Point[] = [];
  const sampleCount = Math.max(64, controlPoints.length * 24);
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index === sampleCount ? end : start + ((end - start) * index) / sampleCount;
    const point = evaluateRationalBasisPoint(controlPoints, splineWeights, degree, knots, t);
    if (point) {
      points.push(point);
    }
  }
  return points.length >= 2 ? points : undefined;
}

function evaluateRationalBasisPoint(
  controlPoints: Point[],
  weights: number[],
  degree: number,
  knots: number[],
  t: number,
): Point | undefined {
  let weightedX = 0;
  let weightedY = 0;
  let basisWeight = 0;
  for (const [index, point] of controlPoints.entries()) {
    const basis = splineBasis(index, degree, knots, t);
    const weight = basis * (weights[index] ?? 1);
    weightedX += point.x * weight;
    weightedY += point.y * weight;
    basisWeight += weight;
  }
  if (basisWeight <= 0) {
    const lastPoint = controlPoints.at(-1);
    return nearlyEqual(t, knots[controlPoints.length] ?? Number.NaN) && lastPoint ? lastPoint : undefined;
  }
  return { x: weightedX / basisWeight, y: weightedY / basisWeight };
}

function splineBasis(index: number, degree: number, knots: number[], t: number): number {
  if (degree === 0) {
    const start = knots[index];
    const end = knots[index + 1];
    const finalKnot = knots.at(-1);
    if (start === undefined || end === undefined) {
      return 0;
    }
    return (start <= t && t < end) || (finalKnot !== undefined && nearlyEqual(t, finalKnot) && start <= t && t <= end)
      ? 1
      : 0;
  }

  const leftDenominator = (knots[index + degree] ?? 0) - (knots[index] ?? 0);
  const rightDenominator = (knots[index + degree + 1] ?? 0) - (knots[index + 1] ?? 0);
  const left =
    leftDenominator === 0 ? 0 : ((t - (knots[index] ?? 0)) / leftDenominator) * splineBasis(index, degree - 1, knots, t);
  const right =
    rightDenominator === 0
      ? 0
      : (((knots[index + degree + 1] ?? 0) - t) / rightDenominator) *
        splineBasis(index + 1, degree - 1, knots, t);
  return left + right;
}

function bulgeSegmentPoints(start: PolylineVertex, end: PolylineVertex): Point[] {
  if (Math.abs(start.bulge) < 0.000001) {
    return [start, end];
  }

  const chordLength = distance(start, end);
  if (chordLength <= 0) {
    return [start];
  }

  const radius = (chordLength * (1 + start.bulge ** 2)) / (4 * Math.abs(start.bulge));
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const leftNormal = { x: -(end.y - start.y) / chordLength, y: (end.x - start.x) / chordLength };
  const centerOffset = (chordLength * (1 - start.bulge ** 2)) / (4 * start.bulge);
  const center = {
    x: midpoint.x + leftNormal.x * centerOffset,
    y: midpoint.y + leftNormal.y * centerOffset,
  };
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const sweep = 4 * Math.atan(start.bulge);
  return arcPoints(center, radius, startAngle, sweep);
}

function arcEntityPoints(entity: ArcEntity): Point[] {
  const startAngle = degreesToRadians(entity.startAngleDegrees);
  let endAngle = degreesToRadians(entity.endAngleDegrees);
  while (endAngle < startAngle) {
    endAngle += Math.PI * 2;
  }
  return arcPoints(entity.center, entity.radius, startAngle, endAngle - startAngle);
}

function arcPoints(center: Point, radius: number, startAngle: number, sweep: number): Point[] {
  const angles = [startAngle, startAngle + sweep];
  const direction = sweep >= 0 ? 1 : -1;
  const absoluteSweep = Math.abs(sweep);
  for (const cardinal of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
    if (angleOnSweep(cardinal, startAngle, sweep)) {
      angles.push(startAngle + direction * normalizedPositive(direction * (cardinal - startAngle)));
    }
  }

  const segmentCount = Math.max(4, Math.ceil((absoluteSweep / (Math.PI / 12))));
  for (let index = 1; index < segmentCount; index += 1) {
    angles.push(startAngle + (sweep * index) / segmentCount);
  }

  const uniqueAngles = new Map(angles.map((angle) => [round(angle), angle]));
  return [...uniqueAngles.values()].map((angle) => ({
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  }));
}

function angleOnSweep(angle: number, startAngle: number, sweep: number): boolean {
  const epsilon = 0.000001;
  if (sweep >= 0) {
    return normalizedPositive(angle - startAngle) <= sweep + epsilon;
  }
  return normalizedPositive(startAngle - angle) <= Math.abs(sweep) + epsilon;
}

function normalizedPositive(angle: number): number {
  const tau = Math.PI * 2;
  let normalized = angle % tau;
  if (normalized < 0) {
    normalized += tau;
  }
  return normalized;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.000001;
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
