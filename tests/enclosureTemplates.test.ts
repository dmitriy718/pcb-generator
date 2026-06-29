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
});
