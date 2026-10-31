import { isDeepStrictEqual } from 'node:util';
import { mulberry32 } from './mulberry32.js';
import {
  createStepDraw,
  generatePriceHistory,
  type PriceWalkOptions,
} from './price-walk.js';

// The walk agreed in #2 and #12: start at $100.00, ±5¢ steps, floor at $1.00.
const AGREED_WALK = {
  startPriceCents: 10_000,
  maxStepCents: 5,
  floorPriceCents: 100,
} as const;
// One Price Point per second of the Data Period (November 2025, UTC).
const DATA_PERIOD_SECONDS = 2_592_000;

function walk(options: Partial<PriceWalkOptions> = {}): number[] {
  return Array.from(
    generatePriceHistory({
      seed: 42,
      count: 20,
      ...AGREED_WALK,
      ...options,
    }),
  );
}

function lowestPrice(prices: ArrayLike<number>): number {
  let lowest = prices[0];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] < lowest) lowest = prices[i];
  }
  return lowest;
}

function largestMove(prices: ArrayLike<number>): number {
  let largest = 0;
  for (let i = 1; i < prices.length; i++) {
    largest = Math.max(largest, Math.abs(prices[i] - prices[i - 1]));
  }
  return largest;
}

describe('generatePriceHistory', () => {
  it('gives the same Price History for the same seed', () => {
    const options = { seed: 42, count: DATA_PERIOD_SECONDS, ...AGREED_WALK };
    const first = generatePriceHistory(options);
    const second = generatePriceHistory(options);
    // Vitest's toEqual is too slow for 2.6M values; this compares them exactly.
    expect(isDeepStrictEqual(first, second)).toBe(true);
  });

  it('gives a different Price History for a different seed', () => {
    expect(walk({ seed: 43, count: 1000 })).not.toEqual(
      walk({ seed: 42, count: 1000 }),
    );
  });

  it('has one value per Price Point, starting at the start price', () => {
    const prices = walk({ count: 1000 });
    expect(prices).toHaveLength(1000);
    expect(prices[0]).toBe(AGREED_WALK.startPriceCents);
  });

  // Derived independently from the reference float-returning mulberry32, so a
  // change to the PRNG, the step draw or the walk shows up here.
  it('matches the pinned first Price Points for seed 42', () => {
    expect(walk({ seed: 42, count: 20 })).toEqual([
      10000, 9996, 9998, 9998, 9999, 10001, 9997, 9992, 9992, 9990, 9994, 9989,
      9989, 9993, 9995, 9992, 9996, 9991, 9996, 9998,
    ]);
  });

  it('matches the pinned first Price Points when starting at the floor', () => {
    // Same steps as above; the first one (−4) would reach 96¢ and is reflected.
    expect(walk({ seed: 42, count: 20, startPriceCents: 100 })).toEqual([
      100, 104, 106, 106, 107, 109, 105, 100, 100, 102, 106, 101, 101, 105, 107,
      104, 108, 103, 108, 110,
    ]);
  });

  it('moves by up to the max step between Price Points, never more', () => {
    const prices = generatePriceHistory({
      seed: 42,
      count: DATA_PERIOD_SECONDS,
      ...AGREED_WALK,
    });
    expect(largestMove(prices)).toBe(AGREED_WALK.maxStepCents);
  });

  it('reflects exactly the steps that would fall below the floor', () => {
    const count = 10_000;
    const prices = walk({ seed: 7, count, startPriceCents: 100 });
    const drawStep = createStepDraw(mulberry32(7), AGREED_WALK.maxStepCents);
    let reflections = 0;
    for (let i = 1; i < count; i++) {
      const step = drawStep();
      const reflected = prices[i - 1] + step < AGREED_WALK.floorPriceCents;
      if (reflected) reflections++;
      expect(prices[i]).toBe(prices[i - 1] + (reflected ? -step : step));
    }
    expect(reflections).toBeGreaterThan(0);
  });

  it('never breaches the floor over the whole Data Period', () => {
    const prices = generatePriceHistory({
      seed: 42,
      count: DATA_PERIOD_SECONDS,
      ...AGREED_WALK,
    });
    expect(lowestPrice(prices)).toBeGreaterThanOrEqual(
      AGREED_WALK.floorPriceCents,
    );
  });

  it('never breaches the floor when the walk starts on it', () => {
    for (let seed = 0; seed < 100; seed++) {
      const prices = walk({ seed, count: 10_000, startPriceCents: 100 });
      expect(lowestPrice(prices)).toBeGreaterThanOrEqual(
        AGREED_WALK.floorPriceCents,
      );
    }
  });

  it.each<[string, Partial<PriceWalkOptions>]>([
    ['a seed that is not an unsigned 32-bit integer', { seed: -1 }],
    ['zero Price Points', { count: 0 }],
    ['a fractional start price', { startPriceCents: 100.5 }],
    ['a start price below the floor', { startPriceCents: 99 }],
    ['a negative max step', { maxStepCents: -1 }],
    [
      'prices that could overflow 32 bits',
      { startPriceCents: 0x7fff_fff0, count: 10 },
    ],
  ])('rejects %s', (_, options) => {
    expect(() => walk(options)).toThrow(RangeError);
  });
});

describe('createStepDraw', () => {
  it('draws every step from −max to +max equally often', () => {
    const drawStep = createStepDraw(mulberry32(42), 5);
    const counts = new Map<number, number>();
    for (let i = 0; i < 110_000; i++) {
      const step = drawStep();
      counts.set(step, (counts.get(step) ?? 0) + 1);
    }
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([
      -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5,
    ]);
    for (const n of counts.values()) {
      // 10,000 expected each; the spread allowed is over 5 standard deviations.
      expect(n).toBeGreaterThan(9_500);
      expect(n).toBeLessThan(10_500);
    }
  });

  it('redraws values from the biased top of the uint32 range', () => {
    // 2^32 = 11 × 390451572 + 4, so the top 4 values (4294967292 and up)
    // would make the lowest steps more likely and must be redrawn.
    const draws = [0xffff_ffff, 4_294_967_292, 4_294_967_291];
    const drawStep = createStepDraw(() => draws.shift() ?? 0, 5);
    expect(drawStep()).toBe(5); // 4294967291 % 11 = 10, i.e. step +5
    expect(draws).toEqual([]);
  });
});
