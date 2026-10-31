import { Module } from '@nestjs/common';
import { LoggerModule, type Params } from 'nestjs-pino';
import type { AppConfig } from '../config/app-config';
import { APP_CONFIG } from '../config/config.module';
import { createPinoHttpOptions } from './pino-http-options';

/**
 * pino logging for the whole API, with a log line per HTTP request.
 * `configureApp` routes Nest's own `Logger` through it, so modules log with
 * `private readonly logger = new Logger(MyService.name)` from `@nestjs/common`.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Params => ({
        pinoHttp: createPinoHttpOptions(config),
      }),
    }),
  ],
})
export class LoggingModule {}
