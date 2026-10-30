import { z } from 'zod';
import { CurrencySchema, ShareSchema } from './share.js';
import { EpochSecondsSchema } from './time.js';

/** `GET /api/v1/period`: the Share and the Data Period its Price History covers. */
export const PeriodResponseSchema = z.object({
  share: ShareSchema,
  from: EpochSecondsSchema.describe('First second of the Data Period'),
  to: EpochSecondsSchema.describe('Last second of the Data Period, included'),
  currency: CurrencySchema,
});

export type PeriodResponse = z.infer<typeof PeriodResponseSchema>;
