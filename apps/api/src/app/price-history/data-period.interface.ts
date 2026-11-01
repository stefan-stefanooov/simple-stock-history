/** The range of seconds the Price History covers, both ends included. */
export interface DataPeriod {
  /** First second, in Unix epoch seconds (UTC). Position 0 in the Price History. */
  readonly from: number;
  /** Last second, included, in Unix epoch seconds (UTC). */
  readonly to: number;
}
