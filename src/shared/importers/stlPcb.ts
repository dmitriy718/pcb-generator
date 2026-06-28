import type { PcbSpecification } from '../domain';
import { inferPcbFromMechanicalReference } from './mechanicalReference';

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface StlTriangle {
  normal?: Point3;
  vertices: [Point3, Point3, Point3];
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
  const triangles = parseStlTriangles(contents);
  const vertices = triangles.flatMap((triangle) => triangle.vertices);
  if (vertices.length < 3) {
    throw new Error('STL PCB import found no triangle vertices.');
  }

  const bounds = boundsFor(vertices);
  const extents = [
    { axis: 'x' as const, size: bounds.max.x - bounds.min.x },
    { axis: 'y' as const, size: bounds.max.y - bounds.min.y },
    { axis: 'z' as const, size: bounds.max.z - bounds.min.z },
  ];
  const thinAxis = [...extents].sort((a, b) => a.size - b.size)[0]?.axis;
  return inferPcbFromMechanicalReference({
    source: 'STL',
    extents,
    candidateBoardThickness: thinAxis ? inferBoardSlabThickness(vertices, thinAxis) : undefined,
  });
}

export function parseStlTriangles(contents: Uint8Array | string): StlTriangle[] {
  if (typeof contents === 'string') {
    return parseAsciiStl(contents);
  }
  return parseStlBytes(contents);
}

function parseStlBytes(bytes: Uint8Array): StlTriangle[] {
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

function parseBinaryStl(bytes: Uint8Array): StlTriangle[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(80, true);
  const triangles: StlTriangle[] = [];
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const triangleOffset = 84 + triangle * 50;
    const normal = {
      x: view.getFloat32(triangleOffset, true),
      y: view.getFloat32(triangleOffset + 4, true),
      z: view.getFloat32(triangleOffset + 8, true),
    };
    const vertices: Point3[] = [];
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const offset = triangleOffset + 12 + vertex * 12;
      vertices.push({
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true),
        z: view.getFloat32(offset + 8, true),
      });
    }
    if (vertices.every(isFinitePoint)) {
      triangles.push(stlTriangle(vertices as [Point3, Point3, Point3], normal));
    }
  }
  return triangles;
}

function parseAsciiStl(contents: string): StlTriangle[] {
  const triangles: StlTriangle[] = [];
  for (const facetMatch of contents.matchAll(/facet\s+normal\s+([\s\S]*?)endfacet/gimu)) {
    const facet = facetMatch[1] ?? '';
    const numberMatches = [...facet.matchAll(
      /([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/giu,
    )].map((match) => Number(match[1]));
    if (numberMatches.length < 12) {
      continue;
    }
    const normal = pointFromNumbers(numberMatches, 0);
    const vertices = [
      pointFromNumbers(numberMatches, 3),
      pointFromNumbers(numberMatches, 6),
      pointFromNumbers(numberMatches, 9),
    ];
    if (vertices.every(isFinitePoint)) {
      triangles.push(stlTriangle(vertices as [Point3, Point3, Point3], normal));
    }
  }
  if (triangles.length > 0) {
    return triangles;
  }
  return parseAsciiVertexStream(contents);
}

function parseAsciiVertexStream(contents: string): StlTriangle[] {
  const vertices = [...contents.matchAll(
    /^\s*vertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*$/gimu,
  )]
    .map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
      z: Number(match[3]),
    }))
    .filter(isFinitePoint);
  const triangles: StlTriangle[] = [];
  for (let index = 0; index + 2 < vertices.length; index += 3) {
    const first = vertices[index];
    const second = vertices[index + 1];
    const third = vertices[index + 2];
    if (!first || !second || !third) {
      continue;
    }
    triangles.push({
      vertices: [first, second, third],
    });
  }
  return triangles;
}

function stlTriangle(vertices: [Point3, Point3, Point3], normal?: Point3): StlTriangle {
  if (normal && isFinitePoint(normal)) {
    return { normal, vertices };
  }
  return { vertices };
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

function pointFromNumbers(values: number[], offset: number): Point3 {
  return {
    x: values[offset] ?? Number.NaN,
    y: values[offset + 1] ?? Number.NaN,
    z: values[offset + 2] ?? Number.NaN,
  };
}

function inferBoardSlabThickness(points: Point3[], axis: keyof Point3): number | undefined {
  const levels = Array.from(new Set(points.map((point) => round(point[axis])))).sort((a, b) => a - b);
  const bottom = levels[0];
  if (bottom === undefined) {
    return undefined;
  }
  return levels.find((level) => {
    const thickness = round(level - bottom);
    return thickness >= 0.6 && thickness <= 3.2;
  });
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
