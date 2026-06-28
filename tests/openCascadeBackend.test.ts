import { describe, expect, it } from 'vitest';
import {
  exportTwoPieceScrewCaseStep,
  generateTwoPieceScrewCaseKernelMesh,
  importStepPcbReference,
} from '../src/shared/cad/kernel/openCascadeBackend';
import { analyzeMeshTopology, validateMesh } from '../src/shared/cad/meshValidation';
import { defaultProject } from '../src/shared/domain';
import { fastenerProfileById } from '../src/shared/fasteners';

let defaultStepFixture: string | undefined;

describe('OpenCascade backend', () => {
  it('exports a validated STEP model for the default two-piece case shell', async () => {
    const step = await exportTwoPieceScrewCaseStep(defaultProject);
    defaultStepFixture = step;

    expect(step.startsWith('ISO-10303-21;')).toBe(true);
    expect(step).toContain('FILE_SCHEMA');
    expect(step).toContain('MANIFOLD_SOLID_BREP');
    expect(step).toContain('CYLINDRICAL_SURFACE');
    expect(step.length).toBeGreaterThan(10_000);
  });

  it('generates a watertight OpenCascade tessellation for production mesh exports', async () => {
    const mesh = await generateTwoPieceScrewCaseKernelMesh(defaultProject);
    const validation = validateMesh(mesh, { checkTopology: true });
    const topology = analyzeMeshTopology(mesh);

    expect(validation).toEqual({ ok: true, issues: [] });
    expect(mesh.vertices.length / 3).toBeGreaterThan(100);
    expect(mesh.indices.length / 3).toBeGreaterThan(100);
    expect(mesh.groups).toHaveLength(2);
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  });

  it('applies the editable chamfer parameter in the OpenCascade tessellation', async () => {
    const squareEdgeMesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: { ...defaultProject.enclosure, chamfer: 0, cornerRadius: 0 },
    });
    const chamferedMesh = await generateTwoPieceScrewCaseKernelMesh(defaultProject);

    expect(chamferedMesh.indices.length).toBeGreaterThan(squareEdgeMesh.indices.length);
  });

  it('applies selective outer fillets when chamfer is disabled', async () => {
    const squareEdgeMesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: { ...defaultProject.enclosure, chamfer: 0, cornerRadius: 0 },
    });
    const filletedMesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: { ...defaultProject.enclosure, chamfer: 0, cornerRadius: 8 },
    });
    const topology = analyzeMeshTopology(filletedMesh);

    expect(validateMesh(filletedMesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(filletedMesh.indices.length).toBeGreaterThan(squareEdgeMesh.indices.length);
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 30_000);

  it('generates valid OpenCascade heat-set insert socket geometry', async () => {
    const profile = fastenerProfileById('m3_heat_set_insert');
    expect(profile).toBeDefined();
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: {
        ...defaultProject.enclosure,
        fastenerProfileId: profile?.id ?? '',
        standoffDiameter: profile?.standoffDiameter ?? defaultProject.enclosure.standoffDiameter,
        standoffHoleDiameter:
          profile?.standoffHoleDiameter ?? defaultProject.enclosure.standoffHoleDiameter,
        standoffHeight: profile?.recommendedStandoffHeight ?? defaultProject.enclosure.standoffHeight,
        screwBossDiameter: profile?.screwBossDiameter ?? defaultProject.enclosure.screwBossDiameter,
        screwHoleDiameter: profile?.screwHoleDiameter ?? defaultProject.enclosure.screwHoleDiameter,
      },
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  });

  it('generates valid OpenCascade lid design feature geometry', async () => {
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: {
        ...defaultProject.enclosure,
        chamfer: 0,
        ventilationRegions: [],
        designFeatures: [
          {
            id: 'feature-button',
            label: 'Reset button',
            kind: 'button_opening',
            shape: 'circle',
            operation: 'through_cut',
            x: 24,
            y: 18,
            width: 5,
            height: 5,
            diameter: 5,
            depth: defaultProject.enclosure.lidThickness,
            cornerRadius: 0,
            spacing: 4,
            rows: 1,
            columns: 1,
            text: '',
          },
          {
            id: 'feature-label',
            label: 'Label recess',
            kind: 'label_recess',
            shape: 'rectangle',
            operation: 'recess',
            x: 43,
            y: 18,
            width: 12,
            height: 5,
            diameter: 5,
            depth: 0.4,
            cornerRadius: 0,
            spacing: 4,
            rows: 1,
            columns: 1,
            text: 'ID',
          },
        ],
      },
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  });

  it('generates valid OpenCascade QR recess module geometry', async () => {
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: {
        ...defaultProject.enclosure,
        chamfer: 0,
        ventilationRegions: [],
        designFeatures: [
          {
            id: 'feature-qr',
            label: 'Serial QR',
            kind: 'qr_recess',
            shape: 'rectangle',
            operation: 'recess',
            x: 32,
            y: 18,
            width: 14,
            height: 14,
            diameter: 14,
            depth: 0.35,
            cornerRadius: 0,
            spacing: 2,
            rows: 1,
            columns: 1,
            text: 'PCB-001',
          },
        ],
      },
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(mesh.indices.length / 3).toBeGreaterThan(500);
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 60_000);

  it('generates valid OpenCascade text engraving module geometry', async () => {
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: {
        ...defaultProject.enclosure,
        chamfer: 0,
        ventilationRegions: [],
        designFeatures: [
          {
            id: 'feature-text',
            label: 'Serial text',
            kind: 'text_engraving',
            shape: 'rectangle',
            operation: 'recess',
            x: 32,
            y: 18,
            width: 16,
            height: 5,
            diameter: 5,
            depth: 0.3,
            cornerRadius: 0,
            spacing: 2,
            rows: 1,
            columns: 1,
            text: 'A1',
          },
        ],
      },
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(mesh.indices.length / 3).toBeGreaterThan(300);
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 30_000);

  it('generates valid OpenCascade logo badge module geometry', async () => {
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: {
        ...defaultProject.enclosure,
        chamfer: 0,
        ventilationRegions: [],
        designFeatures: [
          {
            id: 'feature-logo',
            label: 'Logo badge',
            kind: 'logo_badge',
            shape: 'rounded_rectangle',
            operation: 'emboss',
            x: 32,
            y: 18,
            width: 12,
            height: 8,
            diameter: 8,
            depth: 0.4,
            cornerRadius: 1,
            spacing: 2,
            rows: 1,
            columns: 1,
            text: 'OSHW',
          },
        ],
      },
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(mesh.indices.length / 3).toBeGreaterThan(300);
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 30_000);

  it('generates valid OpenCascade imported SVG logo footprint geometry', async () => {
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: {
        ...defaultProject.enclosure,
        chamfer: 0,
        ventilationRegions: [],
        designFeatures: [
          {
            id: 'feature-logo-imported',
            label: 'Imported logo',
            kind: 'logo_badge',
            shape: 'rounded_rectangle',
            operation: 'emboss',
            x: 32,
            y: 18,
            width: 14,
            height: 8,
            diameter: 8,
            depth: 0.8,
            cornerRadius: 1,
            spacing: 2,
            rows: 1,
            columns: 1,
            text: 'Imported',
            customFootprints: [
              { xRatio: 0.25, yRatio: 0.5, widthRatio: 0.3, heightRatio: 0.4, cornerRadiusRatio: 0.1 },
              { xRatio: 0.7, yRatio: 0.5, widthRatio: 0.25, heightRatio: 0.5, cornerRadiusRatio: 0.5 },
            ],
          },
        ],
      },
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 30_000);

  it('imports STEP reference geometry bounds through OpenCascade', async () => {
    const step = defaultStepFixture ?? await exportTwoPieceScrewCaseStep(defaultProject);
    const imported = await importStepPcbReference(step);

    expect(imported.pcb.width).toBeGreaterThan(0);
    expect(imported.pcb.height).toBeGreaterThan(0);
    expect(imported.pcb.thickness).toBeGreaterThan(0);
    expect(imported.pcb.mountingHoles).toEqual([]);
    expect(imported.warnings).toContain('STEP geometry was imported from model bounds; verify PCB orientation and dimensions.');
  });

  it('splits tall STEP text fallback bounds into board thickness and component height', async () => {
    const imported = await importStepPcbReference(`
ISO-10303-21;
DATA;
#1=CARTESIAN_POINT('',(0,0,0));
#2=CARTESIAN_POINT('',(90,0,0));
#3=CARTESIAN_POINT('',(90,55,10));
#4=CARTESIAN_POINT('',(0,55,1.6));
ENDSEC;
END-ISO-10303-21;
`);

    expect(imported.pcb.width).toBe(90);
    expect(imported.pcb.height).toBe(55);
    expect(imported.pcb.thickness).toBe(1.6);
    expect(imported.pcb.componentHeight).toBe(8.4);
    expect(imported.warnings).toContain(
      'STEP reference height (10 mm) looks like a populated assembly; board thickness was set to 1.6 mm and component height to 8.4 mm.',
    );
    expect(imported.warnings).toContain(
      'OpenCascade could not transfer STEP topology; dimensions were recovered from STEP point coordinates.',
    );
  });

  it('detects high-confidence STEP text fallback circular through holes', async () => {
    const imported = await importStepPcbReference(`
ISO-10303-21;
DATA;
#1=CARTESIAN_POINT('',(0,0,0));
#2=CARTESIAN_POINT('',(80,40,1.6));
#10=CARTESIAN_POINT('',(5,5,0));
#11=CARTESIAN_POINT('',(5,5,1.6));
#12=CARTESIAN_POINT('',(75,35,0));
#13=CARTESIAN_POINT('',(75,35,1.6));
#20=AXIS2_PLACEMENT_3D('',#10,#101,#102);
#21=AXIS2_PLACEMENT_3D('',#11,#101,#102);
#22=AXIS2_PLACEMENT_3D('',#12,#101,#102);
#23=AXIS2_PLACEMENT_3D('',#13,#101,#102);
#30=CIRCLE('',#20,1.5);
#31=CIRCLE('',#21,1.5);
#32=CIRCLE('',#22,1.5);
#33=CIRCLE('',#23,1.5);
ENDSEC;
END-ISO-10303-21;
`);

    expect(imported.pcb.mountingHoles).toEqual([
      { id: 'step-hole-1', x: 5, y: 5, diameter: 3 },
      { id: 'step-hole-2', x: 75, y: 35, diameter: 3 },
    ]);
    expect(imported.warnings).toContain(
      'Detected 2 high-confidence circular through-hole(s) from STEP curve topology.',
    );
  });

  it('ignores STEP text fallback circles that do not span both board faces', async () => {
    const imported = await importStepPcbReference(`
ISO-10303-21;
DATA;
#1=CARTESIAN_POINT('',(0,0,0));
#2=CARTESIAN_POINT('',(80,40,1.6));
#10=CARTESIAN_POINT('',(5,5,0));
#20=AXIS2_PLACEMENT_3D('',#10,#101,#102);
#30=CIRCLE('',#20,1.5);
ENDSEC;
END-ISO-10303-21;
`);

    expect(imported.pcb.mountingHoles).toEqual([]);
  });
});
