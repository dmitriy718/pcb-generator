import { describe, expect, it } from 'vitest';
import { importDxfPcb } from '../src/shared/importers';

describe('importDxfPcb', () => {
  it('imports a millimeter LWPOLYLINE outline and circular mounting holes', () => {
    const result = importDxfPcb(`
0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
Edge.Cuts
70
1
10
0
20
0
10
85
20
0
10
85
20
56
10
0
20
56
0
CIRCLE
8
MountingHoles
10
5
20
5
40
1.6
0
CIRCLE
8
MountingHoles
10
80
20
51
40
1.6
0
ENDSEC
0
EOF
`);

    expect(result.pcb.width).toBe(85);
    expect(result.pcb.height).toBe(56);
    expect(result.pcb.thickness).toBe(1.6);
    expect(result.pcb.mountingHoles).toEqual([
      { id: 'mh-1', x: 5, y: 5, diameter: 3.2 },
      { id: 'mh-2', x: 80, y: 51, diameter: 3.2 },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('scales inch DXF units to millimeters', () => {
    const result = importDxfPcb(`
9
$INSUNITS
70
1
0
LINE
8
outline
10
0
20
0
11
2
21
0
0
LINE
8
outline
10
2
20
0
11
2
21
1
0
LINE
8
outline
10
2
20
1
11
0
21
1
0
LINE
8
outline
10
0
20
1
11
0
21
0
`);

    expect(result.pcb.width).toBe(50.8);
    expect(result.pcb.height).toBe(25.4);
  });

  it('throws when no outline geometry is present', () => {
    expect(() => importDxfPcb('0\nCIRCLE\n8\nholes\n10\n1\n20\n1\n40\n0.5\n')).toThrow(
      'no LINE or LWPOLYLINE',
    );
  });
});
