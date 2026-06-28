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
const textModuleOverlapRatio = 0.04;
const logoModuleOverlapRatio = 0.04;
const glyphWidth = 5;
const glyphHeight = 7;
const glyphSpacing = 1;
const unknownGlyph = ['11110', '00001', '00001', '00110', '00100', '00000', '00100'] as const;

export function designFeatureFootprints(feature: DesignFeature): DesignFeatureFootprint[] {
  if (feature.kind === 'qr_recess' && feature.text.trim()) {
    return qrCodeFootprints(feature);
  }
  if (feature.kind === 'text_engraving' && feature.text.trim()) {
    return textFootprints(feature);
  }
  if (feature.kind === 'logo_badge') {
    return logoFootprints(feature);
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

function logoFootprints(feature: DesignFeature): DesignFeatureFootprint[] {
  if (feature.customFootprints && feature.customFootprints.length > 0) {
    return feature.customFootprints.map((footprint) => {
      const width = feature.width * footprint.widthRatio;
      const height = feature.height * footprint.heightRatio;
      return {
        x: feature.x - feature.width / 2 + feature.width * footprint.xRatio,
        y: feature.y - feature.height / 2 + feature.height * footprint.yRatio,
        width,
        height,
        diameter: Math.min(width, height),
        cornerRadius: Math.min(width, height) * Math.min(footprint.cornerRadiusRatio, 0.25),
      };
    });
  }
  const key = feature.text.trim().toUpperCase() || 'OSHW';
  const logo = logoPatterns[key] ?? defaultLogoPattern;
  return modulePatternFootprints(feature, logo);
}

function modulePatternFootprints(feature: DesignFeature, pattern: readonly string[]): DesignFeatureFootprint[] {
  const rowCount = pattern.length;
  const columnCount = Math.max(...pattern.map((row) => row.length));
  const moduleSize = Math.min(feature.width / columnCount, feature.height / rowCount);
  const patternWidth = columnCount * moduleSize;
  const patternHeight = rowCount * moduleSize;
  const startX = feature.x - patternWidth / 2 + moduleSize / 2;
  const startY = feature.y - patternHeight / 2 + moduleSize / 2;
  const overlap = moduleSize * logoModuleOverlapRatio;
  const footprints: DesignFeatureFootprint[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    const rowBits = pattern[row] ?? '';
    let column = 0;
    while (column < columnCount) {
      if (rowBits[column] !== '1') {
        column += 1;
        continue;
      }
      const runStart = column;
      while (column < columnCount && rowBits[column] === '1') {
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

const defaultLogoPattern = [
  '1110011101110',
  '1001010011001',
  '1001010001001',
  '1110011101110',
  '1000010001001',
  '1000010011001',
  '1000011101110',
] as const;

const logoPatterns: Record<string, readonly string[]> = {
  OSHW: [
    '00001110000',
    '00111111100',
    '01100100110',
    '11010101011',
    '11100100111',
    '01110001110',
    '00111011100',
    '00010101000',
    '00100100100',
    '01000000010',
    '00000000000',
  ],
  PCB: defaultLogoPattern,
  RF: [
    '111101111',
    '100101000',
    '100101000',
    '111001110',
    '101001000',
    '100101000',
    '100101000',
  ],
  BAMBU: [
    '111011101101101101',
    '100010101101101101',
    '100010101111101101',
    '111011101101101101',
    '100010101101101101',
    '100010101101101101',
    '111010101101011010',
  ],
};

function textFootprints(feature: DesignFeature): DesignFeatureFootprint[] {
  const characters = Array.from(feature.text.toUpperCase().replace(/[^\x20-\x7E]/gu, '?')).slice(0, 32);
  const totalColumns = characters.length * glyphWidth + Math.max(0, characters.length - 1) * glyphSpacing;
  const moduleSize = Math.min(feature.width / Math.max(totalColumns, 1), feature.height / glyphHeight);
  const textWidth = totalColumns * moduleSize;
  const textHeight = glyphHeight * moduleSize;
  const startX = feature.x - textWidth / 2 + moduleSize / 2;
  const startY = feature.y - textHeight / 2 + moduleSize / 2;
  const overlap = moduleSize * textModuleOverlapRatio;
  const footprints: DesignFeatureFootprint[] = [];

  for (const [characterIndex, character] of characters.entries()) {
    const glyph = glyphRows(character);
    const glyphOffsetX = characterIndex * (glyphWidth + glyphSpacing) * moduleSize;
    for (let row = 0; row < glyphHeight; row += 1) {
      const rowBits = glyph[row] ?? '00000';
      let column = 0;
      while (column < glyphWidth) {
        if (rowBits[column] !== '1') {
          column += 1;
          continue;
        }
        const runStart = column;
        while (column < glyphWidth && rowBits[column] === '1') {
          column += 1;
        }
        const runLength = column - runStart;
        const centerColumn = runStart + runLength / 2 - 0.5;
        footprints.push({
          x: startX + glyphOffsetX + centerColumn * moduleSize,
          y: startY + row * moduleSize,
          width: runLength * moduleSize + overlap,
          height: moduleSize + overlap,
          diameter: moduleSize + overlap,
          cornerRadius: 0,
        });
      }
    }
  }

  return footprints;
}

function glyphRows(character: string): readonly string[] {
  return glyphs[character] ?? unknownGlyph;
}

const glyphs: Record<string, readonly string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '/': ['00001', '00010', '00100', '01000', '10000', '00000', '00000'],
  '?': unknownGlyph,
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
};

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
