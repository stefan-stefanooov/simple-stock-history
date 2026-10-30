import { z } from 'zod';
import { CurrencySchema } from './share.js';
import { EpochSecondsParamSchema, EpochSecondsSchema } from './time.js';

/**
 * `GET /api/v1/trades/best?from=&to=`: the Time Slice to search, both ends
 * included. Parses the raw query-string values into numbers. Whether the Time
 * Slice lies within the Data Period and `from <= to` is checked by the endpoint.
 */
export const BestTradeQuerySchema = z.object({
  from: EpochSecondsParamSchema.describe(
    'First second of the Time Slice, Unix epoch seconds (UTC), digits only',
  ),
  to: EpochSecondsParamSchema.describe(
    'Last second of the Time Slice, included, Unix epoch seconds (UTC), digits only',
  ),
});

export type BestTradeQuery = z.infer<typeof BestTradeQuerySchema>;

/** The Share's price at one second: a Buy Point or a Sell Point of a Trade. */
export const PricePointSchema = z.object({
  time: EpochSecondsSchema,
  priceCents: z.int().positive().describe('Price per share, in cents'),
});

export type PricePoint = z.infer<typeof PricePointSchema>;

/** A Buy Point paired with a strictly later Sell Point, and its Profit. */
export const TradeSchema = z
  .object({
    buy: PricePointSchema.describe('Buy Point'),
    sell: PricePointSchema.describe('Sell Point, strictly after the Buy Point'),
    profitCents: z
      .int()
      .positive()
      .describe(
        "Profit per share, in cents: the Sell Point's price minus the Buy Point's",
      ),
  })
  .refine((trade) => trade.sell.time > trade.buy.time, {
    error: 'Sell Point must be strictly after the Buy Point',
    path: ['sell', 'time'],
  })
  .refine(
    (trade) =>
      trade.profitCents === trade.sell.priceCents - trade.buy.priceCents,
    {
      error: "Profit must equal the Sell Point's price minus the Buy Point's",
      path: ['profitCents'],
    },
  );

export type Trade = z.infer<typeof TradeSchema>;

/**
 * `GET /api/v1/trades/best`: the Best Trade in the Time Slice, or
 * `trade: null` for No Profitable Trade.
 */
export const BestTradeResponseSchema = z
  .object({
    from: EpochSecondsSchema.describe('First second of the Time Slice'),
    to: EpochSecondsSchema.describe('Last second of the Time Slice, included'),
    currency: CurrencySchema,
    trade: TradeSchema.nullable().describe(
      'The Best Trade, or null for No Profitable Trade',
    ),
  })
  .refine(
    ({ from, to, trade }) =>
      trade === null || (trade.buy.time >= from && trade.sell.time <= to),
    {
      error: 'Trade must lie within the Time Slice',
      path: ['trade'],
    },
  );

export type BestTradeResponse = z.infer<typeof BestTradeResponseSchema>;
