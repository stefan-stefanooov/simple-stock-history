import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  BestTradeResponseSchema,
  ProblemDetailsSchema,
} from '@simple-stock-history/shared';
import request from 'supertest';
import type { PriceHistoryFixture } from '../../testing/price-history-fixture.interface';
import {
  FIXTURE_DATA_PERIOD_START,
  writePriceHistoryFixture,
} from '../../testing/price-history-fixture';
import { AppModule } from '../app.module';
import { loadConfig } from '../config/app-config';
import { APP_CONFIG } from '../config/config.module';
import { configureApp } from '../configure-app';
import { INVALID_REQUEST_DETAIL } from '../errors/invalid-request.exception';
import {
  outsideDataPeriodMessage,
  TIME_SLICE_TOO_SHORT_DETAIL,
  TO_BEFORE_FROM_MESSAGE,
} from './best-trade.service';

/*
 * The fixture's Price History, one Price Point per second (prices in cents):
 *
 *   position  0      1     2      3      4      5      6      7     8     9     10
 *   price     10000  9995  10000  10005  10010  10005  10000  9995  9990  9995  10000
 *
 * Its Data Period runs from START (position 0) to END (position 10), and its
 * hours are 4 s long, so Time Slices below cross hour boundaries.
 */
const START = FIXTURE_DATA_PERIOD_START;
const END = START + 10;
const DATA_PERIOD = { from: START, to: END };

/** The full API over the fixture's Price History, as `main.ts` sets it up. */
async function startApp(
  fixture: PriceHistoryFixture,
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(
      loadConfig({
        NODE_ENV: 'test',
        PRICE_HISTORY_PATH: fixture.paths.priceHistory,
      }),
    )
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
  });
  configureApp(app);
  await app.init();
  return app;
}

