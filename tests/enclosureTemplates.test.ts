import { describe, expect, it } from 'vitest';
import { generateTwoPieceScrewCaseKernelMesh } from '../src/shared/cad/kernel/openCascadeBackend';
import { analyzeMeshTopology, validateMesh } from '../src/shared/cad/meshValidation';
import { enclosureTemplateById, enclosureTemplates } from '../src/shared/enclosureTemplates';
import { defaultProject, validateProject } from '../src/shared/domain';

describe('enclosureTemplates', () => {
  it('has unique ids and resolves templates by id', () => {
    const ids = enclosureTemplates.map((template) => template.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(enclosureTemplateById('rounded-handheld')?.name).toBe('Rounded handheld');
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
});
