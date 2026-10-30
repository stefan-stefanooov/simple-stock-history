import { PeriodResponseSchema, type PeriodResponse } from './period.js';

describe('PeriodResponseSchema', () => {
  const period: PeriodResponse = {
    share: 'ACME',
    from: 1761955200,
    to: 1764547199,
    currency: 'USD',
  };

  it('accepts the Share, the Data Period and the currency', () => {
    expect(PeriodResponseSchema.parse(period)).toEqual(period);
  });

  it.each([
    ['another Share', { share: 'ACME2' }],
    ['a lower-case ticker', { share: 'acme' }],
    ['another currency', { currency: 'EUR' }],
    ['from as a string', { from: '1761955200' }],
    ['a fractional to', { to: 1764547199.5 }],
    ['a negative from', { from: -1 }],
    ['a missing to', { to: undefined }],
    ['a null currency', { currency: null }],
  ])('rejects %s', (_, change) => {
    expect(
      PeriodResponseSchema.safeParse({ ...period, ...change }).success,
    ).toBe(false);
  });
});
