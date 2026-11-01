/** The three files the generator writes for one Price History. */
export interface PriceHistoryFilePaths {
  /** `<name>.bin`: the Price History, `PRICE_HISTORY_PATH`. */
  readonly priceHistory: string;
  /** `<name>.hours.bin`: its hour summaries (ADR-0002). */
  readonly hourSummaries: string;
  /** `<name>.meta.json`: Data Period start, counts and both sha256s. */
  readonly meta: string;
}
