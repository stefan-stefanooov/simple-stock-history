import { formatShares, formatUsd, formatUtcDateTime } from './format';

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

describe('formatUtcDateTime', () => {
  it.each([
    [1_761_955_200, 'Nov 1, 2025, 00:00:00 UTC'], // first second of the Data Period
    [1_762_178_709, 'Nov 3, 2025, 14:05:09 UTC'],
    [1_764_547_199, 'Nov 30, 2025, 23:59:59 UTC'], // last second of the Data Period
    [0, 'Jan 1, 1970, 00:00:00 UTC'],
  ])('formats %i as %j', (epochSeconds, text) => {
    expect(formatUtcDateTime(epochSeconds)).toBe(text);
  });

  it.each([1.5, NaN, Infinity, 9e15])('rejects %d', (epochSeconds) => {
    expect(() => formatUtcDateTime(epochSeconds)).toThrow(RangeError);
  });

  // Switches the process's local time zone, which Node applies immediately,
  // then loads the module afresh: an Intl.DateTimeFormat takes the local time
  // zone when it is created, so the one loaded above would never see the switch.
  describe.each(['America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati'])(
    'with the local time zone set to %s',
    (timeZone) => {
      let originalTimeZone: string | undefined;
      let formatInZone: typeof formatUtcDateTime;
      beforeAll(async () => {
        originalTimeZone = process.env.TZ;
        process.env.TZ = timeZone;
        vi.resetModules();
        ({ formatUtcDateTime: formatInZone } = await import('./format'));
      });
      afterAll(() => {
        if (originalTimeZone === undefined) delete process.env.TZ;
        else process.env.TZ = originalTimeZone;
      });

      it('still formats in UTC', () => {
        // Proves the switch took effect: none of these zones is UTC in November.
        expect(new Date(1_761_955_200_000).getTimezoneOffset()).not.toBe(0);
        expect(formatInZone(1_761_955_200)).toBe('Nov 1, 2025, 00:00:00 UTC');
        expect(formatInZone(1_764_547_199)).toBe('Nov 30, 2025, 23:59:59 UTC');
      });
    },
  );
});
