import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BestTradeModule } from './best-trade/best-trade.module';
import { ConfigModule } from './config/config.module';
import { ErrorsModule } from './errors/errors.module';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './logging/logging.module';
import { PriceHistoryModule } from './price-history/price-history.module';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    ErrorsModule,
    HealthModule,
    PriceHistoryModule,
    BestTradeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
