import { describe, expect, it } from 'vitest';
import { applyDesignPrompt } from '../src/shared/assistant';
import { defaultProject, validateProject } from '../src/shared/domain';

describe('applyDesignPrompt', () => {
  it('converts a natural language prompt into editable project parameters', () => {
    const result = applyDesignPrompt(
      defaultProject,
      'Make a handheld PETG enclosure with rounded corners, USB-C on the left, OLED on the front, speaker holes, ventilation, and logo.',
    );

    expect(result.warnings).toEqual([]);
    expect(result.applied).toEqual(
      expect.arrayContaining([
        'Material set to PETG',
        'Rounded handheld ergonomics',
        'USB-C cutout on left',
        'OLED display opening',
        'Speaker grill',
        'Existing ventilation retained',
        'Logo badge',
      ]),
    );
    expect(result.project.enclosure.material).toBe('petg');
    expect(result.project.enclosure.cornerRadius).toBeGreaterThanOrEqual(8);
    expect(result.project.pcb.connectorCutouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'USB-C',
          side: 'left',
        }),
      ]),
    );
    expect(result.project.enclosure.designFeatures.map((feature) => feature.kind)).toEqual(
      expect.arrayContaining(['display_opening', 'speaker_grill', 'logo_badge']),
    );
    expect(result.project.enclosure.ventilationRegions).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Lid vents' })]),
    );
    expect(validateProject(result.project).issues).toEqual([]);
    expect(validateProject(result.project).ok).toBe(true);
  });

  it('returns actionable warnings for empty or unsupported prompts', () => {
    expect(applyDesignPrompt(defaultProject, '').warnings).toContain(
      'Enter a design prompt before applying assistant changes.',
    );
    expect(applyDesignPrompt(defaultProject, 'make it excellent').warnings[0]).toContain(
      'No supported design phrases',
    );
  });
});
