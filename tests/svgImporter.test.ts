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

  it('imports board dimensions from a path outline with elliptical corner arcs', () => {
    const result = importSvgPcb(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <path id="board-outline" d="M10 0 H90 A10 10 0 0 1 100 10 V50 A10 10 0 0 1 90 60 H10 A10 10 0 0 1 0 50 V10 A10 10 0 0 1 10 0 Z" />
        <circle class="mounting-hole" cx="10" cy="10" r="1.5" />
      </svg>
    `);

    expect(result.pcb.width).toBe(100);
    expect(result.pcb.height).toBe(60);
    expect(result.pcb.mountingHoles).toEqual([{ id: 'mh-1', x: 10, y: 10, diameter: 3 }]);
  });

  it('imports board dimensions from relative path line commands', () => {
    const result = importSvgPcb(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <path class="edge-cuts" d="m 5 8 h 50 v 20 h -50 z" />
        <circle id="mount-hole-a" cx="10" cy="13" r="1" />
      </svg>
    `);

    expect(result.pcb.width).toBe(50);
    expect(result.pcb.height).toBe(20);
    expect(result.pcb.mountingHoles).toEqual([{ id: 'mount-hole-a', x: 5, y: 5, diameter: 2 }]);
  });

  it('rejects unsupported SVG path curves when no other dimensions are available', () => {
    expect(() => importSvgPcb('<svg><path id="board-outline" d="M0 0 C10 0 10 10 20 10 Z"/></svg>')).toThrow(
      'positive board width and height',
    );
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
