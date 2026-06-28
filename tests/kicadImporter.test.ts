import { describe, expect, it } from 'vitest';
import { importKiCadPcb, parseSExpression } from '../src/shared/importers';

const rectangularBoard = `
(kicad_pcb
  (version 20240108)
  (generator pcbnew)
  (general (thickness 1.2))
  ; Outline rectangle with comments and quoted layer name.
  (gr_line (start 10 20) (end 70 20) (stroke (width 0.1) (type default)) (layer "Edge.Cuts"))
  (gr_line (start 70 20) (end 70 55) (stroke (width 0.1) (type default)) (layer "Edge.Cuts"))
  (gr_line (start 70 55) (end 10 55) (stroke (width 0.1) (type default)) (layer "Edge.Cuts"))
  (gr_line (start 10 55) (end 10 20) (stroke (width 0.1) (type default)) (layer "Edge.Cuts"))
  (footprint "MountingHole:MountingHole_3.2mm_M3"
    (at 15 25 90)
    (pad "" np_thru_hole circle (at 0 0) (size 6 6) (drill 3.2) (layers "*.Cu" "*.Mask"))
  )
  (footprint "MountingHole:MountingHole_2.7mm"
    (at 65 50)
    (pad "" thru_hole circle (at 0 0) (size 5 5) (drill 2.7) (layers "*.Cu" "*.Mask"))
  )
  (footprint "Connector_USB:USB_C_Receptacle"
    (at 40 20.8 180)
    (property "Height" "3.8mm")
    (pad "A1" smd rect (at 0 0) (size 0.3 1.2) (layers "F.Cu"))
  )
  (footprint "Connector_RJ:RJ45_MagJack"
    (at 69 36 90)
    (model "ethernet-rj45-14mm.step")
  )
)
`;

describe('KiCad PCB importer', () => {
  it('parses a KiCad S-expression root', () => {
    const parsed = parseSExpression('(kicad_pcb (version 20240108) (generator "pcbnew"))');

    expect(Array.isArray(parsed)).toBe(true);
  });

  it('imports board bounds, thickness, and mounting holes from Edge.Cuts and pads', () => {
    const result = importKiCadPcb(rectangularBoard);

    expect(result.pcb.width).toBe(60);
    expect(result.pcb.height).toBe(35);
    expect(result.pcb.thickness).toBe(1.2);
    expect(result.pcb.componentHeight).toBe(14);
    expect(result.pcb.mountingHoles).toEqual([
      { id: 'mh-1', x: 5, y: 5, diameter: 3.2 },
      { id: 'mh-2', x: 55, y: 30, diameter: 2.7 },
    ]);
    expect(result.pcb.connectorCutouts).toEqual([
      { id: 'cutout-usb-c-1', label: 'USB-C', side: 'front', offset: 30, z: 7, width: 10, height: 4 },
      { id: 'cutout-ethernet-2', label: 'Ethernet', side: 'right', offset: 16, z: 10, width: 16, height: 14 },
    ]);
    expect(result.warnings).toEqual([
      'Detected maximum component height hint: 14 mm.',
      'Detected 2 connector cutout candidate(s). Verify placement and clearance.',
    ]);
  });

  it('applies footprint rotation to local pad positions', () => {
    const result = importKiCadPcb(`
      (kicad_pcb
        (gr_rect (start 0 0) (end 40 30) (layer "Edge.Cuts"))
        (footprint "rotated"
          (at 20 10 90)
          (pad "" np_thru_hole circle (at 2 0) (size 5 5) (drill 3) (layers "*.Cu" "*.Mask"))
        )
      )
    `);

    expect(result.pcb.mountingHoles[0]).toEqual({ id: 'mh-1', x: 20, y: 12, diameter: 3 });
    expect(result.pcb.componentHeight).toBe(0);
    expect(result.warnings).toContain('Board thickness was not declared; defaulted to 1.6 mm.');
  });

  it('uses circle edge cuts for round boards', () => {
    const result = importKiCadPcb(`
      (kicad_pcb
        (gr_circle (center 20 20) (end 30 20) (layer "Edge.Cuts"))
      )
    `);

    expect(result.pcb.width).toBe(20);
    expect(result.pcb.height).toBe(20);
  });

  it('rejects files without an Edge.Cuts outline', () => {
    expect(() => importKiCadPcb('(kicad_pcb (version 20240108))')).toThrow('No Edge.Cuts');
  });
});
