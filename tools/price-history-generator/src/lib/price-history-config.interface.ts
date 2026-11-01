import type { PriceWalkOptions } from './price-walk-options.interface.ts';

/**
 * The committed config that pins the Price History (ADR-0001): everything the
 * walk needs, where the Data Period starts, and the sha256 its output must have.
 */
export interface PriceHistoryConfig extends PriceWalkOptions {
  /** First second of the Data Period, in Unix epoch seconds (UTC). */
  dataPeriodStart: number;
  /** Expected sha256 of the generated `.bin` file, in lowercase hex. */
  sha256: string;
}
