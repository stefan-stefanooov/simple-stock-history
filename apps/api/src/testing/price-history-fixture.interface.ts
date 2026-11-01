import type { PriceHistoryFilePaths } from '../app/price-history/price-history-file-paths.interface';

/** A small Price History, its hour summaries and meta, written to a temporary directory. */
export interface PriceHistoryFixture {
  /** Where the three files are; `paths.priceHistory` is the `PRICE_HISTORY_PATH`. */
  readonly paths: PriceHistoryFilePaths;
  /** The Price Points written, in cents. */
  readonly prices: Int32Array;
  /** The hour length the hour summaries were built with. */
  readonly hourLength: number;
  /** First second of the Data Period, Unix epoch seconds. */
  readonly dataPeriodStart: number;
  /** The meta JSON as written, like the generator's. */
  readonly meta: Record<string, unknown>;
  /** Deletes the temporary directory. */
  remove(): Promise<void>;
}
