import type { ManufacturingMetadata, TriangleMesh } from '../domain';

interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export function exportGltf(mesh: TriangleMesh, metadata: ManufacturingMetadata): string {
  const positionBuffer = float32Buffer(mesh.vertices);
  const indexBuffer = uint32Buffer(mesh.indices);
  const combined = Buffer.concat([positionBuffer, indexBuffer]);
  const positionBounds = boundsForVertices(mesh.vertices);
  const indexOffset = positionBuffer.byteLength;

  return `${JSON.stringify(
    {
      asset: {
        version: '2.0',
        generator: 'PCB Enclosure Generator',
        copyright: 'Generated model',
      },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: metadata.modelName }],
      meshes: [
        {
          name: metadata.modelName,
          primitives: [
            {
              attributes: { POSITION: 0 },
              indices: 1,
              material: 0,
              mode: 4,
            },
          ],
        },
      ],
      materials: [
        {
          name: `${metadata.material.name} enclosure material`,
          pbrMetallicRoughness: {
            baseColorFactor: [0.58, 0.72, 0.69, 1],
            metallicFactor: 0,
            roughnessFactor: 0.55,
          },
        },
      ],
      buffers: [
        {
          byteLength: combined.byteLength,
          uri: `data:application/octet-stream;base64,${combined.toString('base64')}`,
        },
      ],
      bufferViews: [
        {
          buffer: 0,
          byteOffset: 0,
          byteLength: positionBuffer.byteLength,
          target: 34962,
        },
        {
          buffer: 0,
          byteOffset: indexOffset,
          byteLength: indexBuffer.byteLength,
          target: 34963,
        },
      ],
      accessors: [
        {
          bufferView: 0,
          byteOffset: 0,
          componentType: 5126,
          count: mesh.vertices.length / 3,
          type: 'VEC3',
          min: positionBounds.min,
          max: positionBounds.max,
        },
        {
          bufferView: 1,
          byteOffset: 0,
          componentType: 5125,
          count: mesh.indices.length,
          type: 'SCALAR',
        },
      ],
      extras: {
        units: mesh.units,
        supportRequired: metadata.supportRequired,
        printOrientation: metadata.printOrientation,
        material: metadata.material.name,
        layout: metadata.layout,
        printability: metadata.printability,
      },
    },
    null,
    2,
  )}\n`;
}

function float32Buffer(values: number[]): Buffer {
  const buffer = Buffer.alloc(values.length * 4);
  for (const [index, value] of values.entries()) {
    buffer.writeFloatLE(value, index * 4);
  }
  return buffer;
}

function uint32Buffer(values: number[]): Buffer {
  const buffer = Buffer.alloc(values.length * 4);
  for (const [index, value] of values.entries()) {
    buffer.writeUInt32LE(value, index * 4);
  }
  return buffer;
}

function boundsForVertices(vertices: number[]): Bounds {
  const bounds: Bounds = {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  };

  for (let i = 0; i < vertices.length; i += 3) {
    bounds.min[0] = Math.min(bounds.min[0], vertices[i] ?? 0);
    bounds.min[1] = Math.min(bounds.min[1], vertices[i + 1] ?? 0);
    bounds.min[2] = Math.min(bounds.min[2], vertices[i + 2] ?? 0);
    bounds.max[0] = Math.max(bounds.max[0], vertices[i] ?? 0);
    bounds.max[1] = Math.max(bounds.max[1], vertices[i + 1] ?? 0);
    bounds.max[2] = Math.max(bounds.max[2], vertices[i + 2] ?? 0);
  }

  return bounds;
}
