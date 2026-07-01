import type { Millimeters } from '../domain';

export type FastenerKind =
  | 'self_tapping_screw'
  | 'machine_screw'
  | 'heat_set_insert'
  | 'magnetic_closure';

export interface FastenerProfile {
  id: string;
  name: string;
  kind: FastenerKind;
  nominalSize: string;
  screwHoleDiameter: Millimeters;
  standoffHoleDiameter: Millimeters;
  standoffDiameter: Millimeters;
  screwBossDiameter: Millimeters;
  recommendedStandoffHeight: Millimeters;
  minimumWallAroundHole: Millimeters;
  insertOuterDiameter?: Millimeters;
  insertDepth?: Millimeters;
  insertLeadInDiameter?: Millimeters;
  insertLeadInDepth?: Millimeters;
  magnetDiameter?: Millimeters;
  magnetDepth?: Millimeters;
  magnetRetentionLip?: Millimeters;
  vendorStyle?: string;
  notes: string;
}

export const builtInFastenerProfiles: FastenerProfile[] = [
  {
    id: 'm2_self_tapping',
    name: 'M2 self-tapping screw',
    kind: 'self_tapping_screw',
    nominalSize: 'M2',
    screwHoleDiameter: 1.7,
    standoffHoleDiameter: 1.7,
    standoffDiameter: 5,
    screwBossDiameter: 5,
    recommendedStandoffHeight: 4,
    minimumWallAroundHole: 0.8,
    notes: 'Small electronics screws for compact boards. Print a calibration coupon for brittle materials.',
  },
  {
    id: 'm2_5_self_tapping',
    name: 'M2.5 self-tapping screw',
    kind: 'self_tapping_screw',
    nominalSize: 'M2.5',
    screwHoleDiameter: 2.2,
    standoffHoleDiameter: 2.2,
    standoffDiameter: 6,
    screwBossDiameter: 6,
    recommendedStandoffHeight: 4,
    minimumWallAroundHole: 0.9,
    notes: 'Balanced default for small PCB enclosures in PLA/PETG.',
  },
  {
    id: 'm3_self_tapping',
    name: 'M3 self-tapping screw',
    kind: 'self_tapping_screw',
    nominalSize: 'M3',
    screwHoleDiameter: 2.6,
    standoffHoleDiameter: 2.6,
    standoffDiameter: 7.2,
    screwBossDiameter: 7.2,
    recommendedStandoffHeight: 5,
    minimumWallAroundHole: 1,
    notes: 'Stronger closure for larger project boxes and repeated service access.',
  },
  {
    id: 'm2_5_machine_screw_clearance',
    name: 'M2.5 machine screw clearance',
    kind: 'machine_screw',
    nominalSize: 'M2.5',
    screwHoleDiameter: 2.8,
    standoffHoleDiameter: 2.8,
    standoffDiameter: 6.6,
    screwBossDiameter: 6.8,
    recommendedStandoffHeight: 4.5,
    minimumWallAroundHole: 0.9,
    vendorStyle: 'Pan-head machine screw with nut or threaded insert',
    notes: 'Clearance-hole profile for M2.5 machine screws. Use matching nuts, threaded inserts, or a tapped metal part for thread engagement.',
  },
  {
    id: 'm3_machine_screw_clearance',
    name: 'M3 machine screw clearance',
    kind: 'machine_screw',
    nominalSize: 'M3',
    screwHoleDiameter: 3.4,
    standoffHoleDiameter: 3.4,
    standoffDiameter: 8,
    screwBossDiameter: 8.2,
    recommendedStandoffHeight: 5,
    minimumWallAroundHole: 1.1,
    vendorStyle: 'Pan-head machine screw with nut or threaded insert',
    notes: 'Clearance-hole profile for M3 machine screws. Use matching nuts, threaded inserts, or a tapped metal part for thread engagement.',
  },
  {
    id: 'm2_5_heat_set_insert',
    name: 'M2.5 heat-set insert',
    kind: 'heat_set_insert',
    nominalSize: 'M2.5',
    screwHoleDiameter: 2.7,
    standoffHoleDiameter: 2.7,
    standoffDiameter: 6.5,
    screwBossDiameter: 6.8,
    recommendedStandoffHeight: 5,
    minimumWallAroundHole: 1,
    insertOuterDiameter: 3.8,
    insertDepth: 4,
    insertLeadInDiameter: 4.2,
    insertLeadInDepth: 0.6,
    vendorStyle: 'Generic short knurled brass insert',
    notes: 'Use insert manufacturer diameter guidance; press inserts into lid bosses after printing. Includes a shallow lead-in relief for easier heat-set alignment.',
  },
  {
    id: 'm3_heat_set_insert',
    name: 'M3 heat-set insert',
    kind: 'heat_set_insert',
    nominalSize: 'M3',
    screwHoleDiameter: 3.2,
    standoffHoleDiameter: 3.2,
    standoffDiameter: 8,
    screwBossDiameter: 8.5,
    recommendedStandoffHeight: 6,
    minimumWallAroundHole: 1.2,
    insertOuterDiameter: 4.6,
    insertDepth: 5,
    insertLeadInDiameter: 5,
    insertLeadInDepth: 0.7,
    vendorStyle: 'Generic M3 knurled brass insert',
    notes: 'Robust threaded closure for larger enclosures; requires enough boss height for the chosen insert. Includes a shallow lead-in relief for easier heat-set alignment.',
  },
  {
    id: 'm2_short_heat_set_insert',
    name: 'M2 short heat-set insert',
    kind: 'heat_set_insert',
    nominalSize: 'M2',
    screwHoleDiameter: 2.2,
    standoffHoleDiameter: 2.2,
    standoffDiameter: 6,
    screwBossDiameter: 6.4,
    recommendedStandoffHeight: 4.2,
    minimumWallAroundHole: 1,
    insertOuterDiameter: 3.2,
    insertDepth: 3,
    insertLeadInDiameter: 3.6,
    insertLeadInDepth: 0.5,
    vendorStyle: 'Short knurled brass insert',
    notes: 'Compact insert preset for small enclosures. Verify insert data sheet and print a coupon before production.',
  },
  {
    id: 'm3_long_heat_set_insert',
    name: 'M3 long heat-set insert',
    kind: 'heat_set_insert',
    nominalSize: 'M3',
    screwHoleDiameter: 3.2,
    standoffHoleDiameter: 3.2,
    standoffDiameter: 9,
    screwBossDiameter: 9.2,
    recommendedStandoffHeight: 8,
    minimumWallAroundHole: 1.3,
    insertOuterDiameter: 4.8,
    insertDepth: 6.5,
    insertLeadInDiameter: 5.25,
    insertLeadInDepth: 0.8,
    vendorStyle: 'Long knurled brass insert',
    notes: 'Longer insert preset for repeated service access. Requires taller bosses and careful heat control.',
  },
  {
    id: 'd6x2_magnet_closure',
    name: '6 x 2 mm magnetic closure',
    kind: 'magnetic_closure',
    nominalSize: 'D6x2',
    screwHoleDiameter: 1.2,
    standoffHoleDiameter: 1.2,
    standoffDiameter: 9,
    screwBossDiameter: 9,
    recommendedStandoffHeight: 3.2,
    minimumWallAroundHole: 1.1,
    magnetDiameter: 6,
    magnetDepth: 2.1,
    magnetRetentionLip: 0.35,
    vendorStyle: 'Round neodymium magnet pair',
    notes: 'Creates blind press-fit magnet pockets at mounting-hole positions. Verify polarity before installing magnets.',
  },
];

export function fastenerProfileById(id: string): FastenerProfile | undefined {
  return builtInFastenerProfiles.find((profile) => profile.id === id);
}
