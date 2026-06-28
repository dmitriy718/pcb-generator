import { describe, expect, it } from 'vitest';
import { importSvgPcb } from '../src/shared/importers';

describe('SVG PCB importer', () => {
  it('imports board dimensions from an SVG viewBox and mounting-hole circles', () => {
    const result = importSvgPcb(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 60 35">
        <rect id="board-outline" x="10" y="20" width="60" height="35" />
        <circle id="mount-hole-1" cx="15" cy="25" r="1.5" />
        <circle class="mounting-hole" cx="65" cy="50" r="1.5" />
        <circle id="led" cx="30" cy="30" r="1" />
      </svg>
    `);

    expect(result.pcb.width).toBe(60);
    expect(result.pcb.height).toBe(35);
    expect(result.pcb.thickness).toBe(1.6);
    expect(result.pcb.connectorCutouts).toEqual([]);
    expect(result.pcb.mountingHoles).toEqual([
      { id: 'mount-hole-1', x: 5, y: 5, diameter: 3 },
      { id: 'mh-2', x: 55, y: 30, diameter: 3 },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('imports board dimensions from width and height attributes when no viewBox exists', () => {
    const result = importSvgPcb('<svg width="85mm" height="56mm"><circle class="hole" cx="4" cy="4" r="1.5"/></svg>');

    expect(result.pcb.width).toBe(85);
    expect(result.pcb.height).toBe(56);
    expect(result.pcb.mountingHoles[0]).toEqual({ id: 'mh-1', x: 4, y: 4, diameter: 3 });
    expect(result.warnings).toContain(
      'No rectangular outline or viewBox was found; dimensions were inferred from SVG width and height.',
    );
  });

  it('converts inch dimensions to millimeters', () => {
    const result = importSvgPcb('<svg width="2in" height="1in"></svg>');

    expect(result.pcb.width).toBe(50.8);
    expect(result.pcb.height).toBe(25.4);
  });

  it('rejects non-SVG input', () => {
    expect(() => importSvgPcb('<html></html>')).toThrow('root <svg>');
  });

  it('rejects SVGs without positive dimensions', () => {
    expect(() => importSvgPcb('<svg><circle class="hole" cx="1" cy="1" r="1"/></svg>')).toThrow(
      'positive board width and height',
    );
  });
});
