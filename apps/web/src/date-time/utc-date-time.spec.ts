import { formatUtcDateTime, toIsoUtcDateTime } from './utc-date-time';

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
        ({ formatUtcDateTime: formatInZone } = await import('./utc-date-time'));
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

describe('toIsoUtcDateTime', () => {
  it.each([
    [1_761_955_200, '2025-11-01T00:00:00Z'],
    [1_762_178_709, '2025-11-03T14:05:09Z'],
    [1_764_547_199, '2025-11-30T23:59:59Z'],
  ])('writes %i as %j', (epochSeconds, text) => {
    expect(toIsoUtcDateTime(epochSeconds)).toBe(text);
  });

  it.each([1.5, NaN, 9e15])('rejects %d', (epochSeconds) => {
    expect(() => toIsoUtcDateTime(epochSeconds)).toThrow(RangeError);
  });
});
