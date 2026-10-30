import { z } from 'zod';

/** The ticker of the Share, the single stock the service holds. */
export const ShareSchema = z.literal('ACME').describe('Ticker of the Share');

export type Share = z.infer<typeof ShareSchema>;

/** The currency every price and Profit is given in. */
export const CurrencySchema = z
  .literal('USD')
  .describe('ISO 4217 currency of every amount');

export type Currency = z.infer<typeof CurrencySchema>;
