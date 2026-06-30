import { describe, expect, it } from 'vitest';
import { generateTwoPieceScrewCaseKernelMesh } from '../src/shared/cad/kernel/openCascadeBackend';
import { analyzeMeshTopology, validateMesh } from '../src/shared/cad/meshValidation';
import { enclosureTemplateById, enclosureTemplates } from '../src/shared/enclosureTemplates';
import { defaultProject, validateProject } from '../src/shared/domain';
import { builtInFastenerProfiles } from '../src/shared/fasteners';

describe('enclosureTemplates', () => {
  it('has unique ids and resolves templates by id', () => {
    const ids = enclosureTemplates.map((template) => template.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(enclosureTemplateById('rounded-handheld')?.name).toBe('Rounded handheld');
  });

  it('exposes family and production-path metadata for the GUI selector', () => {
    for (const template of enclosureTemplates) {
      expect(template.family, template.id).toMatch(/\S/);
      expect(template.closure, template.id).toMatch(/\S/);
      expect(template.productionStatus, template.id).toBe('validated_two_piece_generator');
    }
  });

  it('applies every template as a valid two-piece screw case parameter patch', () => {
    for (const template of enclosureTemplates) {
      const project = {
        ...defaultProject,
        enclosure: template.apply(defaultProject),
      };

      expect(project.enclosure.type, template.id).toBe('two_piece_screw_case');
      expect(validateProject(project).issues, template.id).toEqual([]);
    }
  });

  it('keeps every template valid on compact and large common board sizes', () => {
    const boardVariants = [
      {
        name: 'compact',
        pcb: {
          ...defaultProject.pcb,
          width: 36,
          height: 24,
          mountingHoles: [
            { id: 'mh-1', x: 4, y: 4, diameter: 3 },
            { id: 'mh-2', x: 32, y: 4, diameter: 3 },
            { id: 'mh-3', x: 4, y: 20, diameter: 3 },
            { id: 'mh-4', x: 32, y: 20, diameter: 3 },
          ],
          connectorCutouts: [
            {
              id: 'cutout-usb-c',
              label: 'USB-C',
              side: 'front' as const,
              offset: 18,
              z: 7,
              width: 10,
              height: 4,
            },
          ],
        },
        ventilationRegions: [
          {
            id: 'vent-lid-compact',
            label: 'Compact lid vents',
            x: 24,
            y: 12,
            width: 12,
            height: 6,
            slotWidth: 2,
            slotHeight: 4,
            spacing: 2,
          },
        ],
      },
      {
        name: 'large',
        pcb: {
          ...defaultProject.pcb,
          width: 100,
          height: 70,
          mountingHoles: [
            { id: 'mh-1', x: 5, y: 5, diameter: 3 },
            { id: 'mh-2', x: 95, y: 5, diameter: 3 },
            { id: 'mh-3', x: 5, y: 65, diameter: 3 },
            { id: 'mh-4', x: 95, y: 65, diameter: 3 },
          ],
          connectorCutouts: [
            {
              id: 'cutout-usb-c',
              label: 'USB-C',
              side: 'front' as const,
              offset: 50,
              z: 7,
              width: 10,
              height: 4,
            },
          ],
        },
        ventilationRegions: defaultProject.enclosure.ventilationRegions,
      },
    ];

    for (const variant of boardVariants) {
      for (const template of enclosureTemplates) {
        const baseProject = {
          ...defaultProject,
          pcb: variant.pcb,
          enclosure: {
            ...defaultProject.enclosure,
            ventilationRegions: variant.ventilationRegions,
          },
        };
        const project = {
          ...baseProject,
          enclosure: template.apply(baseProject),
        };

        expect(validateProject(project).issues, `${template.id} ${variant.name}`).toEqual([]);
      }
    }
  });

  it('raises tall component clearance from PCB component height', () => {
    const project = structuredClone(defaultProject);
    project.pcb.componentHeight = 20;

    const template = enclosureTemplateById('tall-component-clearance');
    expect(template?.apply(project).baseInternalHeight).toBeGreaterThan(25);
  });

  it('adds editable wall-mount through holes to the wall-mount template', () => {
    const template = enclosureTemplateById('wall-mount-starter');
    const enclosure = template?.apply(defaultProject);

    expect(enclosure?.designFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'template-wall-mount-1',
          label: 'Wall mount hole 1',
          shape: 'circle',
          operation: 'through_cut',
        }),
        expect.objectContaining({
          id: 'template-wall-mount-2',
          label: 'Wall mount hole 2',
          shape: 'circle',
          operation: 'through_cut',
        }),
      ]),
    );
  });

  it('adds editable label and cable-slot features to the desktop project-box template', () => {
    const template = enclosureTemplateById('desktop-project-box');
    const enclosure = template?.apply(defaultProject);

    expect(enclosure?.designFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'template-desktop-label-recess',
          label: 'Desktop label recess',
          kind: 'label_recess',
          operation: 'recess',
        }),
        expect.objectContaining({
          id: 'template-desktop-cable-slot',
          label: 'Rear cable slot',
          kind: 'cable_slot',
          operation: 'through_cut',
        }),
      ]),
    );
  });

  it('adds editable battery tray and cable-exit features to the battery access template', () => {
    const template = enclosureTemplateById('battery-access-case');
    const enclosure = template?.apply(defaultProject);

    expect(enclosure?.designFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'template-battery-tray-recess',
          label: 'Battery tray recess',
          kind: 'battery_tray',
          operation: 'recess',
        }),
        expect.objectContaining({
          id: 'template-battery-cable-exit',
          label: 'Battery cable exit',
          kind: 'cable_slot',
          operation: 'through_cut',
        }),
      ]),
    );
  });

  it('adds editable lanyard and status-light openings to the portable handheld template', () => {
    const template = enclosureTemplateById('portable-handheld');
    const enclosure = template?.apply(defaultProject);

    expect(enclosure?.designFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'template-handheld-lanyard-hole',
          label: 'Lanyard hole',
          kind: 'antenna_hole',
          shape: 'circle',
          operation: 'through_cut',
        }),
        expect.objectContaining({
          id: 'template-handheld-status-light',
          label: 'Status light opening',
          kind: 'button_opening',
          shape: 'circle',
          operation: 'through_cut',
        }),
      ]),
    );
  });

  it('preserves unrelated user features with template-like id prefixes', () => {
    const template = enclosureTemplateById('portable-handheld');
    const project = structuredClone(defaultProject);
    project.enclosure.ventilationRegions = [];
    project.enclosure.designFeatures = [
      {
        id: 'template-handheld-user-extra',
        label: 'User serial text',
        kind: 'text_engraving',
        shape: 'rectangle',
        operation: 'recess',
        x: 24,
        y: 14,
        width: 10,
        height: 4,
        diameter: 4,
        depth: 0.25,
        cornerRadius: 0,
        spacing: 2,
        rows: 1,
        columns: 1,
        text: 'U1',
      },
    ];

    const enclosure = template?.apply(project);

    expect(enclosure?.designFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'template-handheld-user-extra',
          label: 'User serial text',
        }),
      ]),
    );
  });

  it('keeps portable handheld generated openings clear across built-in fastener profiles', () => {
    const template = enclosureTemplateById('portable-handheld');
    if (!template) {
      throw new Error('Expected portable handheld template.');
    }

    for (const profile of builtInFastenerProfiles) {
      const baseProject = {
        ...defaultProject,
        enclosure: {
          ...defaultProject.enclosure,
          fastenerProfileId: profile.id,
          standoffDiameter: profile.standoffDiameter,
          standoffHoleDiameter: profile.standoffHoleDiameter,
          standoffHeight: profile.recommendedStandoffHeight,
          screwBossDiameter: profile.screwBossDiameter,
          screwHoleDiameter: profile.screwHoleDiameter,
        },
      };
      const project = {
        ...baseProject,
        enclosure: template.apply(baseProject),
      };

      expect(validateProject(project).issues, profile.id).toEqual([]);
    }
  });

  it('generates validated OpenCascade geometry for the rounded handheld fillet template', async () => {
    const template = enclosureTemplateById('rounded-handheld');
    if (!template) {
      throw new Error('Expected rounded handheld template.');
    }
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: template.apply(defaultProject),
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 30_000);

  it('generates validated OpenCascade geometry for the wall-mount through-hole template', async () => {
    const template = enclosureTemplateById('wall-mount-starter');
    if (!template) {
      throw new Error('Expected wall-mount template.');
    }
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: template.apply(defaultProject),
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 30_000);

  it('generates validated OpenCascade geometry for the desktop project-box feature template', async () => {
    const template = enclosureTemplateById('desktop-project-box');
    if (!template) {
      throw new Error('Expected desktop project-box template.');
    }
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: template.apply(defaultProject),
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 30_000);

  it('generates validated OpenCascade geometry for the portable handheld feature template', async () => {
    const template = enclosureTemplateById('portable-handheld');
    if (!template) {
      throw new Error('Expected portable handheld template.');
    }
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: template.apply(defaultProject),
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 30_000);

  it('generates validated OpenCascade geometry for the battery access template', async () => {
    const template = enclosureTemplateById('battery-access-case');
    if (!template) {
      throw new Error('Expected battery access template.');
    }
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...defaultProject,
      enclosure: template.apply(defaultProject),
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 30_000);

  it('generates validated OpenCascade geometry for portable handheld with large heat-set inserts', async () => {
    const template = enclosureTemplateById('portable-handheld');
    const profile = builtInFastenerProfiles.find((candidate) => candidate.id === 'm3_long_heat_set_insert');
    if (!template || !profile) {
      throw new Error('Expected portable handheld template and M3 long heat-set insert profile.');
    }
    const project = {
      ...defaultProject,
      enclosure: {
        ...defaultProject.enclosure,
        fastenerProfileId: profile.id,
        standoffDiameter: profile.standoffDiameter,
        standoffHoleDiameter: profile.standoffHoleDiameter,
        standoffHeight: profile.recommendedStandoffHeight,
        screwBossDiameter: profile.screwBossDiameter,
        screwHoleDiameter: profile.screwHoleDiameter,
      },
    };
    const mesh = await generateTwoPieceScrewCaseKernelMesh({
      ...project,
      enclosure: template.apply(project),
    });
    const topology = analyzeMeshTopology(mesh);

    expect(validateMesh(mesh, { checkTopology: true })).toEqual({ ok: true, issues: [] });
    expect(topology.isClosed).toBe(true);
    expect(topology.isEdgeManifold).toBe(true);
  }, 30_000);
});
