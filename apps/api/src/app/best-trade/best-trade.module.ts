import { Module } from '@nestjs/common';
import { PriceHistoryModule } from '../price-history/price-history.module';
import { bestTradeSearchProvider } from './best-trade-search.provider';
import { BestTradeController } from './best-trade.controller';
import { BestTradeService } from './best-trade.service';

/**
 * The Best Trade search over the Share's Price History, served on
 * `GET /api/v1/trades/best`. Provides `BEST_TRADE_SEARCH` and re-exports
 * {@link PriceHistoryModule}; {@link BestTradeService} turns a Time Slice's
 * seconds into positions with `PriceHistory.dataPeriod`.
 */
@Module({
  imports: [PriceHistoryModule],
  controllers: [BestTradeController],
  providers: [bestTradeSearchProvider, BestTradeService],
  exports: [bestTradeSearchProvider.provide, PriceHistoryModule],
})
export class BestTradeModule {}
