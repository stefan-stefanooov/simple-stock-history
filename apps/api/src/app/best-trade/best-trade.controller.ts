import { Controller, Get, Header, Query } from '@nestjs/common';
import type { BestTradeResponse } from '@simple-stock-history/shared';
import { CACHE_FOR_A_DAY } from '../cache-control';
import { BestTradeQueryDto } from '../dtos';
import { ApiBestTrade } from './best-trade.docs';
import { BestTradeService } from './best-trade.service';

/** `GET /api/v1/trades/best?from=&to=`: the Best Trade in a Time Slice. */
@Controller('v1/trades')
export class BestTradeController {
  constructor(private readonly bestTrades: BestTradeService) {}

  @Get('best')
  // The Price History is fixed for a release (ADR-0001), so the same Time
  // Slice always has the same Best Trade.
  @Header('Cache-Control', CACHE_FOR_A_DAY)
  @ApiBestTrade()
  best(@Query() timeSlice: BestTradeQueryDto): BestTradeResponse {
    return this.bestTrades.find(timeSlice);
  }
}
