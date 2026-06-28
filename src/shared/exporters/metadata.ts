import type { ManufacturingMetadata } from '../domain';

export function exportMakerWorldMetadata(metadata: ManufacturingMetadata): string {
  return `${JSON.stringify(
    {
      title: metadata.makerWorld.title,
      summary: metadata.makerWorld.summary,
      tags: metadata.makerWorld.tags,
      material: metadata.material.name,
      recommendedLayerHeightMm: metadata.layerHeight,
      recommendedInfillPercent: metadata.infillPercent,
      supportRequired: metadata.supportRequired,
      printOrientation: metadata.printOrientation,
      estimatedFilamentGrams: metadata.estimatedFilamentGrams,
      estimatedPrintMinutes: metadata.estimatedPrintMinutes,
      bambuProfileHint: metadata.material.bambuProfileHint,
      assemblyInstructions: metadata.assemblyInstructions,
      layout: metadata.layout,
      printability: metadata.printability,
    },
    null,
    2,
  )}\n`;
}
