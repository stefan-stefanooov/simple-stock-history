/** Contents of the `.meta.json` file written next to the Price History. */
export interface PriceHistoryMeta {
  /** First second of the Data Period, in Unix epoch seconds (UTC). */
  dataPeriodStart: number;
  /** Number of Price Points, one per second from `dataPeriodStart`. */
  count: number;
  /** PRNG seed the Price History was generated from. */
  seed: number;
  /** `version` of the price-history-generator package that wrote the file. */
  generatorVersion: string;
  /** sha256 of the `.bin` file, in lowercase hex. */
  sha256: string;
}
