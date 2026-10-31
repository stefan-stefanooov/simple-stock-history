import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG_PATH } from './cli.ts';
import { parsePriceHistoryConfig } from './price-history-config.ts';
import {
  encodePriceHistory,
  generatePriceHistoryFile,
} from './price-history-file.ts';

describe('encodePriceHistory', () => {
  it('writes each Price Point as an Int32 little-endian value', () => {
    const bytes = encodePriceHistory(Int32Array.of(10_000, 1, -2, 0x0102_0304));
    expect(Buffer.from(bytes).toString('hex')).toBe(
      [
        '10270000', // 10000 = 0x2710
        '01000000',
        'feffffff', // -2, two's complement
        '04030201',
      ].join(''),
    );
  });
});

describe('generatePriceHistoryFile', () => {
  const config = {
    seed: 42,
    dataPeriodStart: 1_761_955_200,
    count: 20,
    startPriceCents: 10_000,
    maxStepCents: 5,
    floorPriceCents: 100,
    sha256: '0'.repeat(64),
  };

  it('encodes the Price History the walk generates, 4 bytes per Price Point', () => {
    const { bytes } = generatePriceHistoryFile(config, '1.2.3');
    const view = new DataView(bytes.buffer);
    const prices = Array.from({ length: config.count }, (_, i) =>
      view.getInt32(i * 4, true),
    );
    // The pinned first Price Points for seed 42 (see price-walk.spec.ts).
    expect(prices).toEqual([
      10000, 9996, 9998, 9998, 9999, 10001, 9997, 9992, 9992, 9990, 9994, 9989,
      9989, 9993, 9995, 9992, 9996, 9991, 9996, 9998,
    ]);
    expect(bytes).toHaveLength(config.count * 4);
  });

  it('describes the file in its meta, with the sha256 it actually has', () => {
    const { bytes, meta } = generatePriceHistoryFile(config, '1.2.3');
    expect(meta).toEqual({
      dataPeriodStart: 1_761_955_200,
      count: 20,
      seed: 42,
      generatorVersion: '1.2.3',
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  });

  // ADR-0001: the committed config pins the Price History. If this fails, the
  // walk or the encoding changed; the generate target fails the same way.
  it('reproduces the sha256 pinned in the committed config', () => {
    const committed = parsePriceHistoryConfig(
      JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8')),
    );
    const { meta } = generatePriceHistoryFile(committed, 'test');
    expect(meta.sha256).toBe(committed.sha256);
  });
});
