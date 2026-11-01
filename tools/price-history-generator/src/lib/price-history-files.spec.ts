import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  buildHourSummaries,
  encodeHourSummaries,
  HOUR_LENGTH,
} from '@simple-stock-history/best-trade';
import { DEFAULT_CONFIG_PATH } from './cli.ts';
import { parsePriceHistoryConfig } from './price-history-config.ts';
import {
  encodePriceHistory,
  generatePriceHistoryFiles,
} from './price-history-files.ts';
import { generatePriceHistory } from './price-walk.ts';

function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

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

describe('generatePriceHistoryFiles', () => {
  const config = {
    seed: 42,
    dataPeriodStart: 1_761_955_200,
    count: 20,
    startPriceCents: 10_000,
    maxStepCents: 5,
    floorPriceCents: 100,
    sha256: '0'.repeat(64),
    hourLength: 6,
    hourSummariesSha256: '0'.repeat(64),
  };

  it('encodes the Price History the walk generates, 4 bytes per Price Point', () => {
    const { priceHistory } = generatePriceHistoryFiles(config, '1.2.3');
    const view = new DataView(priceHistory.buffer);
    const prices = Array.from({ length: config.count }, (_, i) =>
      view.getInt32(i * 4, true),
    );
    // The pinned first Price Points for seed 42 (see price-walk.spec.ts).
    expect(prices).toEqual([
      10000, 9996, 9998, 9998, 9999, 10001, 9997, 9992, 9992, 9990, 9994, 9989,
      9989, 9993, 9995, 9992, 9996, 9991, 9996, 9998,
    ]);
    expect(priceHistory).toHaveLength(config.count * 4);
  });

  // ADR-0002: one copy of the summary logic, in libs/best-trade.
  it('writes the hour summaries libs/best-trade builds for the config’s hour length', () => {
    const { hourSummaries } = generatePriceHistoryFiles(config, '1.2.3');
    expect(hourSummaries).toEqual(
      encodeHourSummaries(
        buildHourSummaries(generatePriceHistory(config), config.hourLength),
      ),
    );
    // 4 hours (the last one 2 Price Points long), 4 Int32 values each.
    expect(hourSummaries).toHaveLength(4 * 4 * 4);
  });

  it('describes both files in the meta, with the sha256 values they actually have', () => {
    const { priceHistory, hourSummaries, meta } = generatePriceHistoryFiles(
      config,
      '1.2.3',
    );
    expect(meta).toEqual({
      dataPeriodStart: 1_761_955_200,
      count: 20,
      seed: 42,
      generatorVersion: '1.2.3',
      sha256: sha256Of(priceHistory),
      hourLength: 6,
      hourSummariesSha256: sha256Of(hourSummaries),
    });
  });

  // ADR-0001 and ADR-0002: the committed config pins the Price History and its
  // hour summaries. If this fails, the walk, the encoding or libs/best-trade
  // changed; the generate target fails the same way.
  it('reproduces both sha256 values pinned in the committed config', () => {
    const committed = parsePriceHistoryConfig(
      JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8')),
    );
    const { meta } = generatePriceHistoryFiles(committed, 'test');
    expect(meta.hourLength).toBe(HOUR_LENGTH);
    expect(meta.sha256).toBe(committed.sha256);
    expect(meta.hourSummariesSha256).toBe(committed.hourSummariesSha256);
  });
});
