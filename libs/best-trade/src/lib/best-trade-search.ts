import type { BestTradeSearch } from './best-trade-search.interface.ts';
import type { HourSummaries } from './hour-summaries.interface.ts';
import { hourCount, VALUES_PER_HOUR } from './hour-summaries.ts';
import { join, NO_TRADE, summarize } from './piece.ts';
import type { TradePositions } from './trade-positions.interface.ts';

/**
 * Creates the Best Trade search over a Price History (prices in cents) and its
 * hour summaries (ADR-0002). A query loops over the Price Points of the
 * partial hours at its two ends and joins the whole hours in between from
 * their summaries, so it reads at most two hours of Price Points.
 *
 * @throws RangeError if `summaries` don't cover `prices` with their hour length.
 */
export function createBestTradeSearch(
  prices: Int32Array,
  summaries: HourSummaries,
): BestTradeSearch {
  const { hourLength, values } = summaries;
  const hours = hourCount(prices.length, hourLength);
  if (values.length !== hours * VALUES_PER_HOUR) {
    throw new RangeError(
      `${prices.length} Price Points in hours of ${hourLength} need ${hours} hour summaries, got ${values.length / VALUES_PER_HOUR}`,
    );
  }

  return {
    find(first, last) {
      if (
        !Number.isSafeInteger(first) ||
        !Number.isSafeInteger(last) ||
        first < 0 ||
        first > last ||
        last >= prices.length
      ) {
        throw new RangeError(
          `Time Slice must satisfy 0 <= first <= last < ${prices.length}, got ${first}…${last}`,
        );
      }

      const firstHour = Math.floor(first / hourLength);
      const lastHour = Math.floor(last / hourLength);
      // Within two adjacent hours there are no whole hours in between to
      // join, so a plain loop reads no more Price Points.
      if (lastHour - firstHour <= 1) {
        return toResult(summarize(prices, first, last));
      }

      const slice = summarize(prices, first, (firstHour + 1) * hourLength - 1);
      for (let hour = firstHour + 1; hour < lastHour; hour++) {
        const at = hour * VALUES_PER_HOUR;
        join(
          prices,
          slice,
          values[at],
          values[at + 1],
          values[at + 2],
          values[at + 3],
        );
      }
      const end = summarize(prices, lastHour * hourLength, last);
      join(prices, slice, end.lowest, end.highest, end.buy, end.sell);
      return toResult(slice);
    },
  };
}

function toResult({ buy, sell }: TradePositions): TradePositions | null {
  return buy === NO_TRADE ? null : { buy, sell };
}
