import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import {
  CurrencySchema,
  type PeriodResponse,
  ShareSchema,
} from '@simple-stock-history/shared';
import { PeriodResponseDto } from '../dtos';
import { PriceHistory } from './price-history';

/** `GET /api/v1/period`: what the API holds, so the web app can bound its Time Slice picker. */
@Controller('v1/period')
export class PeriodController {
  constructor(private readonly priceHistory: PriceHistory) {}

  @Get()
  // The Data Period is fixed for a release (ADR-0001), so clients and proxies
  // may keep the answer for a day, like every successful API response (#2).
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({
    summary: 'The Share and the Data Period its Price History covers',
    description:
      'Every Time Slice asked about must lie within `from` and `to`, both included.',
  })
  @ApiOkResponse({ type: PeriodResponseDto.Output })
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
