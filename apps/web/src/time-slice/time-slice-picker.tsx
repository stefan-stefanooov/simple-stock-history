import { useId, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { formatUtcDateTime } from '../date-time';
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  toTimeSlice,
  utcDayStart,
  type DataPeriod,
  type TimeSlice,
  type TimeSliceDraft,
  type TimeSliceProblem,
  type TimeSliceResult,
} from './time-slice';

export interface TimeSlicePickerProps {
  /**
   * The Data Period, e.g. the `PeriodResponse` of `GET /api/v1/period`; days
   * outside it can't be picked. Expected not to change: give the picker a new
   * `key` if it does.
   */
  dataPeriod: DataPeriod;
  /**
   * Called whenever the Time Slice changes: with `from`/`to` in Unix epoch
   * seconds, both included, or with `null` while the input is incomplete or
   * invalid. Not called on mount: the picker starts with no days picked.
   */
  onChange: (timeSlice: TimeSlice | null) => void;
}

/**
 * Picks a Time Slice within the Data Period: a range of days plus a start and
 * an end time to the second. Everything is UTC: the calendar shows UTC days
 * and the times are read as UTC, whatever the browser's time zone.
 */
export function TimeSlicePicker({
  dataPeriod,
  onChange,
}: TimeSlicePickerProps) {
  const id = useId();
  const startTimeId = `${id}-start-time`;
  const endTimeId = `${id}-end-time`;
  const problemId = `${id}-problem`;

  const [draft, setDraft] = useState<TimeSliceDraft>({
    days: undefined,
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
  });
  const result = toTimeSlice(draft, dataPeriod);

  function update(next: TimeSliceDraft) {
    setDraft(next);
    const nextTimeSlice = timeSliceOf(toTimeSlice(next, dataPeriod));
    if (!sameTimeSlice(timeSliceOf(result), nextTimeSlice)) {
      onChange(nextTimeSlice);
    }
  }

  function handleSelect(range: DateRange | undefined) {
    update({
      ...draft,
      days: range?.from && {
        firstDay: dayOf(range.from),
        lastDay: range.to && dayOf(range.to),
      },
    });
  }

  // Plain Dates are instants; with timeZone="UTC" DayPicker shows their UTC day.
  const firstDate = new Date(dataPeriod.from * 1000);
  const lastDate = new Date(dataPeriod.to * 1000);
  const selected: DateRange | undefined = draft.days && {
    from: new Date(draft.days.firstDay * 1000),
    to:
      draft.days.lastDay === undefined
        ? undefined
        : new Date(draft.days.lastDay * 1000),
  };

  const problem = result.ok ? undefined : result.problem;
  const startTimeInvalid = problem === 'invalid-start-time';
  const endTimeInvalid =
    problem === 'invalid-end-time' ||
    problem === 'end-before-start' ||
    problem === 'too-short';

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-slate-900">
        Time Slice (UTC)
      </legend>
      <p className="mt-1 text-sm text-slate-600">
        All dates and times are in UTC. Prices are available from{' '}
        {formatUtcDateTime(dataPeriod.from)} to{' '}
        {formatUtcDateTime(dataPeriod.to)}.
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-4">
        <DayPicker
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
          mode="range"
          timeZone="UTC"
          resetOnSelect
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={firstDate}
          startMonth={firstDate}
          endMonth={lastDate}
          disabled={[{ before: firstDate }, { after: lastDate }]}
        />
        <div className="flex min-w-44 flex-1 flex-col gap-3">
          <p className="flex flex-col gap-1">
            <label
              htmlFor={startTimeId}
              className="text-sm font-medium text-slate-700"
            >
              Start time (UTC)
            </label>
            <input
              id={startTimeId}
              className={TIME_INPUT_CLASS}
              type="time"
              step={1}
              required
              value={draft.startTime}
              onChange={(event) =>
                update({ ...draft, startTime: event.target.value })
              }
              aria-invalid={startTimeInvalid}
              aria-describedby={startTimeInvalid ? problemId : undefined}
            />
          </p>
          <p className="flex flex-col gap-1">
            <label
              htmlFor={endTimeId}
              className="text-sm font-medium text-slate-700"
            >
              End time (UTC)
            </label>
            <input
              id={endTimeId}
              className={TIME_INPUT_CLASS}
              type="time"
              step={1}
              required
              value={draft.endTime}
              onChange={(event) =>
                update({ ...draft, endTime: event.target.value })
              }
              aria-invalid={endTimeInvalid}
              aria-describedby={endTimeInvalid ? problemId : undefined}
            />
          </p>
          <output
            aria-label="Selected Time Slice"
            className="block rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 empty:hidden"
          >
            {result.ok &&
              `Time Slice: ${formatUtcDateTime(result.timeSlice.from)} to ${formatUtcDateTime(result.timeSlice.to)}`}
            {problem === 'no-days' &&
              'Pick the first and last day in the calendar.'}
          </output>
          {problem && problem !== 'no-days' && (
            <p id={problemId} role="alert" className="text-sm text-red-700">
              {problemMessage(problem, dataPeriod)}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

const TIME_INPUT_CLASS =
  'w-full max-w-48 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-900 shadow-xs focus:border-emerald-600 focus:outline-2 focus:outline-emerald-600/30 aria-invalid:border-red-600';

/** The UTC day of a date DayPicker reports, as the epoch second of its midnight. */
function dayOf(date: Date) {
  return utcDayStart(Math.floor(date.getTime() / 1000));
}

function timeSliceOf(result: TimeSliceResult) {
  return result.ok ? result.timeSlice : null;
}

function sameTimeSlice(a: TimeSlice | null, b: TimeSlice | null) {
  return a === b || (!!a && !!b && a.from === b.from && a.to === b.to);
}

function problemMessage(
  problem: Exclude<TimeSliceProblem, 'no-days'>,
  dataPeriod: DataPeriod,
) {
  switch (problem) {
    case 'invalid-start-time':
      return 'Enter the start time as HH:MM:SS.';
    case 'invalid-end-time':
      return 'Enter the end time as HH:MM:SS.';
    case 'end-before-start':
      return 'The end is before the start.';
    case 'too-short':
      return 'The Time Slice must span at least 2 seconds: a Trade buys before it sells.';
    case 'outside-data-period':
      return `The Time Slice must lie within ${formatUtcDateTime(dataPeriod.from)} to ${formatUtcDateTime(dataPeriod.to)}.`;
  }
}
