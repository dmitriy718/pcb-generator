import type { EnclosureProject } from '../domain';
import { getMaterialProfile } from '../domain';
import { fastenerProfileById } from '../fasteners';

export interface BomItem {
  item: string;
  category: 'printed_part' | 'hardware' | 'material' | 'process';
  quantity: number;
  unit: string;
  specification: string;
  notes: string;
}

export function buildBillOfMaterials(project: EnclosureProject): BomItem[] {
  const material = getMaterialProfile(project.enclosure.material);
  const fastener = fastenerProfileById(project.enclosure.fastenerProfileId);
  if (!fastener) {
    throw new Error(`Unknown fastener profile: ${project.enclosure.fastenerProfileId}`);
  }

  const screwCount = Math.max(project.pcb.mountingHoles.length, 0);
  const items: BomItem[] = [
    {
      item: 'Base enclosure',
      category: 'printed_part',
      quantity: 1,
      unit: 'part',
      specification: `${material.name}, ${project.enclosure.wallThickness} mm nominal wall`,
      notes: 'Print open-side up using the generated model orientation.',
    },
    {
      item: 'Lid',
      category: 'printed_part',
      quantity: 1,
      unit: 'part',
      specification: `${material.name}, ${project.enclosure.lidThickness} mm lid thickness`,
      notes: 'Print outer face on build plate with screw bosses upward.',
    },
    {
      item: 'Primary filament',
      category: 'material',
      quantity: 1,
      unit: 'spool',
      specification: material.name,
      notes: material.bambuProfileHint,
    },
    {
      item: fastener.name,
      category: 'hardware',
      quantity: screwCount,
      unit: 'piece',
      specification: `${fastener.nominalSize}, ${fastener.kind.replaceAll('_', ' ')}`,
      notes: fastener.notes,
    },
  ];

  if (fastener.kind === 'heat_set_insert') {
    items.push({
      item: `${fastener.nominalSize} heat-set inserts`,
      category: 'hardware',
      quantity: screwCount,
      unit: 'piece',
      specification: `${fastener.insertOuterDiameter} mm socket x ${fastener.insertDepth} mm depth, ${fastener.insertLeadInDiameter ?? fastener.insertOuterDiameter} mm lead-in x ${fastener.insertLeadInDepth ?? 0} mm, ${fastener.screwHoleDiameter} mm through clearance`,
      notes: 'Verify insert manufacturer drill and boss recommendations before production.',
    });
  }

  if (project.pcb.connectorCutouts.length > 0) {
    items.push({
      item: 'Connector opening finishing',
      category: 'process',
      quantity: project.pcb.connectorCutouts.length,
      unit: 'opening',
      specification: project.pcb.connectorCutouts.map((cutout) => cutout.label).join(', '),
      notes: 'Deburr and test connector clearance before installing the PCB.',
    });
  }

  return items;
}

export function exportBomCsv(project: EnclosureProject): string {
  const rows = buildBillOfMaterials(project);
  const header = ['Item', 'Category', 'Quantity', 'Unit', 'Specification', 'Notes'];
  return `${[
    header,
    ...rows.map((row) => [
      row.item,
      row.category,
      String(row.quantity),
      row.unit,
      row.specification,
      row.notes,
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')}\n`;
}

function csvCell(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
