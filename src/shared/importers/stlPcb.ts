import type { PcbSpecification } from '../domain';

interface Point3 {
  x: number;
  y: number;
  z: number;
}

interface Bounds {
  min: Point3;
  max: Point3;
}

export interface StlImportResult {
  pcb: PcbSpecification;
  warnings: string[];
}

export function importStlPcb(contents: Uint8Array | string): StlImportResult {
  const vertices = typeof contents === 'string' ? parseAsciiStl(contents) : parseStlBytes(contents);
  if (vertices.length < 3) {
    throw new Error('STL PCB import found no triangle vertices.');
  }

  const bounds = boundsFor(vertices);
  const extents = [
    { axis: 'x' as const, size: bounds.max.x - bounds.min.x },
    { axis: 'y' as const, size: bounds.max.y - bounds.min.y },
    { axis: 'z' as const, size: bounds.max.z - bounds.min.z },
  ].sort((a, b) => b.size - a.size);

  const width = round(extents[0]?.size ?? 0);
  const height = round(extents[1]?.size ?? 0);
  const measuredThickness = round(extents[2]?.size ?? 0);
  if (width <= 0 || height <= 0) {
    throw new Error('STL PCB import could not determine positive board width and height.');
  }

  const warnings = [
    'STL has no PCB semantics; board dimensions were inferred from mesh bounds.',
    'Mounting holes, connector cutouts, components, and ports must be verified or added manually.',
  ];
  let thickness = measuredThickness;
  if (thickness <= 0.05) {
    thickness = 1.6;
    warnings.push('STL thickness was flat or missing; defaulted board thickness to 1.6 mm.');
  } else if (thickness > 4) {
    warnings.push(
      'STL thickness is larger than a typical bare PCB; imported mesh may include components or a full assembly.',
    );
  }

  return {
    pcb: {
      width,
      height,
      thickness,
      componentHeight: Math.max(0, round(thickness - 1.6)),
      cornerRadius: 0,
      mountingHoles: [],
      connectorCutouts: [],
    },
    warnings,
  };
}

function parseStlBytes(bytes: Uint8Array): Point3[] {
  if (isBinaryStl(bytes)) {
    return parseBinaryStl(bytes);
  }
  return parseAsciiStl(new TextDecoder('utf-8', { fatal: false }).decode(bytes));
}

function isBinaryStl(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 84) {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(80, true);
  return 84 + triangleCount * 50 === bytes.byteLength;
}

function parseBinaryStl(bytes: Uint8Array): Point3[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(80, true);
  const vertices: Point3[] = [];
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const triangleOffset = 84 + triangle * 50;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const offset = triangleOffset + 12 + vertex * 12;
      vertices.push({
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true),
        z: view.getFloat32(offset + 8, true),
      });
    }
  }
  return vertices.filter(isFinitePoint);
}

function parseAsciiStl(contents: string): Point3[] {
  const vertices: Point3[] = [];
  for (const match of contents.matchAll(
    /^\s*vertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*$/gimu,
  )) {
    vertices.push({
      x: Number(match[1]),
      y: Number(match[2]),
      z: Number(match[3]),
    });
  }
  return vertices.filter(isFinitePoint);
}

function boundsFor(points: Point3[]): Bounds {
  const bounds: Bounds = {
    min: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY },
    max: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY },
  };
  for (const point of points) {
    bounds.min.x = Math.min(bounds.min.x, point.x);
    bounds.min.y = Math.min(bounds.min.y, point.y);
    bounds.min.z = Math.min(bounds.min.z, point.z);
    bounds.max.x = Math.max(bounds.max.x, point.x);
    bounds.max.y = Math.max(bounds.max.y, point.y);
    bounds.max.z = Math.max(bounds.max.z, point.z);
  }
  return bounds;
}

function isFinitePoint(point: Point3): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
