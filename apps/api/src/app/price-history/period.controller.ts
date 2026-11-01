import { Controller, Get, Header } from '@nestjs/common';
import {
  CurrencySchema,
  type PeriodResponse,
  ShareSchema,
} from '@simple-stock-history/shared';
import { CACHE_FOR_A_DAY } from '../cache-control';
import { ApiPeriod } from './period.docs';
import { PriceHistory } from './price-history';

/** `GET /api/v1/period`: what the API holds, so the web app can bound its Time Slice picker. */
@Controller('v1/period')
export class PeriodController {
  constructor(private readonly priceHistory: PriceHistory) {}

  @Get()
  // The Data Period is fixed for a release (ADR-0001).
  @Header('Cache-Control', CACHE_FOR_A_DAY)
  @ApiPeriod()
  period(): PeriodResponse {
    const { from, to } = this.priceHistory.dataPeriod;
    return {
      share: ShareSchema.value,
      from,
      to,
      currency: CurrencySchema.value,
    };
  }
}
