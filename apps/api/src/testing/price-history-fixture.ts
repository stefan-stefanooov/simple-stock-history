import {
  buildHourSummaries,
  encodeHourSummaries,
} from '@simple-stock-history/best-trade';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { priceHistoryFilePaths } from '../app/price-history/load-price-history';
import type { PriceHistoryFixtureOptions } from './price-history-fixture-options.interface';
import type { PriceHistoryFixture } from './price-history-fixture.interface';

/** 2025-11-01T00:00:00Z, the real Data Period's first second. */
export const FIXTURE_DATA_PERIOD_START = 1761955200;

/**
 * 11 Price Points. Its Best Trade buys at position 1 (99.95) and sells at
 * position 4 (100.10).
 */
export const FIXTURE_PRICES = Int32Array.from([
  10000, 9995, 10000, 10005, 10010, 10005, 10000, 9995, 9990, 9995, 10000,
]);

/** 4 s hours: 11 Price Points make 3 hours, the last one 3 s long. */
export const FIXTURE_HOUR_LENGTH = 4;

/**
 * Writes a Price History, its hour summaries and its meta the way the
 * generator does, into a new temporary directory. Tests corrupt or truncate
 * the files afterwards to check how the API reacts.
 */
export async function writePriceHistoryFixture(
  options: PriceHistoryFixtureOptions = {},
): Promise<PriceHistoryFixture> {
  const prices = options.prices ?? FIXTURE_PRICES;
  const hourLength = options.hourLength ?? FIXTURE_HOUR_LENGTH;
  const dataPeriodStart = options.dataPeriodStart ?? FIXTURE_DATA_PERIOD_START;

  const dir = await mkdtemp(join(tmpdir(), 'price-history-'));
  const paths = priceHistoryFilePaths(join(dir, 'acme-test.bin'));
  const priceHistory = encodePrices(prices);
  const hourSummaries = encodeHourSummaries(
    buildHourSummaries(prices, hourLength),
  );
  const meta = {
    dataPeriodStart,
    count: prices.length,
    seed: 1,
    generatorVersion: '0.0.0-test',
    sha256: sha256Of(priceHistory),
    hourLength,
    hourSummariesSha256: sha256Of(hourSummaries),
  };

  await writeFile(paths.priceHistory, priceHistory);
  await writeFile(paths.hourSummaries, hourSummaries);
  await writeFile(paths.meta, `${JSON.stringify(meta, null, 2)}\n`);

  return {
    paths,
    prices,
    hourLength,
    dataPeriodStart,
    meta,
    remove: () => rm(dir, { recursive: true, force: true }),
  };
}

/** Int32 little-endian, 4 bytes per Price Point, like the generator. */
export function encodePrices(prices: Int32Array): Uint8Array {
  const bytes = new Uint8Array(prices.length * Int32Array.BYTES_PER_ELEMENT);
  const view = new DataView(bytes.buffer);
  prices.forEach((price, i) =>
    view.setInt32(i * Int32Array.BYTES_PER_ELEMENT, price, true),
  );
  return bytes;
}

export function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
