import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiResponse,
  type ApiResponseOptions,
  type ContentObject,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  PROBLEM_JSON_MEDIA_TYPE,
  type ProblemDetails,
} from '@simple-stock-history/shared';
import { ProblemDetailsDto } from '../dtos';

/**
 * Named example bodies of an error response, shown in Swagger UI, e.g.
 * `{ fromAfterTo: { summary: 'from is after to', value: { ... } } }`.
 */
export type ProblemExamples = Record<
  string,
  { summary: string; value: ProblemDetails }
>;

/**
 * The body of every error response: `application/problem+json` matching
 * `ProblemDetailsDto`, the shape `ProblemDetailsFilter` answers with.
 */
export const PROBLEM_CONTENT: ContentObject = {
  [PROBLEM_JSON_MEDIA_TYPE]: {
    schema: { $ref: getSchemaPath(ProblemDetailsDto) },
  },
};

/**
 * The OpenAPI description of an error response with a problem+json body,
 * with example bodies if given.
 */
export function problemResponse(
  status: number,
  description: string,
  examples?: ProblemExamples,
): ApiResponseOptions {
  if (!examples) return { status, description, content: PROBLEM_CONTENT };
  return {
    status,
    description,
    content: {
      [PROBLEM_JSON_MEDIA_TYPE]: {
        ...PROBLEM_CONTENT[PROBLEM_JSON_MEDIA_TYPE],
        examples,
      },
    },
  };
}

/**
 * Documents that a route can answer with `status` and a problem+json body,
 * e.g. `@ApiProblemResponse(422, 'The Time Slice is shorter than 2 seconds')`,
 * optionally with example bodies.
 * `setupSwagger` already documents a 500 on every route, and a 400 on every
 * route that takes parameters or a body, so only the other errors a route
 * returns on purpose need this, or a 400 with a more specific description.
 */
export function ApiProblemResponse(
  status: number,
  description: string,
  examples?: ProblemExamples,
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(ProblemDetailsDto),
    ApiResponse(problemResponse(status, description, examples)),
  );
}
