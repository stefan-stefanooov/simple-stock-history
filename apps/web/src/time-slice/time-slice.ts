import type {
  EpochSeconds,
  PeriodResponse,
} from '@simple-stock-history/shared';

/** The Data Period: its first and last second, both included. */
export type DataPeriod = Pick<PeriodResponse, 'from' | 'to'>;

/** A Time Slice: its first and last second, both included. */
export interface TimeSlice {
  from: EpochSeconds;
  to: EpochSeconds;
}

/**
 * What the user has entered so far: the first and last day as the epoch second
 * of their UTC midnight (`lastDay` is absent while only one day is picked), and
 * the start and end times as typed, `HH:MM:SS` in UTC.
 */
export interface TimeSliceDraft {
  days: { firstDay: EpochSeconds; lastDay?: EpochSeconds } | undefined;
  startTime: string;
  endTime: string;
}

export type TimeSliceProblem =
  | 'no-days'
  | 'invalid-start-time'
  | 'invalid-end-time'
  | 'end-before-start'
  | 'too-short'
  | 'outside-data-period';

export type TimeSliceResult =
  { ok: true; timeSlice: TimeSlice } | { ok: false; problem: TimeSliceProblem };

export const SECONDS_PER_DAY = 86_400;

export const DEFAULT_START_TIME = '00:00:00';
export const DEFAULT_END_TIME = '23:59:59';

/** `HH:MM:SS`, or `HH:MM` as browsers report a time input whose seconds are 0. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/** Seconds since midnight for a time-input value, or `null` if it isn't one. */
export function parseTimeOfDay(value: string): number | null {
  const match = TIME_OF_DAY.exec(value);
  if (!match) return null;
  const [, hours, minutes, seconds = '0'] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * The epoch second of the UTC midnight that starts the day containing
 * `seconds`. Unix time has no leap seconds, so every UTC day is 86,400 s.
 */
export function utcDayStart(seconds: EpochSeconds): EpochSeconds {
  return seconds - (seconds % SECONDS_PER_DAY);
}

/**
 * Turns a draft into a Time Slice, or names the first problem with it. The
 * Time Slice must lie within the Data Period, end after it starts and span at
 * least 2 seconds (from < to), since a Trade needs a Buy Point strictly before
 * its Sell Point and the API rejects `from == to` with 422.
 */
export function toTimeSlice(
  draft: TimeSliceDraft,
  dataPeriod: DataPeriod,
): TimeSliceResult {
  if (!draft.days) return { ok: false, problem: 'no-days' };
  const startOffset = parseTimeOfDay(draft.startTime);
  if (startOffset === null) return { ok: false, problem: 'invalid-start-time' };
  const endOffset = parseTimeOfDay(draft.endTime);
  if (endOffset === null) return { ok: false, problem: 'invalid-end-time' };

  const { firstDay, lastDay = firstDay } = draft.days;
  const from = firstDay + startOffset;
  const to = lastDay + endOffset;

  if (to < from) return { ok: false, problem: 'end-before-start' };
  if (to === from) return { ok: false, problem: 'too-short' };
  if (from < dataPeriod.from || to > dataPeriod.to) {
    return { ok: false, problem: 'outside-data-period' };
  }
  return { ok: true, timeSlice: { from, to } };
}
