import type { HourSummaries } from '@simple-stock-history/best-trade';
import type { DataPeriod } from './data-period.interface';

/**
 * The Share's Price History and its hour summaries, loaded from the generated
 * files and verified against their meta at startup. Also the injection token:
 * `constructor(private readonly priceHistory: PriceHistory)`.
 *
 * Positions in `prices` and `hourSummaries` count seconds from
 * `dataPeriod.from`, which is position 0, so a second `s` of the Data Period
 * is position `s - dataPeriod.from`.
 */
export class PriceHistory {
  constructor(
    /** The seconds the Price History covers. */
    readonly dataPeriod: DataPeriod,
    /** One price in cents per second of the Data Period. */
    readonly prices: Int32Array,
    /** The Price History split into hours, as read from `<name>.hours.bin` (ADR-0002). */
    readonly hourSummaries: HourSummaries,
  ) {}
}
