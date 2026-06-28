import { describe, expect, it } from 'vitest';
import { designFeatureFootprints } from '../src/shared/cad/designFeatureGeometry';
import type { DesignFeature } from '../src/shared/domain';

describe('designFeatureFootprints', () => {
  it('turns text engraving values into bounded vector-module footprints', () => {
    const feature = textFeature('A1');

    const footprints = designFeatureFootprints(feature);

    expect(footprints.length).toBeGreaterThan(10);
    expect(footprints.some((footprint) => footprint.width > footprint.height)).toBe(true);
    expect(footprints.every((footprint) => footprint.width > 0 && footprint.height > 0)).toBe(true);
    expect(Math.min(...footprints.map((footprint) => footprint.x))).toBeGreaterThan(feature.x - feature.width / 2);
    expect(Math.max(...footprints.map((footprint) => footprint.x))).toBeLessThan(feature.x + feature.width / 2);
    expect(Math.min(...footprints.map((footprint) => footprint.y))).toBeGreaterThan(feature.y - feature.height / 2);
    expect(Math.max(...footprints.map((footprint) => footprint.y))).toBeLessThan(feature.y + feature.height / 2);
  });

  it('turns QR feature text into module-run footprints', () => {
    const feature = qrFeature('PCB-001');

    const footprints = designFeatureFootprints(feature);

    expect(footprints.length).toBeGreaterThan(20);
    expect(footprints.some((footprint) => footprint.width > footprint.height)).toBe(true);
    expect(footprints.every((footprint) => footprint.width > 0 && footprint.height > 0)).toBe(true);
    expect(Math.min(...footprints.map((footprint) => footprint.x))).toBeGreaterThan(feature.x - feature.width / 2);
    expect(Math.max(...footprints.map((footprint) => footprint.x))).toBeLessThan(feature.x + feature.width / 2);
    expect(Math.min(...footprints.map((footprint) => footprint.y))).toBeGreaterThan(feature.y - feature.height / 2);
    expect(Math.max(...footprints.map((footprint) => footprint.y))).toBeLessThan(feature.y + feature.height / 2);
  });

  it('falls back to a single editable footprint for an empty QR feature', () => {
    const footprints = designFeatureFootprints(qrFeature(''));

    expect(footprints).toEqual([
      {
        x: 30,
        y: 18,
        width: 16,
        height: 16,
        diameter: 16,
        cornerRadius: 0,
      },
    ]);
  });
});

function qrFeature(text: string): DesignFeature {
  return {
    id: 'feature-qr',
    label: 'QR recess',
    kind: 'qr_recess',
    shape: 'rectangle',
    operation: 'recess',
    x: 30,
    y: 18,
    width: 16,
    height: 16,
    diameter: 16,
    depth: 0.4,
    cornerRadius: 0,
    spacing: 2,
    rows: 1,
    columns: 1,
    text,
  };
}

function textFeature(text: string): DesignFeature {
  return {
    id: 'feature-text',
    label: 'Text engraving',
    kind: 'text_engraving',
    shape: 'rectangle',
    operation: 'recess',
    x: 30,
    y: 18,
    width: 18,
    height: 6,
    diameter: 6,
    depth: 0.35,
    cornerRadius: 0,
    spacing: 2,
    rows: 1,
    columns: 1,
    text,
  };
}
