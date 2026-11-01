import { buildHourSummaries } from '@simple-stock-history/best-trade';
import { readFile, rm, truncate, writeFile } from 'node:fs/promises';
import type { PriceHistoryFixture } from '../../testing/price-history-fixture.interface';
import {
  FIXTURE_DATA_PERIOD_START,
  FIXTURE_HOUR_LENGTH,
  FIXTURE_PRICES,
  writePriceHistoryFixture,
} from '../../testing/price-history-fixture';
import {
  loadPriceHistory,
  PriceHistoryLoadError,
  priceHistoryFilePaths,
} from './load-price-history';

/** Flips one bit in the middle of a file, keeping its length. */
async function corrupt(path: string): Promise<void> {
  const bytes = await readFile(path);
  bytes[bytes.length >> 1] ^= 0x01;
  await writeFile(path, bytes);
}

async function editMeta(
  fixture: PriceHistoryFixture,
  change: Record<string, unknown>,
): Promise<void> {
  await writeFile(
    fixture.paths.meta,
    JSON.stringify({ ...fixture.meta, ...change }),
  );
}

describe('priceHistoryFilePaths', () => {
  it('finds the hour summaries and meta next to the Price History, with the same base name', () => {
    expect(priceHistoryFilePaths('/app/data/acme-2025-11.bin')).toEqual({
      priceHistory: '/app/data/acme-2025-11.bin',
      hourSummaries: '/app/data/acme-2025-11.hours.bin',
      meta: '/app/data/acme-2025-11.meta.json',
    });
  });

  it('only swaps the final .bin', () => {
    expect(priceHistoryFilePaths('data.bin/acme.bin')).toMatchObject({
      hourSummaries: 'data.bin/acme.hours.bin',
      meta: 'data.bin/acme.meta.json',
    });
  });

  it('rejects a Price History path that does not end in .bin', () => {
    expect(() => priceHistoryFilePaths('data/acme.dat')).toThrow(
      new PriceHistoryLoadError(
        'The Price History file must end in .bin, got "data/acme.dat"',
      ),
    );
  });
});

