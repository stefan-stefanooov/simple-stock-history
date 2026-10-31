/**
 * A run of consecutive Price Points (a partial hour, a whole hour or several
 * hours joined), reduced to what joining it with its neighbours needs. Every
 * field is a position in the Price History.
 */
export interface Piece {
  /** The piece's earliest lowest price. */
  lowest: number;
  /** The piece's earliest highest price. */
  highest: number;
  /** Buy Point of the piece's own Best Trade, −1 for No Profitable Trade. */
  buy: number;
  /** Sell Point of the piece's own Best Trade, −1 for No Profitable Trade. */
  sell: number;
}

/** Marks a missing Buy Point or Sell Point: the piece has No Profitable Trade. */
export const NO_TRADE = -1;

/**
 * Loops over the Price Points from `first` to `last` (both included) and
 * returns their piece.
 */
export function summarize(
  prices: Int32Array,
  first: number,
  last: number,
): Piece {
  let lowest = first;
  let highest = first;
  let buy = NO_TRADE;
  let sell = NO_TRADE;
  let bestProfit = 0;
  for (let i = first + 1; i <= last; i++) {
    const price = prices[i];
    // `lowest` is also the best Buy Point for a Sell Point at `i`: the
    // earliest lowest price seen so far. Strict comparisons keep the earliest
    // Buy Point and then the earliest Sell Point on equal Profit.
    const profit = price - prices[lowest];
    if (profit > bestProfit) {
      bestProfit = profit;
      buy = lowest;
      sell = i;
    }
    if (price < prices[lowest]) lowest = i;
    if (price > prices[highest]) highest = i;
  }
  return { lowest, highest, buy, sell };
}

/**
 * Joins `left` with the piece that directly follows it, given by its fields,
 * and stores the result in `left`. The joined Best Trade is the best of three:
 * the left piece's, the right piece's, or buying at the left piece's earliest
 * lowest price and selling at the right piece's earliest highest price.
 */
export function join(
  prices: Int32Array,
  left: Piece,
  lowest: number,
  highest: number,
  buy: number,
  sell: number,
): void {
  const crossBuy = left.lowest;
  if (isBetterTrade(prices, left.buy, left.sell, buy, sell)) {
    left.buy = buy;
    left.sell = sell;
  }
  if (
    prices[highest] > prices[crossBuy] &&
    isBetterTrade(prices, left.buy, left.sell, crossBuy, highest)
  ) {
    left.buy = crossBuy;
    left.sell = highest;
  }
  if (prices[lowest] < prices[left.lowest]) left.lowest = lowest;
  if (prices[highest] > prices[left.highest]) left.highest = highest;
}

/**
 * Whether the candidate Trade beats the current one: highest Profit, then
 * earliest Buy Point, then earliest Sell Point. A missing Trade (−1) never
 * beats anything and is beaten by any Trade.
 */
function isBetterTrade(
  prices: Int32Array,
  buy: number,
  sell: number,
  candidateBuy: number,
  candidateSell: number,
): boolean {
  if (candidateBuy === NO_TRADE) return false;
  if (buy === NO_TRADE) return true;
  const profit = prices[sell] - prices[buy];
  const candidateProfit = prices[candidateSell] - prices[candidateBuy];
  if (candidateProfit !== profit) return candidateProfit > profit;
  if (candidateBuy !== buy) return candidateBuy < buy;
  return candidateSell < sell;
}
