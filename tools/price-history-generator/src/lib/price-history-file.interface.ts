import type { PriceHistoryMeta } from './price-history-meta.interface.ts';

/** A generated Price History, ready to be written to disk. */
export interface PriceHistoryFile {
  /** The `.bin` file: each Price Point's price in cents, Int32 little-endian. */
  bytes: Uint8Array;
  meta: PriceHistoryMeta;
}
