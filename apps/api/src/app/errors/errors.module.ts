import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { createZodValidationPipe } from 'nestjs-zod';
import { ProblemDetailsFilter } from './problem-details.filter';

/**
 * Validates every `@Query()`, `@Param()` and `@Body()` against its zod DTO
 * (see `dtos.ts`). Strict: such a parameter typed with anything but a DTO
 * fails with a 500, so no request value reaches a handler unchecked.
 * `@Req()`, `@Res()` and `@Headers()` are not validated.
 */
const ZodValidationPipe = createZodValidationPipe({
  strictSchemaDeclaration: true,
});

/**
 * Request validation and RFC 9457 problem+json errors for the whole API:
 * a global {@link ZodValidationPipe} and the global
 * {@link ProblemDetailsFilter}.
 */
@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class ErrorsModule {}
