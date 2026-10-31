import { formatUsd } from './format';

/**
 * The most Available Funds accepted: $100,000,000.00. Far above anything a
 * user means to spend, and low enough that every amount derived from it stays
 * an exact integer number of cents: the Price History starts at $100.00 and
 * moves at most 5¢ a second for a month without going below $1.00, so no share
 * gains more than $129,698.95, and 100,000,000 shares bought at $1.00 make at
 * most about $13 trillion, well below `Number.MAX_SAFE_INTEGER` cents.
 */
export const MAX_AVAILABLE_FUNDS_CENTS = 10_000_000_000;

/** Why the text entered as Available Funds was rejected. */
export type AvailableFundsError =
  'empty' | 'not-a-number' | 'negative' | 'too-many-decimals' | 'too-large';

/**
 * The text entered as Available Funds, parsed: either the amount in cents, or
 * why it was rejected with a message to show the user.
 */
export type ParsedAvailableFunds =
  | { ok: true; cents: number }
  | { ok: false; error: AvailableFundsError; message: string };

const MESSAGES: Record<AvailableFundsError, string> = {
  empty: 'Enter your Available Funds.',
  'not-a-number': 'Enter an amount in US dollars, like 1,000 or 250.50.',
  negative: 'Available Funds cannot be negative.',
  'too-many-decimals': 'Enter at most 2 decimal places (whole cents).',
  'too-large': `Enter at most ${formatUsd(MAX_AVAILABLE_FUNDS_CENTS)}.`,
};

/**
 * An amount in US dollars: an optional minus sign (only so that it can be
 * rejected as negative), an optional `$`, whole dollars either as plain digits
 * or grouped in threes with commas, then optionally a decimal point followed by
 * at least one digit. ASCII digits only.
 */
const AMOUNT =
  /^(?<minus>-?)\$?(?<dollars>[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.(?<fraction>[0-9]+))?$/;

/**
 * Whole dollars with more digits than the maximum are too large; checking the
 * length first keeps `Number()` to strings it converts exactly.
 */
const MAX_DOLLAR_DIGITS = String(MAX_AVAILABLE_FUNDS_CENTS / 100).length;

/**
 * Parses the text entered as Available Funds, in US dollars, into integer
 * cents, without floating-point arithmetic.
 *
 * Accepts `250`, `250.5`, `250.50`, `$1,000.50` and `0` (zero is a valid
 * amount; it buys no shares). Surrounding whitespace is ignored. Rejects:
 * - `empty`: nothing but whitespace.
 * - `not-a-number`: anything else that is not an amount, e.g. `abc`, `1e3`,
 *   `+5`, `.5`, `5.`, `1 000`, `$ 5`, or commas not grouping thousands
 *   (`1,00`, `10,50`).
 * - `negative`: an amount with a leading minus sign, e.g. `-5` or `-$5`.
 * - `too-many-decimals`: more than 2 decimal places, even trailing zeros
 *   (`1.500`), rather than silently rounding the amount.
 * - `too-large`: above {@link MAX_AVAILABLE_FUNDS_CENTS}.
 */
export function parseAvailableFunds(input: string): ParsedAvailableFunds {
  const text = input.trim();
  if (text === '') return rejected('empty');

  const match = AMOUNT.exec(text);
  if (!match?.groups) return rejected('not-a-number');
  const { minus, dollars, fraction = '' } = match.groups;

  if (minus !== '') return rejected('negative');
  if (fraction.length > 2) return rejected('too-many-decimals');

  const dollarDigits = dollars.replace(/,/g, '').replace(/^0+(?=.)/, '');
  if (dollarDigits.length > MAX_DOLLAR_DIGITS) return rejected('too-large');

  const cents = Number(dollarDigits) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents > MAX_AVAILABLE_FUNDS_CENTS) return rejected('too-large');

  return { ok: true, cents };
}

function rejected(error: AvailableFundsError): ParsedAvailableFunds {
  return { ok: false, error, message: MESSAGES[error] };
}
