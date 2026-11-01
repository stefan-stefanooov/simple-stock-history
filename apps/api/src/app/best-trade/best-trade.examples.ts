import type { BestTradeResponse } from '@simple-stock-history/shared';
import { INVALID_REQUEST_DETAIL } from '../errors/invalid-request.exception';
import type { ProblemExamples } from '../swagger/api-problem-response.decorator';
import {
  outsideDataPeriodMessage,
  TIME_SLICE_TOO_SHORT_DETAIL,
  TO_BEFORE_FROM_MESSAGE,
} from './best-trade.service';

/*
 * Swagger UI examples for `GET /api/v1/trades/best`, one per case. Each is
 * what the API answers for the real Price History (November 2025, seed in
 * `tools/price-history-generator/price-history.config.json`); `swagger.spec.ts`
 * replays every example against it, so they cannot drift.
 */

/** The real Data Period: 2025-11-01T00:00:00Z to 2025-11-30T23:59:59Z. */
const DATA_PERIOD = { from: 1761955200, to: 1764547199 };

const PATH = '/api/v1/trades/best';

/** Named example bodies of a 200, shown in Swagger UI. */
export type BestTradeExamples = Record<
  string,
  { summary: string; value: BestTradeResponse }
>;

export const BEST_TRADE_EXAMPLES: BestTradeExamples = {
  bestTrade: {
    summary: 'Best Trade, 2025-11-03 09:00:00 to 17:00:00 UTC',
    value: {
      from: 1762160400,
      to: 1762189200,
      currency: 'USD',
      trade: {
        buy: { time: 1762171637, priceCents: 8274 },
        sell: { time: 1762187007, priceCents: 8791 },
        profitCents: 517,
      },
    },
  },
  noProfitableTrade: {
    summary: 'No Profitable Trade: the price only falls',
    value: {
      from: 1762171210,
      to: 1762171213,
      currency: 'USD',
      trade: null,
    },
  },
};

export const INVALID_TIME_SLICE_EXAMPLES: ProblemExamples = {
  malformed: {
    summary: 'from is not Unix epoch seconds',
    value: {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: INVALID_REQUEST_DETAIL,
      instance: `${PATH}?from=2025-11-03T09:00:00Z&to=1762189200`,
      issues: [
        {
          path: ['from'],
          message:
            'Must be Unix epoch seconds written with digits only: no sign, spaces, decimal point or exponent',
        },
      ],
    },
  },
  outsideDataPeriod: {
    summary: 'to is after the Data Period',
    value: {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: INVALID_REQUEST_DETAIL,
      instance: `${PATH}?from=1764547000&to=1764547200`,
      issues: [
        { path: ['to'], message: outsideDataPeriodMessage(DATA_PERIOD) },
      ],
    },
  },
  toBeforeFrom: {
    summary: 'to is before from',
    value: {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: INVALID_REQUEST_DETAIL,
      instance: `${PATH}?from=1762189200&to=1762160400`,
      issues: [{ path: ['to'], message: TO_BEFORE_FROM_MESSAGE }],
    },
  },
};

export const TIME_SLICE_TOO_SHORT_EXAMPLES: ProblemExamples = {
  oneSecond: {
    summary: 'from == to: a one-second Time Slice',
    value: {
      type: 'about:blank',
      title: 'Unprocessable Entity',
      status: 422,
      detail: TIME_SLICE_TOO_SHORT_DETAIL,
      instance: `${PATH}?from=1762160400&to=1762160400`,
    },
  },
};
