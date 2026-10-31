/** A Trade as positions in the Price History (0 is the Data Period's first second). */
export interface TradePositions {
  /** Position of the Buy Point. */
  buy: number;
  /** Position of the Sell Point, always greater than `buy`. */
  sell: number;
}
