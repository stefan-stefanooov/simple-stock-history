// Test-only helpers, excluded from the library build (tsconfig.lib.json).
import type { TradePositions } from '../lib/best-trade-search.ts';

/**
 * Brute-force O(n²) reference: tries every Trade in the Time Slice from
 * `first` to `last` (both included) and keeps the Best Trade. Highest Profit,
 * then earliest Buy Point, then earliest Sell Point; `null` for No Profitable
 * Trade.
 */
export function bruteForceBestTrade(
  prices: ArrayLike<number>,
  first: number,
  last: number,
): TradePositions | null {
  let best: TradePositions | null = null;
  let bestProfit = 0;
  for (let buy = first; buy <= last; buy++) {
    for (let sell = buy + 1; sell <= last; sell++) {
      const profit = prices[sell] - prices[buy];
      // Loop order visits Buy Points, then Sell Points, earliest first, so
      // only a strictly higher Profit replaces the Best Trade.
      if (profit > bestProfit) {
        bestProfit = profit;
        best = { buy, sell };
      }
    }
  }
  return best;
}

/** Seeded mulberry32 PRNG, so a failing random case can be replayed. */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b_79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
