import { formatShares, formatUsd } from './format';

describe('formatUsd', () => {
  it.each([
    [0, '$0.00'],
    [1, '$0.01'],
    [10, '$0.10'],
    [99, '$0.99'],
    [100, '$1.00'],
    [123_456, '$1,234.56'],
    [100_000_000_000, '$1,000,000,000.00'],
  ])('formats %i cents as %j', (cents, text) => {
    expect(formatUsd(cents)).toBe(text);
  });

  it('is exact up to Number.MAX_SAFE_INTEGER cents', () => {
    // Formatting MAX_SAFE_INTEGER / 100 as a float gives "...409.90".
    expect(formatUsd(Number.MAX_SAFE_INTEGER)).toBe('$90,071,992,547,409.91');
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])(
    'rejects %d cents',
    (cents) => {
      expect(() => formatUsd(cents)).toThrow(RangeError);
    },
  );
});

describe('formatShares', () => {
  it.each([
    [0, '0 shares'],
    [1, '1 share'],
    [2, '2 shares'],
    [12_345, '12,345 shares'],
  ])('formats %i as %j', (shares, text) => {
    expect(formatShares(shares)).toBe(text);
  });

  it.each([-1, 1.5, NaN])('rejects %d', (shares) => {
    expect(() => formatShares(shares)).toThrow(RangeError);
  });
});
