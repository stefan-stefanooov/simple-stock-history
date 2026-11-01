import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { BestTradeSearch } from '@simple-stock-history/best-trade';
import type { PriceHistoryFixture } from '../../testing/price-history-fixture.interface';
import { writePriceHistoryFixture } from '../../testing/price-history-fixture';
import { loadConfig } from '../config/app-config';
import { ConfigModule, APP_CONFIG } from '../config/config.module';
import { HealthModule } from '../health/health.module';
import { MetricsModule } from '../metrics/metrics.module';
import { BEST_TRADE_SEARCH } from './best-trade-search.provider';
import { BestTradeModule } from './best-trade.module';

describe('BestTradeModule', () => {
  let fixture: PriceHistoryFixture;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    fixture = await writePriceHistoryFixture();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, HealthModule, MetricsModule, BestTradeModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadConfig({
          NODE_ENV: 'test',
          PRICE_HISTORY_PATH: fixture.paths.priceHistory,
        }),
      )
      .compile();
  });

  afterAll(async () => {
    await moduleRef.close();
    await fixture.remove();
    jest.restoreAllMocks();
  });

  it('provides the Best Trade search over the loaded Price History and hour summaries', () => {
    const search = moduleRef.get<BestTradeSearch>(BEST_TRADE_SEARCH);

    // The whole Data Period spans all 3 hours: buy at 99.95, sell at 100.10.
    expect(search.find(0, 10)).toEqual({ buy: 1, sell: 4 });
    // Positions 5 to 10 lie in hours 1 and 2: buy at 99.90, sell at 100.00.
    expect(search.find(5, 10)).toEqual({ buy: 8, sell: 10 });
    // Falling prices only: No Profitable Trade.
    expect(search.find(4, 8)).toBeNull();
  });
});
