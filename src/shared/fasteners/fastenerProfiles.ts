import type { Millimeters } from '../domain';

export type FastenerKind = 'self_tapping_screw' | 'machine_screw' | 'heat_set_insert';

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
    notes: 'Use insert manufacturer diameter guidance; press inserts into lid bosses after printing.',
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
    notes: 'Robust threaded closure for larger enclosures; requires enough boss height for the chosen insert.',
  },
];

export function fastenerProfileById(id: string): FastenerProfile | undefined {
  return builtInFastenerProfiles.find((profile) => profile.id === id);
}
