import { describe, expect, it } from 'vitest';
import { exportTwoPieceScrewCaseStep } from '../src/shared/cad/kernel/openCascadeBackend';
import { defaultProject } from '../src/shared/domain';

describe('OpenCascade backend', () => {
  it('exports a validated STEP model for the default two-piece case shell', async () => {
    const step = await exportTwoPieceScrewCaseStep(defaultProject);

    expect(step.startsWith('ISO-10303-21;')).toBe(true);
    expect(step).toContain('FILE_SCHEMA');
    expect(step).toContain('MANIFOLD_SOLID_BREP');
    expect(step.length).toBeGreaterThan(10_000);
  });
});
