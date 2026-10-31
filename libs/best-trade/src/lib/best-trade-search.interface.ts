import type { TradePositions } from './trade-positions.interface.ts';

export interface BestTradeSearch {
  /**
   * The Best Trade in the Time Slice from position `first` to `last`, both
   * included, or `null` for No Profitable Trade. A one-second Time Slice
   * (`first === last`) has no Trade, so it returns `null`.
   *
   * @throws RangeError unless `first` and `last` are integers with
   * `0 <= first <= last < prices.length`.
   */
  find(first: number, last: number): TradePositions | null;
}
