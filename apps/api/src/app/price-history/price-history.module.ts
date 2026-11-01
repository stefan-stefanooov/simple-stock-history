import { Logger, Module } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import type { AppConfig } from '../config/app-config.interface';
import { APP_CONFIG } from '../config/config.module';
import { ReadinessRegistry } from '../health/readiness-registry';
import { loadPriceHistory } from './load-price-history';
import { PeriodController } from './period.controller';
import { PriceHistory } from './price-history';

/** The `GET /readyz` check that passes once the Price History and its hour summaries are loaded and verified. */
export const PRICE_HISTORY_READINESS_CHECK = 'price-history';

const logger = new Logger('PriceHistory');

/**
 * Loads `PRICE_HISTORY_PATH`, its hour summaries and its meta while Nest
 * builds the app, before the API listens. A file that is missing or does not
 * match the meta fails the build of the app: Nest logs the
 * `PriceHistoryLoadError`, which says which file and why, and exits with
 * code 1.
 */
export async function providePriceHistory(
  config: AppConfig,
  readiness: ReadinessRegistry,
): Promise<PriceHistory> {
  let loaded = false;
  readiness.register(PRICE_HISTORY_READINESS_CHECK, () => loaded);

  const started = performance.now();
  const priceHistory = await loadPriceHistory(config.priceHistoryPath);
  loaded = true;

  const { dataPeriod, prices, hourSummaries } = priceHistory;
  logger.log(
    `Loaded and verified the Price History "${config.priceHistoryPath}": ` +
      `${prices.length} Price Points from ${isoSecond(dataPeriod.from)} to ` +
      `${isoSecond(dataPeriod.to)}, with hour summaries for ` +
      `${Math.ceil(prices.length / hourSummaries.hourLength)} hours of ` +
      `${hourSummaries.hourLength} s, in ${Math.round(performance.now() - started)} ms`,
  );
  return priceHistory;
}

function isoSecond(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().replace('.000Z', 'Z');
}

/**
 * The Share's Price History, held in memory: provides {@link PriceHistory}
 * to the modules that import this one, registers the
 * {@link PRICE_HISTORY_READINESS_CHECK} and serves `GET /api/v1/period`.
 */
@Module({
  controllers: [PeriodController],
  providers: [
    {
      provide: PriceHistory,
      inject: [APP_CONFIG, ReadinessRegistry],
      useFactory: providePriceHistory,
    },
  ],
  exports: [PriceHistory],
})
export class PriceHistoryModule {}