describe('GET /api/v1/trades/best', () => {
  let fixture: PriceHistoryFixture;
  let app: NestExpressApplication;

  beforeAll(async () => {
    fixture = await writePriceHistoryFixture();
    app = await startApp(fixture);
  });

  afterAll(async () => {
    await app.close();
    await fixture.remove();
  });

  /** Asks for the Best Trade with the raw query string `query`. */
  const bestTrade = (query: string) =>
    request(app.getHttpServer()).get(`/api/v1/trades/best?${query}`);

  /** Asks for the Best Trade in the Time Slice from `from` to `to`. */
  const bestTradeIn = (from: number, to: number) =>
    bestTrade(`from=${from}&to=${to}`);

  describe('200, a Best Trade', () => {
    it('answers the Best Trade over the whole Data Period, both ends included', async () => {
      const response = await bestTradeIn(START, END);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      // Buy Point at position 1, Sell Point at position 4.
      expect(response.body).toEqual({
        from: START,
        to: END,
        currency: 'USD',
        trade: {
          buy: { time: START + 1, priceCents: 9995 },
          sell: { time: START + 4, priceCents: 10010 },
          profitCents: 15,
        },
      });
      expect(BestTradeResponseSchema.parse(response.body)).toEqual(
        response.body,
      );
    });

    it("can buy at the Data Period's first second", async () => {
      const response = await bestTradeIn(START, START + 2);

      expect(response.status).toBe(200);
      // 10000, 9995, 10000: buying at 9995 beats buying at 10000 for no Profit.
      expect(response.body.trade).toEqual({
        buy: { time: START + 1, priceCents: 9995 },
        sell: { time: START + 2, priceCents: 10000 },
        profitCents: 5,
      });
    });

    it("finds a Buy Point at the Time Slice's first second", async () => {
      const response = await bestTradeIn(START + 1, START + 3);

      expect(response.status).toBe(200);
      expect(response.body.trade).toEqual({
        buy: { time: START + 1, priceCents: 9995 },
        sell: { time: START + 3, priceCents: 10005 },
        profitCents: 10,
      });
    });

    it("can sell at the Data Period's last second", async () => {
      const response = await bestTradeIn(START + 5, END);

      expect(response.status).toBe(200);
      expect(response.body.trade).toEqual({
        buy: { time: START + 8, priceCents: 9990 },
        sell: { time: END, priceCents: 10000 },
        profitCents: 10,
      });
    });

    it('answers a Time Slice of 2 seconds, the shortest that holds a Trade', async () => {
      const response = await bestTradeIn(END - 1, END);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        from: END - 1,
        to: END,
        currency: 'USD',
        trade: {
          buy: { time: END - 1, priceCents: 9995 },
          sell: { time: END, priceCents: 10000 },
          profitCents: 5,
        },
      });
    });
  });

  describe('200, No Profitable Trade', () => {
    it('answers trade: null when the price only falls', async () => {
      const response = await bestTradeIn(START + 4, START + 8);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        from: START + 4,
        to: START + 8,
        currency: 'USD',
        trade: null,
      });
      expect(BestTradeResponseSchema.parse(response.body)).toEqual(
        response.body,
      );
    });

    it('answers trade: null for a 2-second Time Slice whose price falls', async () => {
      const response = await bestTradeIn(START, START + 1);

      expect(response.status).toBe(200);
      expect(response.body.trade).toBeNull();
    });
  });

  describe('Cache-Control', () => {
    it('lets clients and proxies keep a Best Trade for a day', async () => {
      const response = await bestTradeIn(START, END);

      expect(response.headers['cache-control']).toBe('public, max-age=86400');
    });

    it('lets clients and proxies keep No Profitable Trade for a day', async () => {
      const response = await bestTradeIn(START + 4, START + 8);

      expect(response.headers['cache-control']).toBe('public, max-age=86400');
    });

    it.each([
      ['a malformed value (400)', 'from=abc&to=1'],
      [
        'a Time Slice outside the Data Period (400)',
        `from=${START - 1}&to=${END}`,
      ],
      ['from > to (400)', `from=${END}&to=${START}`],
      ['from == to (422)', `from=${START}&to=${START}`],
    ])('never caches an error: %s', async (_case, query) => {
      const response = await bestTrade(query);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.headers['cache-control']).toBe('no-store');
    });
  });

  describe('422, a Time Slice shorter than 2 seconds', () => {
    it.each([
      ["the Data Period's first second", START],
      ['a second in the middle', START + 5],
      ["the Data Period's last second", END],
    ])('answers 422 for from == to at %s', async (_case, second) => {
      const response = await bestTradeIn(second, second);

      expect(response.status).toBe(422);
      expect(response.headers['content-type']).toMatch(
        /^application\/problem\+json/,
      );
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Unprocessable Entity',
        status: 422,
        detail: TIME_SLICE_TOO_SHORT_DETAIL,
        instance: `/api/v1/trades/best?from=${second}&to=${second}`,
      });
      expect(ProblemDetailsSchema.parse(response.body)).toEqual(response.body);
    });

    it('answers 400, not 422, for a one-second Time Slice outside the Data Period', async () => {
      const response = await bestTradeIn(END + 1, END + 1);

      expect(response.status).toBe(400);
    });
  });

  describe('400, a Time Slice outside the Data Period or ending before it starts', () => {
    const outside = outsideDataPeriodMessage(DATA_PERIOD);

    it.each([
      [
        'from before the Data Period',
        START - 1,
        END,
        [{ path: ['from'], message: outside }],
      ],
      [
        'from after the Data Period',
        END + 1,
        END + 2,
        [
          { path: ['from'], message: outside },
          { path: ['to'], message: outside },
        ],
      ],
      [
        'to before the Data Period',
        START - 2,
        START - 1,
        [
          { path: ['from'], message: outside },
          { path: ['to'], message: outside },
        ],
      ],
      [
        'to after the Data Period',
        START,
        END + 1,
        [{ path: ['to'], message: outside }],
      ],
      [
        'both ends outside the Data Period',
        START - 1,
        END + 1,
        [
          { path: ['from'], message: outside },
          { path: ['to'], message: outside },
        ],
      ],
      [
        'from > to',
        START + 5,
        START + 4,
        [{ path: ['to'], message: TO_BEFORE_FROM_MESSAGE }],
      ],
      [
        "from > to at the Data Period's two ends",
        END,
        START,
        [{ path: ['to'], message: TO_BEFORE_FROM_MESSAGE }],
      ],
      [
        'from > to with from outside the Data Period',
        END + 1,
        END,
        [
          { path: ['from'], message: outside },
          { path: ['to'], message: TO_BEFORE_FROM_MESSAGE },
        ],
      ],
    ])(
      'answers 400 listing the issues: %s',
      async (_case, from, to, issues) => {
        const response = await bestTradeIn(from, to);

        expect(response.status).toBe(400);
        expect(response.headers['content-type']).toMatch(
          /^application\/problem\+json/,
        );
        expect(response.body).toEqual({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: INVALID_REQUEST_DETAIL,
          instance: `/api/v1/trades/best?from=${from}&to=${to}`,
          issues,
        });
        expect(ProblemDetailsSchema.parse(response.body)).toEqual(
          response.body,
        );
      },
    );

    it('names the Data Period in the message', () => {
      expect(outside).toBe(
        `Must lie within the Data Period, ${START} to ${END}, both included`,
      );
    });
  });

  describe('400, malformed values', () => {
    const DIGITS_ONLY =
      'Must be Unix epoch seconds written with digits only: no sign, spaces, decimal point or exponent';

    it.each([
      ['from missing', `to=${END}`, [{ path: ['from'], message: 'Required' }]],
      ['to missing', `from=${START}`, [{ path: ['to'], message: 'Required' }]],
      [
        'both missing',
        '',
        [
          { path: ['from'], message: 'Required' },
          { path: ['to'], message: 'Required' },
        ],
      ],
      [
        'from empty',
        `from=&to=${END}`,
        [{ path: ['from'], message: DIGITS_ONLY }],
      ],
      [
        'from not a number',
        `from=abc&to=${END}`,
        [{ path: ['from'], message: DIGITS_ONLY }],
      ],
      [
        'from negative',
        `from=-1&to=${END}`,
        [{ path: ['from'], message: DIGITS_ONLY }],
      ],
      [
        'from with a decimal point',
        `from=${START}.5&to=${END}`,
        [{ path: ['from'], message: DIGITS_ONLY }],
      ],
      [
        'from with an exponent',
        `from=1e9&to=${END}`,
        [{ path: ['from'], message: DIGITS_ONLY }],
      ],
      [
        'from as an ISO date',
        `from=2025-11-01T00:00:00Z&to=${END}`,
        [{ path: ['from'], message: DIGITS_ONLY }],
      ],
      [
        'to with a sign',
        `from=${START}&to=+${END}`,
        [{ path: ['to'], message: DIGITS_ONLY }],
      ],
      [
        'to above Number.MAX_SAFE_INTEGER',
        `from=${START}&to=9007199254740992`,
        [
          {
            path: ['to'],
            message: `Must be at most ${Number.MAX_SAFE_INTEGER}`,
          },
        ],
      ],
      [
        'from given twice',
        `from=${START}&from=${START + 1}&to=${END}`,
        [{ path: ['from'], message: 'Must be given only once' }],
      ],
    ])('answers 400 listing the issues: %s', async (_case, query, issues) => {
      const response = await bestTrade(query);

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toMatch(
        /^application\/problem\+json/,
      );
      expect(response.body).toMatchObject({
        title: 'Bad Request',
        status: 400,
        detail: INVALID_REQUEST_DETAIL,
        issues,
      });
    });
  });
});

