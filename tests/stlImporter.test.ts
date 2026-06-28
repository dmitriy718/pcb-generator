import { describe, expect, it } from 'vitest';
import { importStlPcb } from '../src/shared/importers';

describe('importStlPcb', () => {
  it('imports board dimensions and thickness from ASCII STL bounds', () => {
    const result = importStlPcb(`
solid pcb
  facet normal 0 0 1
    outer loop
      vertex 10 20 0
      vertex 95 20 0
      vertex 95 76 1.6
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 10 20 0
      vertex 95 76 1.6
      vertex 10 76 1.6
    endloop
  endfacet
endsolid pcb
`);

    expect(result.pcb).toEqual({
      width: 85,
      height: 56,
      thickness: 1.6,
      componentHeight: 0,
      cornerRadius: 0,
      mountingHoles: [],
      connectorCutouts: [],
    });
    expect(result.warnings).toContain('STL has no PCB semantics; board dimensions were inferred from mesh bounds.');
  });

  it('imports binary STL bounds', () => {
    const result = importStlPcb(
      binaryStl([
        [
          [0, 0, 0],
          [50, 0, 0],
          [50, 25, 1.2],
        ],
        [
          [0, 0, 0],
          [50, 25, 1.2],
          [0, 25, 1.2],
        ],
      ]),
    );

    expect(result.pcb.width).toBe(50);
    expect(result.pcb.height).toBe(25);
    expect(result.pcb.thickness).toBe(1.2);
  });

  it('defaults thickness for flat STL outlines', () => {
    const result = importStlPcb(`
solid flat
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 60 0 0
      vertex 60 30 0
    endloop
  endfacet
endsolid flat
`);

    expect(result.pcb.thickness).toBe(1.6);
    expect(result.warnings).toContain('STL thickness was flat or missing; defaulted board thickness to 1.6 mm.');
  });

  it('splits populated assembly height into board thickness and component height', () => {
    const result = importStlPcb(
      binaryStl([
        [
          [0, 0, 0],
          [80, 0, 0],
          [80, 40, 1.6],
        ],
        [
          [0, 0, 0],
          [80, 40, 1.6],
          [0, 40, 1.6],
        ],
        [
          [10, 10, 1.6],
          [20, 10, 10],
          [20, 20, 10],
        ],
      ]),
    );

    expect(result.pcb.width).toBe(80);
    expect(result.pcb.height).toBe(40);
    expect(result.pcb.thickness).toBe(1.6);
    expect(result.pcb.componentHeight).toBe(8.4);
    expect(result.warnings).toContain(
      'STL reference height (10 mm) looks like a populated assembly; board thickness was set to 1.6 mm and component height to 8.4 mm.',
    );
  });

  it('warns when a reference board is not modeled with Z as the thin axis', () => {
    const result = importStlPcb(
      binaryStl([
        [
          [0, 0, 0],
          [1.6, 0, 0],
          [1.6, 40, 80],
        ],
        [
          [0, 0, 0],
          [1.6, 40, 80],
          [0, 40, 80],
        ],
      ]),
    );

    expect(result.pcb.width).toBe(80);
    expect(result.pcb.height).toBe(40);
    expect(result.pcb.thickness).toBe(1.6);
    expect(result.warnings).toContain(
      'STL thin axis was X, so dimensions were reoriented from model extents; verify PCB orientation.',
    );
  });

  it('rejects STL files without vertices', () => {
    expect(() => importStlPcb('solid empty\nendsolid empty\n')).toThrow('no triangle vertices');
  });
});

function binaryStl(triangles: [[number, number, number], [number, number, number], [number, number, number]][]): Uint8Array {
  const bytes = new Uint8Array(84 + triangles.length * 50);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, triangles.length, true);
  for (const [triangleIndex, triangle] of triangles.entries()) {
    const triangleOffset = 84 + triangleIndex * 50;
    for (const [vertexIndex, vertex] of triangle.entries()) {
      const offset = triangleOffset + 12 + vertexIndex * 12;
      view.setFloat32(offset, vertex[0], true);
      view.setFloat32(offset + 4, vertex[1], true);
      view.setFloat32(offset + 8, vertex[2], true);
    }
  }
  return bytes;
}
