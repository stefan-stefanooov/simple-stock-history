import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import {
  type AppConfig,
  InvalidConfigError,
  loadConfig,
} from './app/config/app-config';
import { configureApp, GLOBAL_PREFIX } from './app/configure-app';

async function bootstrap(): Promise<void> {
  let config: AppConfig;
  try {
    // Checked before Nest starts, so a bad environment ends with a readable
    // list of problems instead of a dependency-injection stack trace.
    config = loadConfig(process.env);
  } catch (error) {
    if (!(error instanceof InvalidConfigError)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  configureApp(app);
  await app.listen(config.port);
  Logger.log(
    `Listening on port ${config.port}, routes under /${GLOBAL_PREFIX}`,
    'Bootstrap',
  );
}

void bootstrap();
