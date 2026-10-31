import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { ErrorsModule } from './errors/errors.module';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './logging/logging.module';

@Module({
  imports: [ConfigModule, LoggingModule, ErrorsModule, HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