describe('loadPriceHistory', () => {
  let fixture: PriceHistoryFixture;

  beforeEach(async () => {
    fixture = await writePriceHistoryFixture();
  });

  afterEach(async () => {
    await fixture.remove();
  });

  const load = () => loadPriceHistory(fixture.paths.priceHistory);

  describe('with valid files', () => {
    it('reads every Price Point, in cents', async () => {
      const { prices } = await load();

      expect(prices).toBeInstanceOf(Int32Array);
      expect(Array.from(prices)).toEqual(Array.from(FIXTURE_PRICES));
    });

    it('reads the hour summaries as the generator wrote them', async () => {
      const { hourSummaries } = await load();

      expect(hourSummaries.hourLength).toBe(FIXTURE_HOUR_LENGTH);
      expect(Array.from(hourSummaries.values)).toEqual(
        Array.from(
          buildHourSummaries(FIXTURE_PRICES, FIXTURE_HOUR_LENGTH).values,
        ),
      );
    });

    it('derives the Data Period from the meta, both ends included', async () => {
      const { dataPeriod } = await load();

      expect(dataPeriod).toEqual({
        from: FIXTURE_DATA_PERIOD_START,
        to: FIXTURE_DATA_PERIOD_START + FIXTURE_PRICES.length - 1,
      });
    });

    it('reads negative and extreme Int32 values little-endian', async () => {
      await fixture.remove();
      const prices = Int32Array.from([-1, 2147483647, -2147483648, 256, 1]);
      fixture = await writePriceHistoryFixture({ prices, hourLength: 2 });

      expect(Array.from((await load()).prices)).toEqual(Array.from(prices));
    });

    it('accepts hours that divide the Data Period evenly', async () => {
      await fixture.remove();
      fixture = await writePriceHistoryFixture({
        prices: FIXTURE_PRICES.slice(0, 8),
        hourLength: 4,
      });

      expect((await load()).hourSummaries.values).toHaveLength(2 * 4);
    });
  });

  describe('fails with the file and the reason', () => {
    it('when the Price History is missing', async () => {
      await rm(fixture.paths.priceHistory);

      await expect(load()).rejects.toThrow(PriceHistoryLoadError);
      await expect(load()).rejects.toThrow(
        `Cannot read the Price History file "${fixture.paths.priceHistory}": ENOENT`,
      );
    });

    it('when the Price History is truncated', async () => {
      await truncate(fixture.paths.priceHistory, 4 * 10 + 2);

      await expect(load()).rejects.toThrow(
        `The Price History file "${fixture.paths.priceHistory}" is 42 bytes, ` +
          'but the meta calls for 44 (11 Price Points of 4 bytes): it is ' +
          'truncated or does not belong to this meta',
      );
    });

    it('when the Price History is longer than the meta says', async () => {
      await editMeta(fixture, { count: 10 });

      await expect(load()).rejects.toThrow(
        'is 44 bytes, but the meta calls for 40 (10 Price Points of 4 bytes)',
      );
    });

    it('when the Price History is corrupt', async () => {
      await corrupt(fixture.paths.priceHistory);

      await expect(load()).rejects.toThrow(
        new RegExp(
          `^The Price History file "${fixture.paths.priceHistory}" is corrupt: ` +
            `its sha256 is [0-9a-f]{64}, the meta expects ${fixture.meta['sha256']}$`,
        ),
      );
    });

    it('when the hour summaries are missing', async () => {
      await rm(fixture.paths.hourSummaries);

      await expect(load()).rejects.toThrow(
        `Cannot read the hour summaries file "${fixture.paths.hourSummaries}": ENOENT`,
      );
    });

    it('when the hour summaries are truncated', async () => {
      await truncate(fixture.paths.hourSummaries, 16 * 2 + 5);

      await expect(load()).rejects.toThrow(
        `The hour summaries file "${fixture.paths.hourSummaries}" is 37 bytes, ` +
          'but the meta calls for 48 (3 hours of 16 bytes: 11 Price Points / ' +
          'hour length 4, rounded up): it is truncated or does not belong to this meta',
      );
    });

    it('when the hour summaries hold another number of hours than count / hourLength', async () => {
      // The file and its sha256 are intact, but were built for 2 s hours.
      await fixture.remove();
      fixture = await writePriceHistoryFixture({ hourLength: 2 });
      await editMeta(fixture, { hourLength: 4 });

      await expect(load()).rejects.toThrow(
        'is 96 bytes, but the meta calls for 48 (3 hours of 16 bytes: 11 Price Points / hour length 4, rounded up)',
      );
    });

    it('when the hour summaries are corrupt', async () => {
      await corrupt(fixture.paths.hourSummaries);

      await expect(load()).rejects.toThrow(
        new RegExp(
          `^The hour summaries file "${fixture.paths.hourSummaries}" is corrupt: ` +
            `its sha256 is [0-9a-f]{64}, the meta expects ${fixture.meta['hourSummariesSha256']}$`,
        ),
      );
    });

    it('when the meta is missing', async () => {
      await rm(fixture.paths.meta);

      await expect(load()).rejects.toThrow(
        `Cannot read the meta file "${fixture.paths.meta}": ENOENT`,
      );
    });

    it('when the meta is not JSON', async () => {
      await truncate(fixture.paths.meta, 20);

      await expect(load()).rejects.toThrow(
        `The meta file "${fixture.paths.meta}" is not valid JSON: `,
      );
    });

    it('when the meta lacks a field or has a wrong one, listing each', async () => {
      await editMeta(fixture, {
        count: 0,
        hourLength: 1.5,
        sha256: 'ABC',
        hourSummariesSha256: undefined,
      });

      await expect(load()).rejects.toThrow(
        `The meta file "${fixture.paths.meta}" is invalid: ` +
          'count: Too small: expected number to be >0; ' +
          'sha256: must be a sha256 in lowercase hex; ' +
          'hourLength: Invalid input: expected int, received number; ' +
          'hourSummariesSha256: Invalid input: expected string, received undefined',
      );
    });

    it('when the meta is not an object', async () => {
      await writeFile(fixture.paths.meta, '[]');

      await expect(load()).rejects.toThrow(
        `The meta file "${fixture.paths.meta}" is invalid: (root): Invalid input: expected object, received array`,
      );
    });
  });
});
