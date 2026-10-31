import { assertIntegerInRange } from './assert-integer.ts';
import type { PriceWalkOptions } from './price-walk.ts';

/**
 * The committed config that pins the Price History (ADR-0001): everything the
 * walk needs, where the Data Period starts, and the sha256 its output must have.
 */
export interface PriceHistoryConfig extends PriceWalkOptions {
  /** First second of the Data Period, in Unix epoch seconds (UTC). */
  dataPeriodStart: number;
  /** Expected sha256 of the generated `.bin` file, in lowercase hex. */
  sha256: string;
}

const FIELDS = [
  'seed',
  'dataPeriodStart',
  'count',
  'startPriceCents',
  'maxStepCents',
  'floorPriceCents',
  'sha256',
] as const satisfies readonly (keyof PriceHistoryConfig)[];

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Checks a parsed config file and returns it typed. Throws a RangeError naming
 * the first problem: a missing or unknown field, a field that is not an
 * integer, or a sha256 that is not 64 lowercase hex digits. The walk's own
 * limits (seed range, floor ≤ start price, …) are checked when it runs.
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

  const integer = (name: (typeof FIELDS)[number]): number => {
    const field = fields[name];
    if (typeof field !== 'number') {
      throw new RangeError(`${name} must be a number, got ${typeof field}`);
    }
    assertIntegerInRange(name, field, 0, Number.MAX_SAFE_INTEGER);
    return field;
  };
  const { sha256 } = fields;
  if (typeof sha256 !== 'string' || !SHA256_HEX.test(sha256)) {
    throw new RangeError('sha256 must be 64 lowercase hex digits');
  }

  return {
    seed: integer('seed'),
    dataPeriodStart: integer('dataPeriodStart'),
    count: integer('count'),
    startPriceCents: integer('startPriceCents'),
    maxStepCents: integer('maxStepCents'),
    floorPriceCents: integer('floorPriceCents'),
    sha256,
  };
}
