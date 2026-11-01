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
