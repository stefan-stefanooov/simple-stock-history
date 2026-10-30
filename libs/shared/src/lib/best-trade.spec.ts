import {
  BestTradeQuerySchema,
  BestTradeResponseSchema,
  PricePointSchema,
  TradeSchema,
  type BestTradeResponse,
  type Trade,
} from './best-trade.js';

describe('BestTradeQuerySchema', () => {
  it('parses from and to into numbers', () => {
    expect(
      BestTradeQuerySchema.parse({ from: '1761955200', to: '1762041599' }),
    ).toEqual({ from: 1761955200, to: 1762041599 });
  });

  it('ignores unknown query parameters', () => {
    expect(
      BestTradeQuerySchema.parse({
        from: '1761955200',
        to: '1762041599',
        utm_source: 'mail',
      }),
    ).toEqual({ from: 1761955200, to: 1762041599 });
  });

  it('reports every missing parameter by name', () => {
    const result = BestTradeQuerySchema.safeParse({});
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['from'], message: 'Required' }),
      expect.objectContaining({ path: ['to'], message: 'Required' }),
    ]);
  });

  it('reports each malformed parameter by name', () => {
    const result = BestTradeQuerySchema.safeParse({
      from: '1761955200.5',
      to: ['1762041599', '1762041600'],
    });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ['from'],
      ['to'],
    ]);
  });

  it('leaves the Data Period and from <= to to the endpoint', () => {
    expect(BestTradeQuerySchema.parse({ from: '20', to: '10' })).toEqual({
      from: 20,
      to: 10,
    });
  });

  it('encodes a Time Slice back to query-string values', () => {
    expect(
      BestTradeQuerySchema.encode({ from: 1761955200, to: 1762041599 }),
    ).toEqual({ from: '1761955200', to: '1762041599' });
  });
});

describe('PricePointSchema', () => {
  it('accepts a second and a price in cents', () => {
    expect(
      PricePointSchema.parse({ time: 1761960000, priceCents: 10012 }),
    ).toEqual({ time: 1761960000, priceCents: 10012 });
  });

  it.each([
    ['a missing time', { priceCents: 10012 }],
    ['a missing price', { time: 1761960000 }],
    ['a fractional price', { time: 1761960000, priceCents: 100.12 }],
    ['a zero price', { time: 1761960000, priceCents: 0 }],
    ['a negative price', { time: 1761960000, priceCents: -1 }],
    ['a price as a string', { time: 1761960000, priceCents: '10012' }],
    ['a fractional time', { time: 1761960000.5, priceCents: 10012 }],
  ])('rejects %s', (_, input) => {
    expect(PricePointSchema.safeParse(input).success).toBe(false);
  });
});

const trade: Trade = {
  buy: { time: 1761960000, priceCents: 10012 },
  sell: { time: 1762030000, priceCents: 10357 },
  profitCents: 345,
};

describe('TradeSchema', () => {
  it('accepts a Buy Point, a later Sell Point and their Profit', () => {
    expect(TradeSchema.parse(trade)).toEqual(trade);
  });

  it('accepts a Sell Point one second after the Buy Point', () => {
    const shortest = {
      buy: { time: 1761960000, priceCents: 10012 },
      sell: { time: 1761960001, priceCents: 10017 },
      profitCents: 5,
    };
    expect(TradeSchema.parse(shortest)).toEqual(shortest);
  });

  it('rejects a Sell Point at the same second as the Buy Point', () => {
    const result = TradeSchema.safeParse({
      ...trade,
      sell: { ...trade.sell, time: trade.buy.time },
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['sell', 'time'],
        message: 'Sell Point must be strictly after the Buy Point',
      }),
    ]);
  });

  it('rejects a Sell Point before the Buy Point', () => {
    const result = TradeSchema.safeParse({
      buy: { ...trade.buy, time: trade.sell.time },
      sell: { ...trade.sell, time: trade.buy.time },
      profitCents: trade.profitCents,
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['sell', 'time'] }),
    ]);
  });

  it('rejects a Profit that is not the price difference', () => {
    const result = TradeSchema.safeParse({ ...trade, profitCents: 344 });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['profitCents'] }),
    ]);
  });

  it.each([0, -345])('rejects a Profit of %d', (profitCents) => {
    expect(
      TradeSchema.safeParse({
        buy: { time: 1761960000, priceCents: 10012 },
        sell: { time: 1762030000, priceCents: 10012 + profitCents },
        profitCents,
      }).success,
    ).toBe(false);
  });

  it('rejects a missing Profit', () => {
    expect(
      TradeSchema.safeParse({ buy: trade.buy, sell: trade.sell }).success,
    ).toBe(false);
  });
});

describe('BestTradeResponseSchema', () => {
  const response: BestTradeResponse = {
    from: 1761955200,
    to: 1762041599,
    currency: 'USD',
    trade,
  };

  it('accepts a Best Trade', () => {
    expect(BestTradeResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts trade: null for No Profitable Trade', () => {
    const none = { ...response, trade: null };
    expect(BestTradeResponseSchema.parse(none)).toEqual(none);
  });

  it('accepts a Trade on the very ends of the Time Slice', () => {
    const edges = {
      ...response,
      trade: {
        ...trade,
        buy: { ...trade.buy, time: response.from },
        sell: { ...trade.sell, time: response.to },
      },
    };
    expect(BestTradeResponseSchema.parse(edges)).toEqual(edges);
  });

  it('rejects a missing trade, which must be null instead', () => {
    const withoutTrade = {
      from: response.from,
      to: response.to,
      currency: response.currency,
    };
    expect(BestTradeResponseSchema.safeParse(withoutTrade).success).toBe(false);
  });

  it.each([
    ['buys before the Time Slice', { buy: { ...trade.buy, time: 1761955199 } }],
    [
      'sells after the Time Slice',
      { sell: { ...trade.sell, time: 1762041600 } },
    ],
  ])('rejects a Trade that %s', (_, change) => {
    const result = BestTradeResponseSchema.safeParse({
      ...response,
      trade: { ...trade, ...change },
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['trade'],
        message: 'Trade must lie within the Time Slice',
      }),
    ]);
  });

  it('reports an invalid Trade under trade', () => {
    const result = BestTradeResponseSchema.safeParse({
      ...response,
      trade: { ...trade, profitCents: 1 },
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['trade', 'profitCents'] }),
    ]);
  });

  it.each([
    ['another currency', { currency: 'EUR' }],
    ['from as a string', { from: '1761955200' }],
    ['a fractional to', { to: 1762041599.5 }],
    ['a negative from', { from: -1 }],
  ])('rejects %s', (_, change) => {
    expect(
      BestTradeResponseSchema.safeParse({ ...response, ...change }).success,
    ).toBe(false);
  });
});
