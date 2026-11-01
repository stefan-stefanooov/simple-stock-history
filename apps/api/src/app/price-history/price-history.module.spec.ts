import { Logger, type LoggerService } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PeriodResponseSchema } from '@simple-stock-history/shared';
import { readFile, rm, writeFile } from 'node:fs/promises';
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
import { ReadinessRegistry } from '../health/readiness-registry';
import { PriceHistoryLoadError } from './load-price-history';
import { PriceHistory } from './price-history';
import {
  PRICE_HISTORY_READINESS_CHECK,
  providePriceHistory,
} from './price-history.module';

describe('PriceHistoryModule', () => {
  let fixture: PriceHistoryFixture;
  let app: NestExpressApplication;

  beforeAll(async () => {
    fixture = await writePriceHistoryFixture();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadConfig({
          NODE_ENV: 'test',
          PRICE_HISTORY_PATH: fixture.paths.priceHistory,
        }),
      )
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await fixture.remove();
  });

  it('holds the Price History and its hour summaries in memory', () => {
    const priceHistory = app.get(PriceHistory);

    expect(Array.from(priceHistory.prices)).toEqual(Array.from(fixture.prices));
    expect(priceHistory.hourSummaries.hourLength).toBe(fixture.hourLength);
  });

  describe('GET /api/v1/period', () => {
    it('answers the Share, the Data Period of the loaded Price History and the currency', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/period');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.body).toEqual({
        share: 'ACME',
        // 11 Price Points: 2025-11-01T00:00:00Z to 00:00:10Z.
        from: FIXTURE_DATA_PERIOD_START,
        to: FIXTURE_DATA_PERIOD_START + 10,
        currency: 'USD',
      });
      expect(PeriodResponseSchema.parse(response.body)).toEqual(response.body);
    });

    it('may be cached for a day, as the Data Period is fixed for a release', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/period');

      expect(response.headers['cache-control']).toBe('public, max-age=86400');
    });

    it('takes no query parameters', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/period?from=1',
      );

      expect(response.status).toBe(200);
    });
  });

  it('reports the Price History ready on GET /readyz', async () => {
    const response = await request(app.getHttpServer()).get('/readyz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ready',
      checks: { [PRICE_HISTORY_READINESS_CHECK]: 'pass' },
    });
  });
});

describe('providePriceHistory', () => {
  let fixture: PriceHistoryFixture;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    fixture = await writePriceHistoryFixture();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fixture.remove();
  });

  const config = () =>
    loadConfig({
      NODE_ENV: 'test',
      PRICE_HISTORY_PATH: fixture.paths.priceHistory,
    });

  it('registers a readiness check that passes once both files are loaded and verified', async () => {
    const readiness = new ReadinessRegistry();

    const loading = providePriceHistory(config(), readiness);
    const whileLoading = await readiness.check();
    await loading;
    const afterLoading = await readiness.check();

    expect(whileLoading.checks).toEqual({
      [PRICE_HISTORY_READINESS_CHECK]: 'fail',
    });
    expect(afterLoading.checks).toEqual({
      [PRICE_HISTORY_READINESS_CHECK]: 'pass',
    });
  });

  it('logs what it loaded', async () => {
    await providePriceHistory(config(), new ReadinessRegistry());

    expect(Logger.prototype.log).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `^Loaded and verified the Price History ".+acme-test\\.bin": ` +
            '11 Price Points from 2025-11-01T00:00:00Z to 2025-11-01T00:00:10Z, ' +
            'with hour summaries for 3 hours of 4 s, in \\d+ ms$',
        ),
      ),
    );
  });

  it('keeps the readiness check failing when loading fails', async () => {
    await writeFile(fixture.paths.hourSummaries, new Uint8Array(3));
    const readiness = new ReadinessRegistry();

    await expect(providePriceHistory(config(), readiness)).rejects.toThrow(
      PriceHistoryLoadError,
    );
    expect((await readiness.check()).ready).toBe(false);
  });
});

describe('API startup with a bad Price History', () => {
  let fixture: PriceHistoryFixture;
  let app: NestExpressApplication | undefined;
  const savedPath = process.env['PRICE_HISTORY_PATH'];

  beforeEach(async () => {
    fixture = await writePriceHistoryFixture();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (savedPath === undefined) delete process.env['PRICE_HISTORY_PATH'];
    else process.env['PRICE_HISTORY_PATH'] = savedPath;
    await app?.close().catch(() => undefined);
    app = undefined;
    await fixture.remove();
  });

  /** Starts the API the way `main.ts` does and records what it logs as errors. */
  async function startApi(): Promise<{
    exit: jest.SpyInstance;
    errors: unknown[];
  }> {
    const exit = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as typeof process.exit);
    const errors: unknown[] = [];
    const logger: LoggerService = {
      log: () => undefined,
      warn: () => undefined,
      error: (message: unknown) => errors.push(message),
    };
    process.env['PRICE_HISTORY_PATH'] = fixture.paths.priceHistory;
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger,
    });
    return { exit, errors };
  }

  it('logs why and exits with code 1 when the Price History is corrupt', async () => {
    const bytes = await readFile(fixture.paths.priceHistory);
    bytes[0] ^= 0x01;
    await writeFile(fixture.paths.priceHistory, bytes);

    const { exit, errors } = await startApi();

    expect(exit).toHaveBeenCalledWith(1);
    expect(errors).toContainEqual(
      expect.objectContaining({
        name: 'PriceHistoryLoadError',
        message: expect.stringMatching(
          /^The Price History file ".+" is corrupt: its sha256 is/,
        ),
      }),
    );
  });

  it('logs why and exits with code 1 when the hour summaries are missing', async () => {
    await rm(fixture.paths.hourSummaries);

    const { exit, errors } = await startApi();

    expect(exit).toHaveBeenCalledWith(1);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          `Cannot read the hour summaries file "${fixture.paths.hourSummaries}"`,
        ),
      }),
    );
  });
});
