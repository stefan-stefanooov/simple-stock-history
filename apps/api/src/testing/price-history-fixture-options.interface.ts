/** What {@link writePriceHistoryFixture} writes; every field has a small default. */
export interface PriceHistoryFixtureOptions {
  /** Price Points in cents, one per second. */
  readonly prices?: Int32Array;
  /** Price Points per hour summary. */
  readonly hourLength?: number;
  /** First second of the Data Period, Unix epoch seconds. */
  readonly dataPeriodStart?: number;
}
