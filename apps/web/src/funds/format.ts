/**
 * Formatting of the amounts and share counts shown to the user. The locale is
 * fixed to `en-US`, so the output never depends on the browser's language.
 * Dates and times are formatted by `formatUtcDateTime` in `../date-time`.
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

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${name} must be a non-negative safe integer, got ${value}`,
    );
  }
}
