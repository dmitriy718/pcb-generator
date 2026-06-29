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

  it('includes LWPOLYLINE bulge arcs when measuring rounded board outlines', () => {
    const result = importDxfPcb(`
0
LWPOLYLINE
8
Edge.Cuts
70
1
10
10
20
0
10
90
20
0
42
0.41421356237309503
10
100
20
10
10
100
20
50
42
0.41421356237309503
10
90
20
60
10
10
20
60
42
0.41421356237309503
10
0
20
50
10
0
20
10
42
0.41421356237309503
0
CIRCLE
8
MountingHoles
10
10
20
10
40
1.5
`);

    expect(result.pcb.width).toBe(100);
    expect(result.pcb.height).toBe(60);
    expect(result.pcb.mountingHoles).toEqual([{ id: 'mh-1', x: 10, y: 10, diameter: 3 }]);
  });

  it('uses ARC outline entities when computing board bounds', () => {
    const result = importDxfPcb(`
0
LINE
8
Edge.Cuts
10
-10
20
0
11
10
21
0
0
ARC
8
Edge.Cuts
10
0
20
0
40
10
50
0
51
180
`);

    expect(result.pcb.width).toBe(20);
    expect(result.pcb.height).toBe(10);
  });

  it('evaluates SPLINE knot and control-point data before measuring bounds', () => {
    const result = importDxfPcb(`
0
SPLINE
8
Edge.Cuts
70
8
71
2
72
6
73
3
40
0
40
0
40
0
40
1
40
1
40
1
10
0
20
0
10
50
20
50
10
100
20
0
0
CIRCLE
8
MountingHoles
10
5
20
5
40
1.5
`);

    expect(result.pcb.width).toBe(100);
    expect(result.pcb.height).toBe(25);
    expect(result.pcb.mountingHoles).toEqual([{ id: 'mh-1', x: 5, y: 5, diameter: 3 }]);
    expect(result.warnings).not.toContain(
      'At least one DXF outline spline was measured from control/fit point bounds; verify dimensions before production.',
    );
  });

  it('uses SPLINE control-point bounds with a production verification warning', () => {
    const result = importDxfPcb(`
0
SPLINE
8
Edge.Cuts
10
0
20
0
10
60
20
0
10
60
20
40
10
0
20
40
0
CIRCLE
8
MountingHoles
10
5
20
5
40
1.5
`);

    expect(result.pcb.width).toBe(60);
    expect(result.pcb.height).toBe(40);
    expect(result.pcb.mountingHoles).toEqual([{ id: 'mh-1', x: 5, y: 5, diameter: 3 }]);
    expect(result.warnings).toContain(
      'At least one DXF outline spline was measured from control/fit point bounds; verify dimensions before production.',
    );
  });

  it('falls back to SPLINE fit-point bounds when control points are absent', () => {
    const result = importDxfPcb(`
0
SPLINE
8
outline
11
-5
21
-2
11
45
21
-2
11
45
21
18
11
-5
21
18
`);

    expect(result.pcb.width).toBe(50);
    expect(result.pcb.height).toBe(20);
    expect(result.warnings).toContain(
      'At least one DXF outline spline was measured from control/fit point bounds; verify dimensions before production.',
    );
  });

  it('throws when no outline geometry is present', () => {
    expect(() => importDxfPcb('0\nCIRCLE\n8\nholes\n10\n1\n20\n1\n40\n0.5\n')).toThrow(
      'no LINE, LWPOLYLINE, ARC, or SPLINE',
    );
  });
});
