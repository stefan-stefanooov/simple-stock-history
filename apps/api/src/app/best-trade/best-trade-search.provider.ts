import type { FactoryProvider } from '@nestjs/common';
import {
  type BestTradeSearch,
  createBestTradeSearch,
} from '@simple-stock-history/best-trade';
import { PriceHistory } from '../price-history/price-history';

/**
 * Injection token for the {@link BestTradeSearch} over the loaded Price
 * History: `@Inject(BEST_TRADE_SEARCH) private readonly search: BestTradeSearch`.
 * Its positions count from the Data Period's first second, which is
 * position 0 (`PriceHistory.dataPeriod.from`).
 */
export const BEST_TRADE_SEARCH = Symbol('BEST_TRADE_SEARCH');

/**
 * Creates the Best Trade search once at startup from the Price History and
 * the hour summaries read from disk (ADR-0002). `libs/best-trade` stays plain
 * TypeScript; this is the only place it meets Nest.
 */
export const bestTradeSearchProvider: FactoryProvider<BestTradeSearch> = {
  provide: BEST_TRADE_SEARCH,
  inject: [PriceHistory],
  useFactory: (priceHistory: PriceHistory) =>
    createBestTradeSearch(priceHistory.prices, priceHistory.hourSummaries),
};
