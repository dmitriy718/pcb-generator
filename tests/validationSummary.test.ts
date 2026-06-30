import { describe, expect, it } from 'vitest';
import { summarizeValidationIssues } from '../src/shared/domain';

describe('summarizeValidationIssues', () => {
  it('groups repeated validation messages and preserves affected paths', () => {
    const summaries = summarizeValidationIssues([
      {
        code: 'design_feature_overlaps_feature',
        path: 'enclosure.designFeatures.5',
        message: 'Fan grill overlaps Battery tray. Move or resize one design feature.',
      },
      {
        code: 'design_feature_overlaps_feature',
        path: 'enclosure.designFeatures.7',
        message: 'Fan grill overlaps Battery tray. Move or resize one design feature.',
      },
      {
        code: 'design_feature_overlaps_feature',
        path: 'enclosure.designFeatures.7',
        message: 'Fan grill overlaps Battery tray. Move or resize one design feature.',
      },
      {
        code: 'design_feature_overlaps_feature',
        path: 'enclosure.designFeatures.6',
        message: 'Text engraving overlaps Fan grill. Move or resize one design feature.',
      },
    ]);

    expect(summaries).toEqual([
      {
        code: 'design_feature_overlaps_feature',
        message: 'Fan grill overlaps Battery tray. Move or resize one design feature.',
        paths: ['enclosure.designFeatures.5', 'enclosure.designFeatures.7'],
        count: 3,
      },
      {
        code: 'design_feature_overlaps_feature',
        message: 'Text engraving overlaps Fan grill. Move or resize one design feature.',
        paths: ['enclosure.designFeatures.6'],
        count: 1,
      },
    ]);
  });
});
