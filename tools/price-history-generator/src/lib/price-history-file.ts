import { createHash } from 'node:crypto';
import type { PriceHistoryConfig } from './price-history-config.interface.ts';
import type { PriceHistoryFile } from './price-history-file.interface.ts';
import { generatePriceHistory } from './price-walk.ts';

/**
 * Generates the Price History a config describes and encodes it as the `.bin`
 * file plus its meta. Does not compare the result with `config.sha256`.
 */
export function generatePriceHistoryFile(
  config: PriceHistoryConfig,
  generatorVersion: string,
): PriceHistoryFile {
  const bytes = encodePriceHistory(generatePriceHistory(config));
  return {
    bytes,
    meta: {
      dataPeriodStart: config.dataPeriodStart,
      count: config.count,
      seed: config.seed,
      generatorVersion,
      sha256: createHash('sha256').update(bytes).digest('hex'),
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
