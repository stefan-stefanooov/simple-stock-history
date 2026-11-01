import { bruteForceBestTrade, mulberry32 } from '../testing/reference.ts';
import { createBestTradeSearch } from './best-trade-search.ts';
import {
  buildHourSummaries,
  decodeHourSummaries,
  encodeHourSummaries,
} from './hour-summaries.ts';

function searchOver(prices: number[], hourLength: number) {
  const priceHistory = Int32Array.from(prices);
  return createBestTradeSearch(
    priceHistory,
    buildHourSummaries(priceHistory, hourLength),
  );
}

describe('createBestTradeSearch', () => {
  // Hour lengths 1–3 put hour boundaries inside the Time Slice, so the result
  // depends on joining hours; one hour covering the whole series does not.
  const cases: {
    name: string;
    prices: number[];
    first?: number;
    last?: number;
    expected: { buy: number; sell: number } | null;
  }[] = [
    {
      name: 'picks the earliest Sell Point on a Profit tie with the same Buy Point',
      prices: [1, 3, 5, 1, 5],
      expected: { buy: 0, sell: 2 },
    },
    {
      name: 'picks the earliest Buy Point on a Profit tie',
      prices: [1, 5, 1, 5],
      expected: { buy: 0, sell: 1 },
    },
    {
      name: 'finds No Profitable Trade in a flat Price History',
      prices: [7, 7, 7, 7, 7],
      expected: null,
    },
    {
      name: 'finds No Profitable Trade in a falling Price History',
      prices: [9, 8, 6, 6, 3, 1],
      expected: null,
    },
    {
      name: 'finds the Best Trade in a two-point Time Slice',
      prices: [9, 2, 4, 1, 8],
      first: 1,
      last: 2,
      expected: { buy: 1, sell: 2 },
    },
    {
      name: 'finds No Profitable Trade in a falling two-point Time Slice',
      prices: [9, 2, 4, 1, 8],
      first: 2,
      last: 3,
      expected: null,
    },
  ];

  describe.each(cases)('$name', ({ prices, first, last, expected }) => {
    const hourLengths = [
      { label: 'hours of 1', hourLength: 1 },
      { label: 'hours of 2', hourLength: 2 },
      { label: 'hours of 3', hourLength: 3 },
      {
        label: 'one hour covering the whole series',
        hourLength: prices.length,
      },
    ];

    it.each(hourLengths)('$label', ({ hourLength }) => {
      const search = searchOver(prices, hourLength);
      expect(search.find(first ?? 0, last ?? prices.length - 1)).toEqual(
        expected,
      );
    });
  });

  it('finds No Profitable Trade in a one-second Time Slice', () => {
    expect(searchOver([1, 5, 9], 1).find(1, 1)).toBeNull();
  });

  it('joins a Buy Point and a Sell Point that are several hours apart', () => {
    // Hours of 2: [9, 2] [5, 4] [6, 3] [8, 1]. The Time Slice 1…6 starts in
    // the last Price Point of hour 0 and ends in the first of hour 3.
    const search = searchOver([9, 2, 5, 4, 6, 3, 8, 1], 2);
    expect(search.find(1, 6)).toEqual({ buy: 1, sell: 6 });
    expect(search.find(2, 7)).toEqual({ buy: 5, sell: 6 });
  });

  it('works on summaries read back from the summaries file', () => {
    const prices = Int32Array.from([5, 4, 6, 3, 7, 5, 2, 9]);
    const bytes = encodeHourSummaries(buildHourSummaries(prices, 3));
    const search = createBestTradeSearch(prices, decodeHourSummaries(bytes, 3));
    expect(search.find(0, 7)).toEqual({ buy: 6, sell: 7 });
  });

  it.each([
    { first: -1, last: 2 },
    { first: 0, last: 8 },
    { first: 3, last: 2 },
    { first: 0.5, last: 2 },
    { first: 0, last: Number.NaN },
  ])('rejects the Time Slice $first…$last', ({ first, last }) => {
    const search = searchOver([5, 4, 6, 3, 7, 5, 2, 9], 2);
    expect(() => search.find(first, last)).toThrow(RangeError);
  });

  it('rejects hour summaries that do not cover the Price History', () => {
    const prices = Int32Array.from([5, 4, 6, 3, 7, 5, 2, 9]);
    const summaries = buildHourSummaries(prices, 3);
    expect(() =>
      createBestTradeSearch(prices, { ...summaries, hourLength: 2 }),
    ).toThrow(RangeError);
    expect(() =>
      createBestTradeSearch(prices.subarray(0, 3), summaries),
    ).toThrow(RangeError);
  });

  it('matches the brute-force reference on random Time Slices', () => {
    // Short series over few distinct prices produce many Profit ties, and
    // hours of 1–6 put hour boundaries all through them.
    const random = mulberry32(21);
    for (let run = 0; run < 20_000; run++) {
      const length = 2 + (random() % 40);
      const distinctPrices = 1 + (random() % 4);
      const hourLength = 1 + (random() % 6);
      const prices = Array.from(
        { length },
        () => 100 + (random() % distinctPrices),
      );
      const first = random() % length;
      const last = first + (random() % (length - first));

      const actual = searchOver(prices, hourLength).find(first, last);
      const expected = bruteForceBestTrade(prices, first, last);
      if (!isEqual(actual, expected)) {
        // Report the failing case itself rather than a bare mismatch.
        expect({ prices, hourLength, first, last, actual }).toEqual({
          prices,
          hourLength,
          first,
          last,
          actual: expected,
        });
      }
    }
  });
});

function isEqual(
  a: { buy: number; sell: number } | null,
  b: { buy: number; sell: number } | null,
): boolean {
  return a === null || b === null
    ? a === b
    : a.buy === b.buy && a.sell === b.sell;
}
