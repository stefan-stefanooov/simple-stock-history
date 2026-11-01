import { z } from 'zod';

const Sha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, { error: 'must be a sha256 in lowercase hex' });

/**
 * The parts of the generator's `<name>.meta.json` the API relies on. The
 * generator writes more (`seed`, `generatorVersion`), which is ignored. The
 * API checks the file here rather than importing the generator's types from
 * `tools/`, which is not part of the API's runtime.
 */
export const PriceHistoryMetaSchema = z.object({
  /** First second of the Data Period, Unix epoch seconds (UTC). */
  dataPeriodStart: z.int().nonnegative(),
  /** Number of Price Points, one per second from `dataPeriodStart`. */
  count: z.int().positive(),
  /** sha256 of the Price History file. */
  sha256: Sha256Schema,
  /** Price Points per hour summary; the summaries file does not store it. */
  hourLength: z.int().positive(),
  /** sha256 of the hour summaries file. */
  hourSummariesSha256: Sha256Schema,
});

export type PriceHistoryMeta = z.infer<typeof PriceHistoryMetaSchema>;
