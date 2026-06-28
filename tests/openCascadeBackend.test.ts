import { describe, expect, it } from 'vitest';
import {
  exportTwoPieceScrewCaseStep,
  generateTwoPieceScrewCaseKernelMesh,
} from '../src/shared/cad/kernel/openCascadeBackend';
import { analyzeMeshTopology, validateMesh } from '../src/shared/cad/meshValidation';
import { defaultProject } from '../src/shared/domain';

describe('OpenCascade backend', () => {
  it('exports a validated STEP model for the default two-piece case shell', async () => {
    const step = await exportTwoPieceScrewCaseStep(defaultProject);

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
});
