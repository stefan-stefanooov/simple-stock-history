/**
 * The one date and time style of the whole page: a month name, always UTC,
 * always to the second, e.g. `Nov 3, 2025, 14:05:09 UTC`. The locale is fixed
 * to `en-US` and the time zone to UTC, so the output never depends on the
 * browser's language or time zone.
 */

const utcDateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
});

/**
 * Formats a second, given as Unix epoch seconds, as a UTC date and time to the
 * second, e.g. `1762178709` as `"Nov 3, 2025, 14:05:09 UTC"`.
 *
 * @throws RangeError if `epochSeconds` is not a safe integer or lies outside
 * the range a `Date` can hold.
 */
export function formatUtcDateTime(epochSeconds: number): string {
  return utcDateTime.format(toDate(epochSeconds));
}

/**
 * The same second as {@link formatUtcDateTime}, in the machine-readable form
 * of a `<time dateTime>` attribute, e.g. `1762178709` as
 * `"2025-11-03T14:05:09Z"`.
 *
 * @throws RangeError like {@link formatUtcDateTime}.
 */
export function toIsoUtcDateTime(epochSeconds: number): string {
  return `${toDate(epochSeconds).toISOString().slice(0, 19)}Z`;
}

function toDate(epochSeconds: number): Date {
  if (!Number.isSafeInteger(epochSeconds)) {
    throw new RangeError(
      `epochSeconds must be a safe integer, got ${epochSeconds}`,
    );
  }
  return new Date(epochSeconds * 1000);
}
