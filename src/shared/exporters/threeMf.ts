import JSZip from 'jszip';
import type { ManufacturingMetadata, TriangleMesh } from '../domain';

export async function exportThreeMf(
  mesh: TriangleMesh,
  metadata: ManufacturingMetadata,
): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml());
  zip.folder('_rels')?.file('.rels', relationshipsXml());
  zip.folder('3D')?.file('3dmodel.model', modelXml(mesh, metadata));
  zip.folder('Metadata')?.file('makerworld.json', `${JSON.stringify(metadataForPackage(metadata), null, 2)}\n`);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

function contentTypesXml(): string {
  return xml([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />',
    '  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />',
    '  <Default Extension="json" ContentType="application/json" />',
    '</Types>',
  ]);
}

function relationshipsXml(): string {
  return xml([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />',
    '</Relationships>',
  ]);
}

function modelXml(mesh: TriangleMesh, metadata: ManufacturingMetadata): string {
  const vertices: string[] = [];
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    vertices.push(
      `          <vertex x="${format(mesh.vertices[i] ?? 0)}" y="${format(mesh.vertices[i + 1] ?? 0)}" z="${format(
        mesh.vertices[i + 2] ?? 0,
      )}" />`,
    );
  }

  const triangles: string[] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    triangles.push(
      `          <triangle v1="${mesh.indices[i] ?? 0}" v2="${mesh.indices[i + 1] ?? 0}" v3="${mesh.indices[i + 2] ?? 0}" />`,
    );
  }

  return xml([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    '  <metadata name="Title">' + escapeXml(metadata.modelName) + '</metadata>',
    '  <metadata name="Designer">PCB Enclosure Generator</metadata>',
    '  <resources>',
    '    <object id="1" type="model">',
    '      <mesh>',
    '        <vertices>',
    ...vertices,
    '        </vertices>',
    '        <triangles>',
    ...triangles,
    '        </triangles>',
    '      </mesh>',
    '    </object>',
    '  </resources>',
    '  <build>',
    '    <item objectid="1" />',
    '  </build>',
    '</model>',
  ]);
}

function metadataForPackage(metadata: ManufacturingMetadata): Record<string, unknown> {
  return {
    title: metadata.makerWorld.title,
    material: metadata.material.name,
    recommendedLayerHeightMm: metadata.layerHeight,
    recommendedInfillPercent: metadata.infillPercent,
    supportRequired: metadata.supportRequired,
    printOrientation: metadata.printOrientation,
    layout: metadata.layout,
    meshTopology: metadata.meshTopology,
    printability: metadata.printability,
  };
}

function xml(lines: string[]): string {
  return `${lines.join('\n')}\n`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}
