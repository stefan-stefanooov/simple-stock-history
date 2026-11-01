import { assertIntegerInRange } from './assert-integer.ts';
import type { PriceHistoryConfig } from './price-history-config.interface.ts';

const FIELDS = [
  'seed',
  'dataPeriodStart',
  'count',
  'startPriceCents',
  'maxStepCents',
  'floorPriceCents',
  'sha256',
  'hourLength',
  'hourSummariesSha256',
] as const satisfies readonly (keyof PriceHistoryConfig)[];

type Field = (typeof FIELDS)[number];

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Checks a parsed config file and returns it typed. Throws a RangeError naming
 * the first problem: a missing or unknown field, a field that is not an
 * integer, an hour length below 1, or a sha256 that is not 64 lowercase hex
 * digits. The walk's own limits (seed range, floor ≤ start price, …) are
 * checked when it runs.
 */
export function parsePriceHistoryConfig(value: unknown): PriceHistoryConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RangeError('The Price History config must be a JSON object');
  }
  const fields = value as Record<string, unknown>;
  const unknown = Object.keys(fields).filter(
    (key) => !(FIELDS as readonly string[]).includes(key),
  );
  if (unknown.length > 0) {
    throw new RangeError(`Unknown config field(s): ${unknown.join(', ')}`);
  }
  const missing = FIELDS.filter((key) => !(key in fields));
  if (missing.length > 0) {
    throw new RangeError(`Missing config field(s): ${missing.join(', ')}`);
  }

  const integer = (name: Field, min = 0): number => {
    const field = fields[name];
    if (typeof field !== 'number') {
      throw new RangeError(`${name} must be a number, got ${typeof field}`);
    }
    assertIntegerInRange(name, field, min, Number.MAX_SAFE_INTEGER);
    return field;
  };
  const sha256 = (name: Field): string => {
    const field = fields[name];
    if (typeof field !== 'string' || !SHA256_HEX.test(field)) {
      throw new RangeError(`${name} must be 64 lowercase hex digits`);
    }
    return field;
  };

  return {
    seed: integer('seed'),
    dataPeriodStart: integer('dataPeriodStart'),
    count: integer('count'),
    startPriceCents: integer('startPriceCents'),
    maxStepCents: integer('maxStepCents'),
    floorPriceCents: integer('floorPriceCents'),
    sha256: sha256('sha256'),
    hourLength: integer('hourLength', 1),
    hourSummariesSha256: sha256('hourSummariesSha256'),
  };
}
