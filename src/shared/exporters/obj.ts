import type { TriangleMesh } from '../domain';

export function exportObj(mesh: TriangleMesh, objectName: string): string {
  const lines = [`o ${sanitizeObjectName(objectName)}`, '# units: millimeters'];
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    lines.push(
      `v ${format(mesh.vertices[i] ?? 0)} ${format(mesh.vertices[i + 1] ?? 0)} ${format(mesh.vertices[i + 2] ?? 0)}`,
    );
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    lines.push(
      `f ${(mesh.indices[i] ?? 0) + 1} ${(mesh.indices[i + 1] ?? 0) + 1} ${(mesh.indices[i + 2] ?? 0) + 1}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function sanitizeObjectName(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'pcb_enclosure';
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}
