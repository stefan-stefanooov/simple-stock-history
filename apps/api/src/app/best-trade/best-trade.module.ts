import { Module } from '@nestjs/common';
import { PriceHistoryModule } from '../price-history/price-history.module';
import { bestTradeSearchProvider } from './best-trade-search.provider';

/**
 * The Best Trade search over the Share's Price History. Provides
 * `BEST_TRADE_SEARCH` and re-exports {@link PriceHistoryModule}, so a
 * controller here can turn a Time Slice's seconds into positions with
 * `PriceHistory.dataPeriod`.
 */
@Module({
  imports: [PriceHistoryModule],
  providers: [bestTradeSearchProvider],
  exports: [bestTradeSearchProvider.provide, PriceHistoryModule],
})
export class BestTradeModule {}
