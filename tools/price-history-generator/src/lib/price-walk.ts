import { assertIntegerInRange } from './assert-integer.js';
import { mulberry32 } from './mulberry32.js';

// Every value below is an integer well inside ±2^53, so each +, −, % and
// comparison is exact and gives the same result on every engine (ADR-0001).
const INT32_MAX = 0x7fff_ffff;
const UINT32_COUNT = 0x1_0000_0000;

/** Everything that determines a generated Price History. */
export interface PriceWalkOptions {
  /** PRNG seed, an unsigned 32-bit integer. */
  seed: number;
  /** Number of Price Points to produce, one per second. */
  count: number;
  /** Price of the first Price Point, in cents. */
  startPriceCents: number;
  /** Each step is drawn uniformly from −maxStepCents…+maxStepCents. */
  maxStepCents: number;
  /** Lowest price allowed, in cents. A step that would go below it is reflected. */
  floorPriceCents: number;
}

/**
 * Generates the price, in cents, of each consecutive Price Point.
 *
 * The first Price Point is `startPriceCents`. Each later one is the previous
 * price plus a step drawn uniformly from −maxStepCents…+maxStepCents; when
 * `price + step` would fall below `floorPriceCents`, `price − step` is used
 * instead (the walk reflects off the floor). The same options always give
 * the same values.
 */
export function generatePriceHistory(options: PriceWalkOptions): Int32Array {
  const { seed, count, startPriceCents, maxStepCents, floorPriceCents } =
    options;
  assertIntegerInRange('count', count, 1, INT32_MAX);
  assertIntegerInRange('floorPriceCents', floorPriceCents, 0, INT32_MAX);
  assertIntegerInRange(
    'startPriceCents',
    startPriceCents,
    floorPriceCents,
    INT32_MAX,
  );
  assertIntegerInRange('maxStepCents', maxStepCents, 0, INT32_MAX);
  if (startPriceCents + (count - 1) * maxStepCents > INT32_MAX) {
    throw new RangeError(
      'startPriceCents + (count − 1) × maxStepCents must fit in a signed 32-bit integer',
    );
  }

  const drawStep = createStepDraw(mulberry32(seed), maxStepCents);
  const prices = new Int32Array(count);
  let price = startPriceCents;
  prices[0] = price;
  for (let i = 1; i < count; i++) {
    const step = drawStep();
    price = price + step < floorPriceCents ? price - step : price + step;
    prices[i] = price;
  }
  return prices;
}

/**
 * Turns a source of unsigned 32-bit integers into steps drawn uniformly from
 * −maxStepCents…+maxStepCents.
 *
 * Draws at or above the largest multiple of the number of possible steps are
 * discarded and redrawn, so every step is exactly equally likely (a plain
 * `% outcomes` would slightly favour the lowest steps).
 */
export function createStepDraw(
  nextUint32: () => number,
  maxStepCents: number,
): () => number {
  const outcomes = 2 * maxStepCents + 1;
  const limit = UINT32_COUNT - (UINT32_COUNT % outcomes);
  return () => {
    let draw = nextUint32();
    while (draw >= limit) {
      draw = nextUint32();
    }
    return (draw % outcomes) - maxStepCents;
  };
}
