import type { PriceWalkOptions } from './price-walk-options.interface.ts';

/**
 * The committed config that pins the Price History (ADR-0001) and its hour
 * summaries (ADR-0002): everything the walk needs, where the Data Period
 * starts, the hour length, and the sha256 each generated file must have.
 */
export interface PriceHistoryConfig extends PriceWalkOptions {
  /** First second of the Data Period, in Unix epoch seconds (UTC). */
  dataPeriodStart: number;
  /** Expected sha256 of the generated `.bin` file, in lowercase hex. */
  sha256: string;
  /** Price Points per hour summary: 3,600 for the Share's Price History. */
  hourLength: number;
  /** Expected sha256 of the generated `.hours.bin` file, in lowercase hex. */
  hourSummariesSha256: string;
}
