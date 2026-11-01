import type { PriceHistoryMeta } from './price-history-meta.interface.ts';

/** A generated Price History and its hour summaries, ready to be written to disk. */
export interface PriceHistoryFiles {
  /** The `.bin` file: each Price Point's price in cents, Int32 little-endian. */
  priceHistory: Uint8Array;
  /**
   * The `.hours.bin` file (ADR-0002): Int32 little-endian, 4 values per hour
   * (lowest, highest, buy and sell positions, −1 for No Profitable Trade).
   */
  hourSummaries: Uint8Array;
  meta: PriceHistoryMeta;
}
