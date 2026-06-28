import type { MeshTopologyReport, TriangleMesh, ValidationResult } from '../domain/types';
import { triangleArea } from './meshBuilder';

export interface MeshValidationOptions {
  checkTopology?: boolean;
}

export function validateMesh(mesh: TriangleMesh, options: MeshValidationOptions = {}): ValidationResult {
  const issues: ValidationResult['issues'] = [];

  if (mesh.vertices.length === 0 || mesh.indices.length === 0) {
    issues.push({ code: 'empty_mesh', path: 'mesh', message: 'Generated mesh is empty.' });
  }

  if (mesh.vertices.length % 3 !== 0) {
    issues.push({
      code: 'invalid_vertex_buffer',
      path: 'mesh.vertices',
      message: 'Vertex buffer length must be divisible by 3.',
    });
  }

  if (mesh.indices.length % 3 !== 0) {
    issues.push({
      code: 'invalid_index_buffer',
      path: 'mesh.indices',
      message: 'Index buffer length must be divisible by 3.',
    });
  }

  const vertexCount = mesh.vertices.length / 3;
  for (const [position, index] of mesh.indices.entries()) {
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
      issues.push({
        code: 'index_out_of_range',
        path: `mesh.indices.${position}`,
        message: 'Mesh index references a missing vertex.',
      });
      break;
    }
  }

  for (let i = 0; i < mesh.vertices.length; i += 1) {
    if (!Number.isFinite(mesh.vertices[i])) {
      issues.push({
        code: 'non_finite_vertex',
        path: `mesh.vertices.${i}`,
        message: 'Mesh contains a non-finite vertex coordinate.',
      });
      break;
    }
  }

  let degenerateTriangles = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = vertex(mesh, mesh.indices[i] ?? 0);
    const b = vertex(mesh, mesh.indices[i + 1] ?? 0);
    const c = vertex(mesh, mesh.indices[i + 2] ?? 0);
    if (triangleArea(a, b, c) < 0.000001) {
      degenerateTriangles += 1;
    }
  }

  if (degenerateTriangles > 0) {
    issues.push({
      code: 'degenerate_triangles',
      path: 'mesh.indices',
      message: `Generated mesh contains ${degenerateTriangles} degenerate triangle(s).`,
    });
  }

  if (options.checkTopology && issues.length === 0) {
    const topology = analyzeMeshTopology(mesh);
    if (topology.boundaryEdges > 0) {
      issues.push({
        code: 'boundary_edges',
        path: 'mesh.indices',
        message: `Generated mesh contains ${topology.boundaryEdges} boundary edge(s), so it is not watertight.`,
      });
    }
    if (topology.nonManifoldEdges > 0) {
      issues.push({
        code: 'non_manifold_edges',
        path: 'mesh.indices',
        message: `Generated mesh contains ${topology.nonManifoldEdges} non-manifold edge(s).`,
      });
    }
    if (topology.duplicateTriangles > 0 || topology.reversedDuplicateTriangles > 0) {
      issues.push({
        code: 'duplicate_triangles',
        path: 'mesh.indices',
        message: `Generated mesh contains ${topology.duplicateTriangles + topology.reversedDuplicateTriangles} duplicate or reversed duplicate triangle(s).`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function analyzeMeshTopology(mesh: TriangleMesh): MeshTopologyReport {
  const edgeUse = new Map<string, number>();
  const orientedTriangleUse = new Map<string, number>();
  let duplicateTriangles = 0;
  let reversedDuplicateTriangles = 0;

  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] ?? 0;
    const b = mesh.indices[i + 1] ?? 0;
    const c = mesh.indices[i + 2] ?? 0;
    addEdge(edgeUse, mesh, a, b);
    addEdge(edgeUse, mesh, b, c);
    addEdge(edgeUse, mesh, c, a);

    const orientedTriangleKey = orientedGeometricTriangleKey(mesh, [a, b, c]);
    const reversedTriangleKey = orientedGeometricTriangleKey(mesh, [c, b, a]);
    if ((orientedTriangleUse.get(orientedTriangleKey) ?? 0) > 0) {
      duplicateTriangles += 1;
    } else if ((orientedTriangleUse.get(reversedTriangleKey) ?? 0) > 0) {
      reversedDuplicateTriangles += 1;
    }
    orientedTriangleUse.set(orientedTriangleKey, (orientedTriangleUse.get(orientedTriangleKey) ?? 0) + 1);
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const uses of edgeUse.values()) {
    if (uses === 1) {
      boundaryEdges += 1;
    } else if (uses > 2) {
      nonManifoldEdges += 1;
    }
  }

  return {
    vertexCount: mesh.vertices.length / 3,
    triangleCount: mesh.indices.length / 3,
    edgeCount: edgeUse.size,
    boundaryEdges,
    nonManifoldEdges,
    duplicateTriangles,
    reversedDuplicateTriangles,
    isClosed: boundaryEdges === 0,
    isEdgeManifold: nonManifoldEdges === 0,
  };
}

function vertex(mesh: TriangleMesh, index: number): { x: number; y: number; z: number } {
  const offset = index * 3;
  return {
    x: mesh.vertices[offset] ?? 0,
    y: mesh.vertices[offset + 1] ?? 0,
    z: mesh.vertices[offset + 2] ?? 0,
  };
}

function addEdge(edgeUse: Map<string, number>, mesh: TriangleMesh, start: number, end: number): void {
  const startKey = vertexKey(mesh, start);
  const endKey = vertexKey(mesh, end);
  const key = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
  edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
}

function orientedGeometricTriangleKey(mesh: TriangleMesh, indices: [number, number, number]): string {
  return indices.map((index) => vertexKey(mesh, index)).join('|');
}

function vertexKey(mesh: TriangleMesh, index: number): string {
  const current = vertex(mesh, index);
  return `${coordinateKey(current.x)},${coordinateKey(current.y)},${coordinateKey(current.z)}`;
}

function coordinateKey(value: number): string {
  return (Math.round(value * 1_000_000) / 1_000_000).toFixed(6);
}
