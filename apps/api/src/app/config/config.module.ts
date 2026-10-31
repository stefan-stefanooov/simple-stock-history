import { Global, Module } from '@nestjs/common';
import { type AppConfig, loadConfig } from './app-config';

/**
 * Injection token for the {@link AppConfig}:
 * `constructor(@Inject(APP_CONFIG) private readonly config: AppConfig)`.
 * Tests swap it with `.overrideProvider(APP_CONFIG).useValue(loadConfig({ ... }))`.
 */
export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Provides the validated {@link AppConfig} to every module. `main.ts` has
 * already validated the same environment before Nest starts, so this cannot
 * fail in a running API.
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadConfig(process.env),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
