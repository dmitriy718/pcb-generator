import type { TriangleMesh } from '../domain';

export function exportAsciiStl(mesh: TriangleMesh, solidName: string): string {
  const name = sanitizeSolidName(solidName);
  const lines = [`solid ${name}`];

  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = vertexAt(mesh, mesh.indices[i] ?? 0);
    const b = vertexAt(mesh, mesh.indices[i + 1] ?? 0);
    const c = vertexAt(mesh, mesh.indices[i + 2] ?? 0);
    const normal = faceNormal(a, b, c);
    lines.push(`  facet normal ${format(normal.x)} ${format(normal.y)} ${format(normal.z)}`);
    lines.push('    outer loop');
    lines.push(`      vertex ${format(a.x)} ${format(a.y)} ${format(a.z)}`);
    lines.push(`      vertex ${format(b.x)} ${format(b.y)} ${format(b.z)}`);
    lines.push(`      vertex ${format(c.x)} ${format(c.y)} ${format(c.z)}`);
    lines.push('    endloop');
    lines.push('  endfacet');
  }

  lines.push(`endsolid ${name}`);
  return `${lines.join('\n')}\n`;
}

function sanitizeSolidName(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'pcb_enclosure';
}

function vertexAt(mesh: TriangleMesh, index: number): { x: number; y: number; z: number } {
  const offset = index * 3;
  return {
    x: mesh.vertices[offset] ?? 0,
    y: mesh.vertices[offset + 1] ?? 0,
    z: mesh.vertices[offset + 2] ?? 0,
  };
}

function faceNormal(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const cross = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x,
  };
  const length = Math.hypot(cross.x, cross.y, cross.z);
  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: cross.x / length, y: cross.y / length, z: cross.z / length };
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}