describe('GET /api/v1/trades/best among equally profitable Trades', () => {
  let fixture: PriceHistoryFixture;
  let app: NestExpressApplication;

  beforeAll(async () => {
    // Every Trade from a 10000 to a later 10005 makes 5 cents; 2 s hours.
    fixture = await writePriceHistoryFixture({
      prices: Int32Array.from([10000, 10005, 10000, 10005, 10005]),
      hourLength: 2,
    });
    app = await startApp(fixture);
  });

  afterAll(async () => {
    await app.close();
    await fixture.remove();
  });

  const bestTradeIn = (from: number, to: number) =>
    request(app.getHttpServer()).get(
      `/api/v1/trades/best?from=${from}&to=${to}`,
    );

  it('takes the earliest Buy Point', async () => {
    const response = await bestTradeIn(START, START + 4);

    expect(response.status).toBe(200);
    expect(response.body.trade).toEqual({
      buy: { time: START, priceCents: 10000 },
      sell: { time: START + 1, priceCents: 10005 },
      profitCents: 5,
    });
  });

  it('then the earliest Sell Point, the shortest Trade', async () => {
    const response = await bestTradeIn(START + 1, START + 4);

    expect(response.status).toBe(200);
    expect(response.body.trade).toEqual({
      buy: { time: START + 2, priceCents: 10000 },
      sell: { time: START + 3, priceCents: 10005 },
      profitCents: 5,
    });
  });
});
