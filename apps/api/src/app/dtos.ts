import {
  BestTradeQuerySchema,
  BestTradeResponseSchema,
  PeriodResponseSchema,
  ProblemDetailsSchema,
} from '@simple-stock-history/shared';
import { createZodDto } from 'nestjs-zod';

/*
 * Nest DTO classes over the shared zod schemas, the single definition of the
 * API contract. Type a handler's parameter with one, e.g.
 * `@Query() timeSlice: BestTradeQueryDto`, and the global ZodValidationPipe
 * (`ErrorsModule`) parses the request with its schema; bad input is answered
 * with a 400 problem+json listing the issues.
 */

/** `GET /api/v1/trades/best?from=&to=`: the Time Slice, decoded to numbers. */
export class BestTradeQueryDto extends createZodDto(BestTradeQuerySchema) {}

/** The Best Trade in a Time Slice, or `trade: null` for No Profitable Trade. */
export class BestTradeResponseDto extends createZodDto(
  BestTradeResponseSchema,
) {}

/** The Share and the Data Period its Price History covers. */
export class PeriodResponseDto extends createZodDto(PeriodResponseSchema) {}

/** The `application/problem+json` body of every error response. */
export class ProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
