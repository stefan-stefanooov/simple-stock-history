import { summarize } from './piece.ts';

/** The hour length in production: 3,600 Price Points, one per second. */
export const HOUR_LENGTH = 3600;

/** Values per hour summary, in memory and in the summaries file. */
export const VALUES_PER_HOUR = 4;
const BYTES_PER_HOUR = VALUES_PER_HOUR * Int32Array.BYTES_PER_ELEMENT;

/**
 * The Price History split into hours of `hourLength` Price Points (the last
 * hour may be shorter), each reduced to an hour summary. Positions count
 * Price Points from the Data Period's first second, which is position 0.
 */
export interface HourSummaries {
  /** Price Points per hour: 3,600 in production, a few in tests. */
  readonly hourLength: number;
  /**
   * 4 values per hour, in hour order: the positions of the hour's earliest
   * lowest price, its earliest highest price, and the Buy Point and Sell
   * Point of its own Best Trade (−1 for both when it has No Profitable Trade).
   */
  readonly values: Int32Array;
}

/** Number of hours of `hourLength` Price Points needed to cover `count` Price Points. */
export function hourCount(count: number, hourLength: number): number {
  return Math.ceil(count / hourLength);
}

/** Splits the Price History (prices in cents) into hours and summarizes each. */
export function buildHourSummaries(
  prices: Int32Array,
  hourLength: number,
): HourSummaries {
  assertHourLength(hourLength);
  const hours = hourCount(prices.length, hourLength);
  const values = new Int32Array(hours * VALUES_PER_HOUR);
  for (let hour = 0; hour < hours; hour++) {
    const first = hour * hourLength;
    const last = Math.min(first + hourLength, prices.length) - 1;
    const { lowest, highest, buy, sell } = summarize(prices, first, last);
    values.set([lowest, highest, buy, sell], hour * VALUES_PER_HOUR);
  }
  return { hourLength, values };
}

/**
 * Encodes hour summaries as the summaries file (`<name>.hours.bin`, ADR-0002):
 * Int32 little-endian, 4 values per hour (lowest, highest, buy, sell), whatever
 * the byte order of the machine. The hour length is not stored.
 */
export function encodeHourSummaries(summaries: HourSummaries): Uint8Array {
  const { values } = summaries;
  const bytes = new Uint8Array(values.length * Int32Array.BYTES_PER_ELEMENT);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) {
    view.setInt32(i * Int32Array.BYTES_PER_ELEMENT, values[i], true);
  }
  return bytes;
}

/**
 * Decodes the summaries file written by {@link encodeHourSummaries}. The file
 * does not store the hour length, so the caller passes the one it was built
 * with.
 */
export function decodeHourSummaries(
  bytes: Uint8Array,
  hourLength: number,
): HourSummaries {
  assertHourLength(hourLength);
  if (bytes.byteLength % BYTES_PER_HOUR !== 0) {
    throw new RangeError(
      `Hour summaries must be a multiple of ${BYTES_PER_HOUR} bytes, got ${bytes.byteLength}`,
    );
  }
  const values = new Int32Array(
    bytes.byteLength / Int32Array.BYTES_PER_ELEMENT,
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < values.length; i++) {
    values[i] = view.getInt32(i * Int32Array.BYTES_PER_ELEMENT, true);
  }
  return { hourLength, values };
}

export function assertHourLength(hourLength: number): void {
  if (!Number.isSafeInteger(hourLength) || hourLength < 1) {
    throw new RangeError(
      `Hour length must be a positive integer, got ${hourLength}`,
    );
  }
}
