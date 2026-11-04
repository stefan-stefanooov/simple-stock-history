import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
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
import { SWAGGER_UI_ROUTE, UNMATCHED_ROUTE } from './http-metrics';

const START = FIXTURE_DATA_PERIOD_START;
const BEST_TRADE_ROUTE = '/api/v1/trades/best';

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
        SWAGGER_ENABLED: 'true',
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

/**
 * The value of the first sample called `name` whose labels include `labels`
 * in a Prometheus text-format scrape, e.g.
 * `http_requests_total{method="GET",route="/api",status_code="200"} 3`.
 */
function sampleOf(
  scrape: string,
  name: string,
  labels: Record<string, string> = {},
): number | undefined {
  for (const line of scrape.split('\n')) {
    const match = /^(\w+)(?:\{(.*)\})? (\S+)$/.exec(line);
    if (match?.[1] !== name) continue;
    const sampleLabels = Object.fromEntries(
      [...(match[2] ?? '').matchAll(/(\w+)="([^"]*)"/g)].map(
        ([, key, value]) => [key, value],
      ),
    );
    const matches = Object.entries(labels).every(
      ([key, value]) => sampleLabels[key] === value,
    );
    if (matches) return Number(match[3]);
  }
  return undefined;
}

describe('GET /metrics', () => {
  let fixture: PriceHistoryFixture;
  let app: NestExpressApplication;
  /** The scrape taken after the requests below. */
  let scrape: request.Response;
  let openApiPaths: string[];

  beforeAll(async () => {
    fixture = await writePriceHistoryFixture();
    app = await startApp(fixture);
    const server = app.getHttpServer();

    // A Best Trade over the fixture's 11 seconds, a 400, two unknown paths,
    // the internal routes, Swagger UI, a missing Swagger UI file and the
    // OpenAPI document. Then the scrape the tests read.
    await request(server)
      .get(`${BEST_TRADE_ROUTE}?from=${START}&to=${START + 10}`)
      .expect(200);
    await request(server)
      .get(`${BEST_TRADE_ROUTE}?from=${START}&to=x`)
      .expect(400);
    await request(server).get('/api/v1/nothing-here?id=1').expect(404);
    await request(server).get('/api/metrics').expect(404);
    await request(server).get('/healthz').expect(200);
    await request(server).get('/readyz').expect(200);
    await request(server).get('/metrics').expect(200);
    await request(server).get('/api/docs').expect(200);
    await request(server).get('/api/docs/no-such-file.js').expect(404);
    const document = await request(server)
      .get('/api/docs/openapi.json')
      .expect(200);
    openApiPaths = Object.keys(document.body.paths);
    scrape = await request(server).get('/metrics');
  });

  afterAll(async () => {
    await app.close();
    await fixture.remove();
  });

  it('answers in the Prometheus text format, uncached', () => {
    expect(scrape.status).toBe(200);
    expect(scrape.headers['content-type']).toMatch(/^text\/plain;/);
    expect(scrape.headers['content-type']).toContain('version=0.0.4');
    expect(scrape.headers['cache-control']).toBe('no-store');
  });

  it.each([
    // Default Node.js process metrics
    'process_cpu_seconds_total',
    'process_resident_memory_bytes',
    'nodejs_eventloop_lag_seconds',
    'nodejs_heap_size_used_bytes',
    'nodejs_gc_duration_seconds',
    // HTTP
    'http_requests_total',
    'http_request_duration_seconds',
    // Best Trade
    'best_trade_search_duration_seconds',
    'best_trade_time_slice_length_seconds',
  ])('exposes %s', (name) => {
    expect(scrape.text).toMatch(new RegExp(`^# TYPE ${name} `, 'm'));
  });

  it('counts and times requests by method, route template and status code', () => {
    const labels = { method: 'GET', route: BEST_TRADE_ROUTE };

    expect(
      sampleOf(scrape.text, 'http_requests_total', {
        ...labels,
        status_code: '200',
      }),
    ).toBe(1);
    expect(
      sampleOf(scrape.text, 'http_requests_total', {
        ...labels,
        status_code: '400',
      }),
    ).toBe(1);
    expect(
      sampleOf(scrape.text, 'http_request_duration_seconds_count', {
        ...labels,
        status_code: '200',
      }),
    ).toBe(1);
  });

  it.each(['0.001', '0.0025', '0.005', '0.5', '10'])(
    'times requests with a %s second bucket',
    (le) => {
      // Requests take a few ms, so the buckets start at 1 ms; the latency
      // alert's 500 ms threshold needs its own bucket to stay exact.
      expect(
        sampleOf(scrape.text, 'http_request_duration_seconds_bucket', {
          route: BEST_TRADE_ROUTE,
          status_code: '200',
          le,
        }),
      ).toBeDefined();
    },
  );

  it('labels requests no route answered as unmatched, not by their URL', () => {
    expect(
      sampleOf(scrape.text, 'http_requests_total', {
        route: UNMATCHED_ROUTE,
        status_code: '404',
      }),
      // The two unknown paths and the missing Swagger UI file.
    ).toBe(3);
    expect(scrape.text).not.toContain('nothing-here');
  });

  it('labels what Swagger UI serves with its path, not as unmatched', () => {
    // The page and the OpenAPI document.
    expect(
      sampleOf(scrape.text, 'http_requests_total', {
        route: SWAGGER_UI_ROUTE,
        status_code: '200',
      }),
    ).toBe(2);
  });

  it('labels a missing Swagger UI file as unmatched, like any other 404', () => {
    expect(
      sampleOf(scrape.text, 'http_requests_total', {
        route: SWAGGER_UI_ROUTE,
        status_code: '404',
      }),
    ).toBeUndefined();
  });

  it('leaves the probes and the scrapes out of the HTTP metrics', () => {
    expect(scrape.text).not.toMatch(/route="\/(healthz|readyz|metrics)"/);
  });

  it('records the length and search time of each valid Time Slice', () => {
    // The 400 never reached the search, so only the 11-second Time Slice counts.
    expect(
      sampleOf(scrape.text, 'best_trade_time_slice_length_seconds_count'),
    ).toBe(1);
    expect(
      sampleOf(scrape.text, 'best_trade_time_slice_length_seconds_sum'),
    ).toBe(11);
    expect(
      sampleOf(scrape.text, 'best_trade_search_duration_seconds_count'),
    ).toBe(1);
  });

  it('is served outside /api and left out of the OpenAPI document', () => {
    // `/api/metrics` answered 404 above.
    expect(openApiPaths).not.toContain('/metrics');
  });
});
