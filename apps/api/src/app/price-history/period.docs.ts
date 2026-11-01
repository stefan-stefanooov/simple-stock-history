import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { PeriodResponseDto } from '../dtos';

/** The OpenAPI docs of `GET /api/v1/period`: what it answers. */
export function ApiPeriod(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'The Share and the Data Period its Price History covers',
      description:
        'Every Time Slice asked about must lie within `from` and `to`, both included.',
    }),
    ApiOkResponse({ type: PeriodResponseDto.Output }),
  );
}
