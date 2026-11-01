import type { LogLevel, NodeEnv } from './app-config';

/** The API's settings, read once from the environment at startup. */
export interface AppConfig {
  /** `NODE_ENV`, default `production`. Only `development` pretty-prints logs. */
  readonly nodeEnv: NodeEnv;
  /** `PORT`, default 3000. */
  readonly port: number;
  /** `LOG_LEVEL`, default `info` (`silent` under `NODE_ENV=test`). */
  readonly logLevel: LogLevel;
  /**
   * `PRICE_HISTORY_PATH`: the generated Price History file. Defaults to where
   * the generator writes it, relative to the working directory (the workspace
   * root under `nx serve`); the container image sets it explicitly.
   */
  readonly priceHistoryPath: string;
  /** `SWAGGER_ENABLED`, `true` or `false`, default `true`. */
  readonly swaggerEnabled: boolean;
}
