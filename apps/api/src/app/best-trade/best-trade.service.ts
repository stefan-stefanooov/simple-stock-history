import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  BestTradeSearch,
  TradePositions,
} from '@simple-stock-history/best-trade';
import {
  type BestTradeQuery,
  type BestTradeResponse,
  CurrencySchema,
  type PricePoint,
  type Trade,
  type ValidationIssue,
} from '@simple-stock-history/shared';
import { InvalidRequestException } from '../errors/invalid-request.exception';
import type { DataPeriod } from '../price-history/data-period.interface';
import { PriceHistory } from '../price-history/price-history';
import { BestTradeMetrics } from './best-trade-metrics';
import { BEST_TRADE_SEARCH } from './best-trade-search.provider';

/** The `issues` message for a `from` or `to` outside the Data Period. */
export function outsideDataPeriodMessage({ from, to }: DataPeriod): string {
  return `Must lie within the Data Period, ${from} to ${to}, both included`;
}

/** The `issues` message, on `to`, for a Time Slice that ends before it starts. */
export const TO_BEFORE_FROM_MESSAGE = 'Must not be before from';

/** The `detail` of the 422 for a one-second Time Slice (`from == to`). */
export const TIME_SLICE_TOO_SHORT_DETAIL =
  'The Time Slice is shorter than 2 seconds: a Trade needs a Buy Point and a later Sell Point.';

/**
 * Finds the Best Trade in a Time Slice of the Share's Price History, with the
 * Best Trade search created once at startup (`BEST_TRADE_SEARCH`).
 */
@Injectable()
export class BestTradeService {
  constructor(
    private readonly priceHistory: PriceHistory,
    @Inject(BEST_TRADE_SEARCH) private readonly search: BestTradeSearch,
    private readonly metrics: BestTradeMetrics,
  ) {}

  /**
   * The Best Trade in the Time Slice from `from` to `to`, both included, or
   * `trade: null` for No Profitable Trade.
   *
   * @throws InvalidRequestException (400) when `from` or `to` lies outside
   * the Data Period, or `from > to`; every such issue is listed.
   * @throws UnprocessableEntityException (422) when the Time Slice is shorter
   * than 2 seconds (`from == to`), too short for any Trade.
   */
  find({ from, to }: BestTradeQuery): BestTradeResponse {
    this.checkTimeSlice(from, to);
    this.metrics.recordTimeSlice(from, to);
    const positions = this.metrics.timeSearch(() =>
      this.search.find(this.positionOf(from), this.positionOf(to)),
    );
    return {
      from,
      to,
      currency: CurrencySchema.value,
      trade: positions && this.toTrade(positions),
    };
  }

  private checkTimeSlice(from: number, to: number): void {
    const { dataPeriod } = this.priceHistory;
    const withinDataPeriod = (second: number) =>
      second >= dataPeriod.from && second <= dataPeriod.to;

    const issues: ValidationIssue[] = [];
    if (!withinDataPeriod(from)) {
      issues.push({
        path: ['from'],
        message: outsideDataPeriodMessage(dataPeriod),
      });
    }
    if (!withinDataPeriod(to)) {
      issues.push({
        path: ['to'],
        message: outsideDataPeriodMessage(dataPeriod),
      });
    }
    if (from > to) {
      issues.push({ path: ['to'], message: TO_BEFORE_FROM_MESSAGE });
    }
    if (issues.length > 0) throw new InvalidRequestException(issues);

    if (from === to) {
      throw new UnprocessableEntityException(TIME_SLICE_TOO_SHORT_DETAIL);
    }
  }

  /** A second of the Data Period as a position in the Price History; its first second is 0. */
  private positionOf(second: number): number {
    return second - this.priceHistory.dataPeriod.from;
  }

  private toTrade({ buy, sell }: TradePositions): Trade {
    const buyPoint = this.pricePointAt(buy);
    const sellPoint = this.pricePointAt(sell);
    return {
      buy: buyPoint,
      sell: sellPoint,
      profitCents: sellPoint.priceCents - buyPoint.priceCents,
    };
  }

  /** The Price Point at a position of the Price History. */
  private pricePointAt(position: number): PricePoint {
    return {
      time: this.priceHistory.dataPeriod.from + position,
      priceCents: this.priceHistory.prices[position],
    };
  }
}
