import { z } from 'zod';
import type { AppConfig } from './app-config.interface';

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
    .min(1, { error: 'must not be empty', abort: true })
    // The hour summaries and the meta are found next to it by swapping this
    // ending for `.hours.bin` and `.meta.json`, as the generator names them.
    .endsWith('.bin', {
      error: 'must end in .bin, so its hour summaries and meta can be found',
    })
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
