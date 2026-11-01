import { Injectable, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PARAMS_PROVIDER_TOKEN, type Params } from 'nestjs-pino';
import { Writable } from 'node:stream';
import request from 'supertest';
import type { PriceHistoryFixture } from '../../testing/price-history-fixture.interface';
import { writePriceHistoryFixture } from '../../testing/price-history-fixture';
import { AppModule } from '../app.module';
import { loadConfig } from '../config/app-config';
import { APP_CONFIG } from '../config/config.module';
import { configureApp } from '../configure-app';
import { createPinoHttpOptions } from '../logging/pino-http-options';
import { ReadinessRegistry } from './readiness-registry';

type LogLine = Record<string, unknown>;

const logLines: LogLine[] = [];
const logStream = new Writable({
  write(chunk, _encoding, callback) {
    logLines.push(JSON.parse(String(chunk)));
    callback();
  },
});

/** Registers a second readiness check, next to the Price History's, that the test controls. */
let dependencyReady = false;

@Injectable()
class FakeDependency {
  constructor(readiness: ReadinessRegistry) {
    readiness.register('fake-dependency', () => dependencyReady);
  }
}

@Module({ providers: [FakeDependency] })
class FakeDependencyModule {}

function requestLogs(): LogLine[] {
  return logLines.filter((line) => line['msg'] === 'request completed');
}

async function waitForRequestLog(url: string): Promise<void> {
  const deadline = Date.now() + 2000;
  while (
    !requestLogs().some((line) => (line['req'] as LogLine)['url'] === url)
  ) {
    if (Date.now() > deadline) throw new Error(`No request log for ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('Kubernetes probes', () => {
  let app: NestExpressApplication;
  let priceHistory: PriceHistoryFixture;

  beforeAll(async () => {
    priceHistory = await writePriceHistoryFixture();
    const config = loadConfig({
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      PRICE_HISTORY_PATH: priceHistory.paths.priceHistory,
    });
    const params: Params = {
      pinoHttp: [createPinoHttpOptions(config), logStream],
    };
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, FakeDependencyModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue(params)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await priceHistory.remove();
  });

  describe('GET /healthz', () => {
    it('answers 200 while the process is up, even when not ready', async () => {
      dependencyReady = false;

      const response = await request(app.getHttpServer()).get('/healthz');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
      expect(response.headers['cache-control']).toBe('no-store');
    });
  });

  describe('GET /readyz', () => {
    it('answers 503 while a readiness check fails', async () => {
      dependencyReady = false;

      const response = await request(app.getHttpServer()).get('/readyz');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'not ready',
        checks: { 'price-history': 'pass', 'fake-dependency': 'fail' },
      });
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('answers 200 once every readiness check passes', async () => {
      dependencyReady = true;

      const response = await request(app.getHttpServer()).get('/readyz');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ready',
        checks: { 'price-history': 'pass', 'fake-dependency': 'pass' },
      });
      expect(response.headers['cache-control']).toBe('no-store');
    });
  });

  it.each(['/api/healthz', '/api/readyz'])(
    'does not serve %s under the /api prefix Traefik routes',
    async (url) => {
      const response = await request(app.getHttpServer()).get(url);

      expect(response.status).toBe(404);
    },
  );

  it('keeps the other routes under /api', async () => {
    const response = await request(app.getHttpServer()).get('/api');

    expect(response.status).toBe(200);
  });

  it('leaves probe requests out of the request log', async () => {
    await request(app.getHttpServer()).get('/healthz');
    await request(app.getHttpServer()).get('/readyz?verbose=1');
    // Request logs are written in order, so once this one is in, any probe
    // log line would be too.
    await request(app.getHttpServer()).get('/api?after=probes');
    await waitForRequestLog('/api?after=probes');

    const loggedUrls = requestLogs().map(
      (line) => (line['req'] as LogLine)['url'],
    );
    expect(loggedUrls).not.toContainEqual(
      expect.stringMatching(/^\/(healthz|readyz)/),
    );
    expect(loggedUrls).toContain('/api?after=probes');
  });
});
