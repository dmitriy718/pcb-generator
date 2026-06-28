import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { generateTwoPieceScrewCase } from '../src/shared/cad';
import { defaultProject } from '../src/shared/domain';
import {
  exportAsciiStl,
  buildBillOfMaterials,
  exportBomCsv,
  exportDxfDrawing,
  exportGltf,
  exportMakerWorldMetadata,
  exportObj,
  exportSvgDrawing,
  exportThreeMf,
} from '../src/shared/exporters';

describe('exporters', () => {
  it('exports ASCII STL with facets', () => {
    const generated = generateTwoPieceScrewCase(defaultProject);
    const stl = exportAsciiStl(generated.mesh, defaultProject.name);

    expect(stl.startsWith('solid ESP32_Control_Board_Enclosure')).toBe(true);
    expect(stl).toContain('facet normal');
    expect(stl).toContain('vertex');
  });

  it('exports OBJ vertices and faces', () => {
    const generated = generateTwoPieceScrewCase(defaultProject);
    const obj = exportObj(generated.mesh, defaultProject.name);

    expect(obj).toContain('# units: millimeters');
    expect(obj).toContain('\nv ');
    expect(obj).toContain('\nf ');
  });

  it('exports MakerWorld metadata JSON', () => {
    const generated = generateTwoPieceScrewCase(defaultProject);
    const metadata = JSON.parse(exportMakerWorldMetadata(generated.metadata)) as {
      title: string;
      supportRequired: boolean;
      recommendedLayerHeightMm: number;
    };

    expect(metadata.title).toBe(defaultProject.name);
    expect(metadata.supportRequired).toBe(false);
    expect(metadata.recommendedLayerHeightMm).toBeGreaterThan(0);
    expect(JSON.parse(exportMakerWorldMetadata(generated.metadata))).toHaveProperty('printability');
  });

  it('exports a valid 3MF package with model geometry and embedded metadata', async () => {
    const generated = generateTwoPieceScrewCase(defaultProject);
    const packageBytes = await exportThreeMf(generated.mesh, generated.metadata);
    const zip = await JSZip.loadAsync(packageBytes);
    const modelFile = zip.file('3D/3dmodel.model');
    const metadataFile = zip.file('Metadata/makerworld.json');

    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    expect(zip.file('_rels/.rels')).not.toBeNull();
    expect(modelFile).not.toBeNull();
    expect(metadataFile).not.toBeNull();

    const modelXml = await modelFile?.async('string');
    expect(modelXml).toContain('<model unit="millimeter"');
    expect(modelXml).toContain('<vertices>');
    expect(modelXml).toContain('<triangles>');
    expect(modelXml).toContain('<item objectid="1" />');

    const metadataJson = await metadataFile?.async('string');
    expect(metadataJson).toContain('"supportRequired": false');
  });

  it('exports an SVG drawing with top view and connector cutout elevation', () => {
    const svg = exportSvgDrawing(defaultProject);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('top view and front elevation');
    expect(svg).toContain('class="pcb"');
    expect(svg).toContain('class="hole"');
    expect(svg).toContain('class="cutout"');
    expect(svg).toContain('USB-C');
  });

  it('exports a DXF drawing with millimeter units and manufacturing layers', () => {
    const dxf = exportDxfDrawing(defaultProject);

    expect(dxf).toContain('$INSUNITS');
    expect(dxf).toContain('\n4\n');
    expect(dxf).toContain('ENCLOSURE');
    expect(dxf).toContain('PCB');
    expect(dxf).toContain('HOLES');
    expect(dxf).toContain('CUTOUTS');
    expect(dxf.endsWith('EOF\n')).toBe(true);
  });

  it('exports a GLTF 2.0 mesh with embedded buffer data and manufacturing extras', () => {
    const generated = generateTwoPieceScrewCase(defaultProject);
    const gltf = JSON.parse(exportGltf(generated.mesh, generated.metadata)) as {
      asset: { version: string };
      meshes: { primitives: { attributes: { POSITION: number }; indices: number; mode: number }[] }[];
      buffers: { byteLength: number; uri: string }[];
      accessors: { componentType: number; count: number; type: string }[];
      extras: { units: string; material: string; supportRequired: boolean; printability: unknown };
    };

    expect(gltf.asset.version).toBe('2.0');
    expect(gltf.meshes[0]?.primitives[0]).toMatchObject({
      attributes: { POSITION: 0 },
      indices: 1,
      mode: 4,
    });
    expect(gltf.buffers[0]?.uri).toMatch(/^data:application\/octet-stream;base64,/);
    expect(gltf.buffers[0]?.byteLength).toBeGreaterThan(0);
    expect(gltf.accessors[0]).toMatchObject({
      componentType: 5126,
      count: generated.mesh.vertices.length / 3,
      type: 'VEC3',
    });
    expect(gltf.accessors[1]).toMatchObject({
      componentType: 5125,
      count: generated.mesh.indices.length,
      type: 'SCALAR',
    });
    expect(gltf.extras).toMatchObject({ units: 'mm', material: 'PLA', supportRequired: false });
    expect(gltf.extras.printability).toBeDefined();
  });

  it('builds a bill of materials from material and fastener parameters', () => {
    const items = buildBillOfMaterials(defaultProject);

    expect(items.map((item) => item.item)).toContain('Base enclosure');
    expect(items.map((item) => item.item)).toContain('Lid');
    expect(items.some((item) => item.item === 'M2.5 self-tapping screw' && item.quantity === 4)).toBe(true);
    expect(items.some((item) => item.category === 'material' && item.specification === 'PLA')).toBe(true);
  });

  it('exports a BOM CSV with header and connector finishing row', () => {
    const csv = exportBomCsv(defaultProject);

    expect(csv.startsWith('Item,Category,Quantity,Unit,Specification,Notes\n')).toBe(true);
    expect(csv).toContain('Base enclosure,printed_part,1,part');
    expect(csv).toContain('M2.5 self-tapping screw,hardware,4,piece');
    expect(csv).toContain('Connector opening finishing,process,1,opening,USB-C');
  });
});
