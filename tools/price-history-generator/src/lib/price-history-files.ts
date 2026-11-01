import { createHash } from 'node:crypto';
import {
  buildHourSummaries,
  encodeHourSummaries,
} from '@simple-stock-history/best-trade';
import type { PriceHistoryConfig } from './price-history-config.interface.ts';
import type { PriceHistoryFiles } from './price-history-files.interface.ts';
import { generatePriceHistory } from './price-walk.ts';

/**
 * Generates the Price History a config describes, summarizes it into hours of
 * `config.hourLength` Price Points with `libs/best-trade` (ADR-0002), and
 * encodes both files plus their meta. Does not compare the results with the
 * config's pinned sha256 values.
 */
export function generatePriceHistoryFiles(
  config: PriceHistoryConfig,
  generatorVersion: string,
): PriceHistoryFiles {
  const prices = generatePriceHistory(config);
  const priceHistory = encodePriceHistory(prices);
  const hourSummaries = encodeHourSummaries(
    buildHourSummaries(prices, config.hourLength),
  );
  return {
    priceHistory,
    hourSummaries,
    meta: {
      dataPeriodStart: config.dataPeriodStart,
      count: config.count,
      seed: config.seed,
      generatorVersion,
      sha256: sha256Of(priceHistory),
      hourLength: config.hourLength,
      hourSummariesSha256: sha256Of(hourSummaries),
    },
  };
}

/**
 * Encodes prices as consecutive Int32 little-endian values, 4 bytes per Price
 * Point, whatever the byte order of the machine running the generator.
 */
export function encodePriceHistory(prices: Int32Array): Uint8Array {
  const bytes = new Uint8Array(prices.length * Int32Array.BYTES_PER_ELEMENT);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < prices.length; i++) {
    view.setInt32(i * Int32Array.BYTES_PER_ELEMENT, prices[i], true);
  }
  return bytes;
}

function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
