/**
 * Formatting of the amounts, share counts and seconds shown to the user. The
 * locale is fixed to `en-US` and every date is shown in UTC, so the output
 * never depends on the browser's language or time zone.
 */

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeNumber = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

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
 * Formats a non-negative amount of integer cents as US dollars, e.g. `123456`
 * as `"$1,234.56"`. Exact for every safe integer: the whole dollars and the
 * cents are split with integer arithmetic instead of formatting `cents / 100`,
 * which loses a cent above about $70 trillion.
 *
 * @throws RangeError if `cents` is negative or not a safe integer.
 */
export function formatUsd(cents: number): string {
  assertNonNegativeSafeInteger(cents, 'cents');
  const remainder = cents % 100;
  const dollars = (cents - remainder) / 100;
  const centDigits = String(remainder).padStart(2, '0');
  return usd
    .formatToParts(dollars)
    .map((part) => (part.type === 'fraction' ? centDigits : part.value))
    .join('');
}

/**
 * Formats a number of whole shares, e.g. `"1 share"` or `"12,345 shares"`.
 *
 * @throws RangeError if `shares` is negative or not a safe integer.
 */
export function formatShares(shares: number): string {
  assertNonNegativeSafeInteger(shares, 'shares');
  return `${wholeNumber.format(shares)} ${shares === 1 ? 'share' : 'shares'}`;
}

/**
 * Formats a second, given as Unix epoch seconds, as a UTC date and time to the
 * second, e.g. `1762178709` as `"Nov 3, 2025, 14:05:09 UTC"`.
 *
 * @throws RangeError if `epochSeconds` is not a safe integer or lies outside
 * the range a `Date` can hold.
 */
export function formatUtcDateTime(epochSeconds: number): string {
  if (!Number.isSafeInteger(epochSeconds)) {
    throw new RangeError(
      `epochSeconds must be a safe integer, got ${epochSeconds}`,
    );
  }
  return utcDateTime.format(new Date(epochSeconds * 1000));
}

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${name} must be a non-negative safe integer, got ${value}`,
    );
  }
}
