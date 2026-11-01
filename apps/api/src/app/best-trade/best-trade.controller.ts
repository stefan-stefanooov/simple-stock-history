import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import type { BestTradeResponse } from '@simple-stock-history/shared';
import { CACHE_FOR_A_DAY } from '../cache-control';
import { BestTradeQueryDto, BestTradeResponseDto } from '../dtos';
import { ApiProblemResponse } from '../swagger/api-problem-response.decorator';
import {
  BEST_TRADE_EXAMPLES,
  INVALID_TIME_SLICE_EXAMPLES,
  TIME_SLICE_TOO_SHORT_EXAMPLES,
} from './best-trade.examples';
import { BestTradeService } from './best-trade.service';

/** `GET /api/v1/trades/best?from=&to=`: the Best Trade in a Time Slice. */
@Controller('v1/trades')
export class BestTradeController {
  constructor(private readonly bestTrades: BestTradeService) {}

  @Get('best')
  // The Price History is fixed for a release (ADR-0001), so the same Time
  // Slice always has the same Best Trade.
  @Header('Cache-Control', CACHE_FOR_A_DAY)
  @ApiOperation({
    summary: 'The Best Trade in a Time Slice',
    description:
      'Finds the Trade with the highest Profit per share that buys and then ' +
      'sells the Share within the Time Slice from `from` to `to`, both ' +
      'included. The Sell Point is always strictly after the Buy Point. On ' +
      'ties the earliest Buy Point wins, then the earliest Sell Point. ' +
      '`trade` is null for No Profitable Trade, when no Trade has a Profit ' +
      'above zero. The Time Slice must lie within the Data Period ' +
      '(`GET /api/v1/period`) and be at least 2 seconds long.',
  })
  @ApiOkResponse({
    type: BestTradeResponseDto.Output,
    description: 'The Best Trade, or `trade: null` for No Profitable Trade.',
    examples: BEST_TRADE_EXAMPLES,
  })
  @ApiProblemResponse(
    400,
    '`from` or `to` is not Unix epoch seconds, lies outside the Data ' +
      'Period, or `from` is after `to`; `issues` lists each problem.',
    INVALID_TIME_SLICE_EXAMPLES,
  )
  @ApiProblemResponse(
    422,
    'The Time Slice is shorter than 2 seconds (`from` equals `to`), too ' +
      'short for any Trade.',
    TIME_SLICE_TOO_SHORT_EXAMPLES,
  )
  best(@Query() timeSlice: BestTradeQueryDto): BestTradeResponse {
    return this.bestTrades.find(timeSlice);
  }
}
