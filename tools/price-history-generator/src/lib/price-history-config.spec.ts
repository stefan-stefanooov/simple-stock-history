import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG_PATH } from './cli.ts';
import { parsePriceHistoryConfig } from './price-history-config.ts';

const VALID = {
  seed: 42,
  dataPeriodStart: 1_761_955_200,
  count: 20,
  startPriceCents: 10_000,
  maxStepCents: 5,
  floorPriceCents: 100,
  sha256: 'ab'.repeat(32),
};

describe('parsePriceHistoryConfig', () => {
  it('returns a valid config unchanged', () => {
    expect(parsePriceHistoryConfig({ ...VALID })).toEqual(VALID);
  });

  // The design agreed in #2: one Price Point per second of November 2025 UTC,
  // starting at $100.00, ±5¢ steps, reflected at the $1.00 floor.
  it('commits the agreed Data Period and walk', () => {
    const committed = parsePriceHistoryConfig(
      JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8')),
    );
    expect(committed).toMatchObject({
      dataPeriodStart: 1_761_955_200, // 2025-11-01T00:00:00Z
      count: 30 * 24 * 60 * 60,
      startPriceCents: 10_000,
      maxStepCents: 5,
      floorPriceCents: 100,
    });
  });

  it.each<[string, unknown, RegExp]>([
    ['an array', [], /JSON object/],
    ['null', null, /JSON object/],
    [
      'a config without a price floor',
      Object.fromEntries(
        Object.entries(VALID).filter(([key]) => key !== 'floorPriceCents'),
      ),
      /Missing config field\(s\): floorPriceCents/,
    ],
    [
      'a config with a null field',
      { ...VALID, count: null },
      /count must be a number/,
    ],
    [
      'a config with a misspelt field',
      { ...VALID, floorCents: 100 },
      /Unknown config field\(s\): floorCents/,
    ],
    ['a seed given as a string', { ...VALID, seed: '42' }, /seed/],
    [
      'a fractional Data Period start',
      { ...VALID, dataPeriodStart: 1.5 },
      /dataPeriodStart/,
    ],
    ['a negative count', { ...VALID, count: -1 }, /count/],
    ['an uppercase sha256', { ...VALID, sha256: 'AB'.repeat(32) }, /sha256/],
    ['a short sha256', { ...VALID, sha256: 'ab' }, /sha256/],
  ])('rejects %s', (_, value, message) => {
    expect(() => parsePriceHistoryConfig(value)).toThrow(message);
  });
});
