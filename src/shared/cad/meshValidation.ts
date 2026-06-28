import type { TriangleMesh, ValidationResult } from '../domain/types';
import { triangleArea } from './meshBuilder';

export function validateMesh(mesh: TriangleMesh): ValidationResult {
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

  return { ok: issues.length === 0, issues };
}

function vertex(mesh: TriangleMesh, index: number): { x: number; y: number; z: number } {
  const offset = index * 3;
  return {
    x: mesh.vertices[offset] ?? 0,
    y: mesh.vertices[offset + 1] ?? 0,
    z: mesh.vertices[offset + 2] ?? 0,
  };
}
