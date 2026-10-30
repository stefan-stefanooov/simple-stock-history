import { z } from 'zod';

/** A second, as a whole number of seconds since the Unix epoch (UTC). */
export const EpochSecondsSchema = z
  .int()
  .nonnegative()
  .describe('Unix epoch seconds (UTC)');

export type EpochSeconds = z.infer<typeof EpochSecondsSchema>;

const DIGITS_ONLY = /^[0-9]+$/;

/**
 * Unix epoch seconds as they arrive in a query string. Accepts ASCII digits
 * only: no sign, decimal point, exponent or whitespace, and nothing above
 * `Number.MAX_SAFE_INTEGER`. Decodes to a number; `encode` turns the number
 * back into the query-string form.
 */
export const EpochSecondsParamSchema = z
  .codec(
    z
      .string({
        error: (issue) => {
          if (issue.input === undefined) return 'Required';
          if (Array.isArray(issue.input)) return 'Must be given only once';
          return undefined;
        },
      })
      .regex(DIGITS_ONLY, {
        error:
          'Must be Unix epoch seconds written with digits only: no sign, spaces, decimal point or exponent',
        abort: true,
      })
      .refine((digits) => Number.isSafeInteger(Number(digits)), {
        error: `Must be at most ${Number.MAX_SAFE_INTEGER}`,
      }),
    EpochSecondsSchema,
    {
      decode: (digits) => Number(digits),
      encode: (seconds) => String(seconds),
    },
  )
  .describe('Unix epoch seconds (UTC), digits only');
