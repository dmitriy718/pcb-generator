import qrcode from 'qrcode-generator';
import type { DesignFeature } from '../domain';

export interface DesignFeatureFootprint {
  x: number;
  y: number;
  width: number;
  height: number;
  diameter: number;
  cornerRadius: number;
}

const qrQuietModules = 2;
const qrModuleOverlapRatio = 0.02;

export function designFeatureFootprints(feature: DesignFeature): DesignFeatureFootprint[] {
  if (feature.kind === 'qr_recess' && feature.text.trim()) {
    return qrCodeFootprints(feature);
  }

  return repeatedFeatureFootprints(feature);
}

function repeatedFeatureFootprints(feature: DesignFeature): DesignFeatureFootprint[] {
  const width = feature.shape === 'circle' ? feature.diameter : feature.width;
  const height = feature.shape === 'circle' ? feature.diameter : feature.height;
  const totalWidth = feature.columns * width + (feature.columns - 1) * feature.spacing;
  const totalHeight = feature.rows * height + (feature.rows - 1) * feature.spacing;
  const startX = feature.x - totalWidth / 2 + width / 2;
  const startY = feature.y - totalHeight / 2 + height / 2;
  const footprints: DesignFeatureFootprint[] = [];

  for (let column = 0; column < feature.columns; column += 1) {
    for (let row = 0; row < feature.rows; row += 1) {
      footprints.push({
        x: startX + column * (width + feature.spacing),
        y: startY + row * (height + feature.spacing),
        width,
        height,
        diameter: feature.diameter,
        cornerRadius: feature.cornerRadius,
      });
    }
  }

  return footprints;
}

function qrCodeFootprints(feature: DesignFeature): DesignFeatureFootprint[] {
  const qr = qrcode(0, 'M');
  qr.addData(feature.text.trim(), 'Byte');
  qr.make();

  const moduleCount = qr.getModuleCount();
  const availableSize = Math.min(feature.width, feature.height);
  const moduleSize = availableSize / (moduleCount + qrQuietModules * 2);
  const codeSize = moduleCount * moduleSize;
  const startX = feature.x - codeSize / 2 + moduleSize / 2;
  const startY = feature.y - codeSize / 2 + moduleSize / 2;
  const footprints: DesignFeatureFootprint[] = [];

  const overlap = moduleSize * qrModuleOverlapRatio;

  for (let row = 0; row < moduleCount; row += 1) {
    let column = 0;
    while (column < moduleCount) {
      if (!qr.isDark(row, column)) {
        column += 1;
        continue;
      }
      const runStart = column;
      while (column < moduleCount && qr.isDark(row, column)) {
        column += 1;
      }
      const runLength = column - runStart;
      const centerColumn = runStart + runLength / 2 - 0.5;
      footprints.push({
        x: startX + centerColumn * moduleSize,
        y: startY + row * moduleSize,
        width: runLength * moduleSize + overlap,
        height: moduleSize + overlap,
        diameter: moduleSize + overlap,
        cornerRadius: 0,
      });
    }
  }

  return footprints;
}
