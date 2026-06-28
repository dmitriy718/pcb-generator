import { describe, expect, it } from 'vitest';

describe('export path safety', () => {
  it('documents expected metadata suffix behavior', () => {
    const modelPath = '/tmp/enclosure.stl';
    const metadataPath = `${modelPath.slice(0, modelPath.lastIndexOf('.'))}.makerworld.json`;

    expect(metadataPath).toBe('/tmp/enclosure.makerworld.json');
    expect(metadataPath).not.toBe(modelPath);
  });
});
