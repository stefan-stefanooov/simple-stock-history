import {
  formatUtcSecond,
  parseTimeOfDay,
  toTimeSlice,
  utcDayStart,
  type TimeSliceDraft,
} from './time-slice';

// November 2025 UTC, as served by GET /api/v1/period
const NOVEMBER = { from: 1761955200, to: 1764547199 };
const NOV_5 = 1762300800;
const NOV_7 = 1762473600;

function draft(overrides: Partial<TimeSliceDraft>): TimeSliceDraft {
  return {
    days: { firstDay: NOV_5, lastDay: NOV_7 },
    startTime: '00:00:00',
    endTime: '23:59:59',
    ...overrides,
  };
}

describe('parseTimeOfDay', () => {
  it.each([
    ['00:00:00', 0],
    ['23:59:59', 86_399],
    ['12:34:56', 45_296],
    ['09:30', 34_200],
  ])('reads %s as %i seconds after midnight', (value, seconds) => {
    expect(parseTimeOfDay(value)).toBe(seconds);
  });

  it.each(['', '24:00:00', '12:60:00', '12:00:60', '1:00:00', '12:00:00.5'])(
    'rejects %j',
    (value) => {
      expect(parseTimeOfDay(value)).toBeNull();
    },
  );
});

describe('utcDayStart', () => {
  it('returns the UTC midnight of the day', () => {
    expect(utcDayStart(NOV_5)).toBe(NOV_5);
    expect(utcDayStart(NOV_5 + 86_399)).toBe(NOV_5);
    expect(utcDayStart(NOV_5 + 86_400)).toBe(NOV_5 + 86_400);
  });
});

describe('toTimeSlice', () => {
  it('spans the first day from the start time to the last day at the end time', () => {
    expect(toTimeSlice(draft({}), NOVEMBER)).toEqual({
      ok: true,
      timeSlice: { from: NOV_5, to: NOV_7 + 86_399 },
    });
  });

  it('applies times to the second', () => {
    expect(
      toTimeSlice(
        draft({ startTime: '08:15:01', endTime: '17:45:59' }),
        NOVEMBER,
      ),
    ).toEqual({
      ok: true,
      timeSlice: { from: NOV_5 + 29_701, to: NOV_7 + 63_959 },
    });
  });

  it('treats a range with only its first day picked as that one day', () => {
    expect(toTimeSlice(draft({ days: { firstDay: NOV_5 } }), NOVEMBER)).toEqual(
      { ok: true, timeSlice: { from: NOV_5, to: NOV_5 + 86_399 } },
    );
  });

  it('covers the whole Data Period with its first and last day', () => {
    expect(
      toTimeSlice(
        draft({
          days: {
            firstDay: NOVEMBER.from,
            lastDay: utcDayStart(NOVEMBER.to),
          },
        }),
        NOVEMBER,
      ),
    ).toEqual({ ok: true, timeSlice: NOVEMBER });
  });

  it('accepts a Time Slice of exactly 2 seconds', () => {
    expect(
      toTimeSlice(
        draft({
          days: { firstDay: NOV_5, lastDay: NOV_5 },
          startTime: '10:00:00',
          endTime: '10:00:01',
        }),
        NOVEMBER,
      ),
    ).toEqual({
      ok: true,
      timeSlice: { from: NOV_5 + 36_000, to: NOV_5 + 36_001 },
    });
  });

  it('needs days', () => {
    expect(toTimeSlice(draft({ days: undefined }), NOVEMBER)).toEqual({
      ok: false,
      problem: 'no-days',
    });
  });

  it('needs valid times', () => {
    expect(toTimeSlice(draft({ startTime: '' }), NOVEMBER)).toEqual({
      ok: false,
      problem: 'invalid-start-time',
    });
    expect(toTimeSlice(draft({ endTime: '' }), NOVEMBER)).toEqual({
      ok: false,
      problem: 'invalid-end-time',
    });
  });

  it('rejects an end before the start', () => {
    expect(
      toTimeSlice(
        draft({
          days: { firstDay: NOV_5, lastDay: NOV_5 },
          startTime: '12:00:00',
          endTime: '11:59:59',
        }),
        NOVEMBER,
      ),
    ).toEqual({ ok: false, problem: 'end-before-start' });
  });

  it('rejects a single second, which the API answers with 422', () => {
    expect(
      toTimeSlice(
        draft({
          days: { firstDay: NOV_5, lastDay: NOV_5 },
          startTime: '12:00:00',
          endTime: '12:00:00',
        }),
        NOVEMBER,
      ),
    ).toEqual({ ok: false, problem: 'too-short' });
  });

  it('rejects seconds outside the Data Period', () => {
    const fromNoon = { from: NOV_5 + 43_200, to: NOV_7 + 43_199 };
    expect(toTimeSlice(draft({}), fromNoon)).toEqual({
      ok: false,
      problem: 'outside-data-period',
    });
    expect(
      toTimeSlice(
        draft({ startTime: '12:00:00', endTime: '11:59:59' }),
        fromNoon,
      ),
    ).toEqual({ ok: true, timeSlice: fromNoon });
  });
});

describe('formatUtcSecond', () => {
  it('writes the second in UTC', () => {
    expect(formatUtcSecond(NOVEMBER.from)).toBe('2025-11-01 00:00:00 UTC');
    expect(formatUtcSecond(NOVEMBER.to)).toBe('2025-11-30 23:59:59 UTC');
  });
});
