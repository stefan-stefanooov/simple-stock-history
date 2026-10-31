import { z } from 'zod';

/** pino's levels, plus `silent` to turn logging off. */
export const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type NodeEnv = 'development' | 'production' | 'test';

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

const PORT_ERROR = 'must be a whole number from 1 to 65535';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce
    .number({ error: PORT_ERROR })
    .int({ error: PORT_ERROR })
    .min(1, { error: PORT_ERROR })
    .max(65535, { error: PORT_ERROR })
    .default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  PRICE_HISTORY_PATH: z
    .string()
    .trim()
    .min(1, { error: 'must not be empty' })
    .default('data/acme-2025-11.bin'),
  SWAGGER_ENABLED: z
    .stringbool({ truthy: ['true'], falsy: ['false'] })
    .default(true),
});

/** Thrown by {@link loadConfig}; its message lists every problem, one per line. */
export class InvalidConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      [
        'Invalid configuration, the API cannot start:',
        ...problems.map((problem) => `  - ${problem}`),
      ].join('\n'),
    );
    this.name = 'InvalidConfigError';
  }
}

/**
 * Validates the environment and returns the API's settings.
 *
 * @throws {InvalidConfigError} naming each invalid variable and why.
 */
export function loadConfig(
  env: Readonly<Record<string, string | undefined>>,
): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new InvalidConfigError(
      result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      ),
    );
  }

  const parsed = result.data;
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    // Keeps test output readable; a test can still ask for logs explicitly.
    logLevel:
      parsed.LOG_LEVEL ?? (parsed.NODE_ENV === 'test' ? 'silent' : 'info'),
    priceHistoryPath: parsed.PRICE_HISTORY_PATH,
    swaggerEnabled: parsed.SWAGGER_ENABLED,
  };
}
