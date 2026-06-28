import { describe, expect, it } from 'vitest';
import { designFeatureFootprints } from '../src/shared/cad/designFeatureGeometry';
import { importSvgLogoFootprints } from '../src/shared/importers';
import type { DesignFeature } from '../src/shared/domain';
import { parseProjectFile, serializeProjectFile } from '../src/shared/projectFiles';
import { defaultProject } from '../src/shared/domain';

describe('SVG logo importer', () => {
  it('imports SVG rect and circle primitives as normalized logo footprints', () => {
    const result = importSvgLogoFootprints(`
      <svg viewBox="0 0 100 50">
        <rect x="10" y="10" width="30" height="10" rx="2" />
        <circle cx="70" cy="25" r="10" />
      </svg>
    `);

    expect(result.warnings).toEqual([]);
    expect(result.footprints).toHaveLength(2);
    expect(result.footprints[0]).toEqual({
      xRatio: 0.25,
      yRatio: 0.3,
      widthRatio: 0.3,
      heightRatio: 0.2,
      cornerRadiusRatio: 0.2,
    });
    expect(result.footprints[1]).toEqual({
      xRatio: 0.7,
      yRatio: 0.5,
      widthRatio: 0.2,
      heightRatio: 0.4,
      cornerRadiusRatio: 0.5,
    });
  });

  it('uses imported logo footprints in generated design feature geometry', () => {
    const feature: DesignFeature = {
      id: 'feature-logo',
      label: 'Imported logo',
      kind: 'logo_badge',
      shape: 'rounded_rectangle',
      operation: 'emboss',
      x: 50,
      y: 30,
      width: 20,
      height: 10,
      diameter: 10,
      depth: 0.8,
      cornerRadius: 1,
      spacing: 3,
      rows: 1,
      columns: 1,
      text: 'Imported',
      customFootprints: [
        { xRatio: 0.25, yRatio: 0.5, widthRatio: 0.5, heightRatio: 0.4, cornerRadiusRatio: 0.25 },
      ],
    };

    expect(designFeatureFootprints(feature)).toEqual([
      {
        x: 45,
        y: 30,
        width: 10,
        height: 4,
        diameter: 4,
        cornerRadius: 1,
      },
    ]);
  });

  it('round-trips imported logo footprints through project files', () => {
    const project = structuredClone(defaultProject);
    project.enclosure.ventilationRegions = [];
    project.enclosure.designFeatures = [
      {
        id: 'feature-logo',
        label: 'Imported logo',
        kind: 'logo_badge',
        shape: 'rounded_rectangle',
        operation: 'emboss',
        x: 30,
        y: 20,
        width: 16,
        height: 10,
        diameter: 10,
        depth: 0.8,
        cornerRadius: 1,
        spacing: 3,
        rows: 1,
        columns: 1,
        text: 'Imported',
        customFootprints: [
          { xRatio: 0.5, yRatio: 0.5, widthRatio: 0.4, heightRatio: 0.4, cornerRadiusRatio: 0.1 },
        ],
      },
    ];

    const parsed = parseProjectFile(serializeProjectFile(project));

    expect(parsed.enclosure.designFeatures[0]?.customFootprints).toEqual([
      { xRatio: 0.5, yRatio: 0.5, widthRatio: 0.4, heightRatio: 0.4, cornerRadiusRatio: 0.1 },
    ]);
  });

  it('rejects unsupported SVG logo inputs', () => {
    expect(() => importSvgLogoFootprints('<html></html>')).toThrow('root <svg>');
    expect(() => importSvgLogoFootprints('<svg><path d="M0 0L1 1Z"/></svg>')).toThrow(
      'rect and circle',
    );
  });
});
