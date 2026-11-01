import { bruteForceBestTrade, mulberry32 } from '../testing/reference.ts';
import {
  buildHourSummaries,
  decodeHourSummaries,
  encodeHourSummaries,
} from './hour-summaries.ts';

describe('buildHourSummaries', () => {
  it('summarizes each hour, the last one shorter', () => {
    // Hours of 3: [4, 2, 2] [5, 7, 7] [3, 3]
    const prices = Int32Array.from([4, 2, 2, 5, 7, 7, 3, 3]);
    const { hourLength, values } = buildHourSummaries(prices, 3);
    expect(hourLength).toBe(3);
    // prettier-ignore
    expect(Array.from(values)).toEqual([
      1, 0, -1, -1, // earliest lowest 1, earliest highest 0, No Profitable Trade
      3, 4, 3, 4, // Best Trade buys at 3 and sells at 4
      6, 6, -1, -1, // flat
    ]);
  });

  it('matches the brute-force reference for every hour', () => {
    const random = mulberry32(4);
    for (let run = 0; run < 2_000; run++) {
      const length = 1 + (random() % 30);
      const distinctPrices = 1 + (random() % 4);
      const hourLength = 1 + (random() % 6);
      const prices = Int32Array.from(
        { length },
        () => 100 + (random() % distinctPrices),
      );

      const { values } = buildHourSummaries(prices, hourLength);

      const expected: number[] = [];
      for (let first = 0; first < length; first += hourLength) {
        const hour = Array.from(prices.subarray(first, first + hourLength));
        const last = first + hour.length - 1;
        const trade = bruteForceBestTrade(prices, first, last);
        expected.push(
          first + hour.indexOf(Math.min(...hour)),
          first + hour.indexOf(Math.max(...hour)),
          trade?.buy ?? -1,
          trade?.sell ?? -1,
        );
      }
      expect({ prices, hourLength, values: Array.from(values) }).toEqual({
        prices,
        hourLength,
        values: expected,
      });
    }
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects the hour length %s', (length) => {
    expect(() => buildHourSummaries(Int32Array.from([1, 2]), length)).toThrow(
      RangeError,
    );
  });
});

describe('summaries file', () => {
  it('is Int32 little-endian, 4 values per hour', () => {
    const summaries = {
      hourLength: 3600,
      values: Int32Array.from([1, 0x0102_0304, -1, -1]),
    };
    expect(Array.from(encodeHourSummaries(summaries))).toEqual([
      1, 0, 0, 0, 4, 3, 2, 1, 255, 255, 255, 255, 255, 255, 255, 255,
    ]);
  });

  it('reads back what it writes', () => {
    const prices = Int32Array.from([4, 2, 2, 5, 7, 7, 3, 3]);
    const summaries = buildHourSummaries(prices, 3);
    expect(decodeHourSummaries(encodeHourSummaries(summaries), 3)).toEqual(
      summaries,
    );
  });

  it('reads a file that does not start at the beginning of its buffer', () => {
    // fs.readFileSync can return a Buffer sliced out of a larger pool.
    const bytes = encodeHourSummaries({
      hourLength: 2,
      values: Int32Array.from([0, 1, 0, 1]),
    });
    const pool = new Uint8Array(3 + bytes.length);
    pool.set(bytes, 3);
    expect(Array.from(decodeHourSummaries(pool.subarray(3), 2).values)).toEqual(
      [0, 1, 0, 1],
    );
  });

  it('rejects a file that is not a whole number of hours', () => {
    expect(() => decodeHourSummaries(new Uint8Array(20), 3600)).toThrow(
      RangeError,
    );
  });
});
