import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  PROBLEM_JSON_MEDIA_TYPE,
  type ProblemDetails,
  type ValidationIssue,
} from '@simple-stock-history/shared';
import { ZodValidationException } from 'nestjs-zod';
import { STATUS_CODES } from 'node:http';
import { z } from 'zod';
import {
  INVALID_REQUEST_DETAIL,
  InvalidRequestException,
} from './invalid-request.exception';

/** The `detail` of a 500 for an error the API did not expect. */
export const UNEXPECTED_ERROR_DETAIL =
  'The API failed to answer this request; the error has been logged.';

const INTERNAL_SERVER_ERROR = 500;

/** What a problem says, before the parts every problem shares are added. */
type Problem = Pick<ProblemDetails, 'status' | 'detail' | 'issues'>;

/**
 * Turns every error that leaves the API into an RFC 9457
 * `application/problem+json` response (`ProblemDetails` in libs/shared):
 *
 * - schema failures from the `ZodValidationPipe` and
 *   {@link InvalidRequestException}: 400 with the list of `issues`
 * - other `HttpException`s, unknown routes (404) included: their status, and
 *   their message as `detail`
 * - client errors from Express's body parser, e.g. a body over the size
 *   limit: their status and message
 * - anything else: 500 with a generic `detail`. The error and its stack go to
 *   the log only, never into the response.
 *
 * Every 500 is logged with its error, since it means something broke; a
 * deliberate 503 is not. Error responses are never cached, whatever
 * `Cache-Control` the route sets for its successful responses.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const http = host.switchToHttp();
    const response = http.getResponse();

    const problem = this.toProblem(exception);
    if (problem.status === INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception },
        `Answered ${problem.status}: ${describe(exception)}`,
      );
    }

    // Too late for an error response; end the one already under way.
    if (httpAdapter.isHeadersSent(response)) {
      httpAdapter.end(response);
      return;
    }

    const body: ProblemDetails = {
      type: 'about:blank',
      title: STATUS_CODES[problem.status] ?? 'Error',
      status: problem.status,
      detail: problem.detail,
      instance: httpAdapter.getRequestUrl(http.getRequest()),
      issues: problem.issues,
    };
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_JSON_MEDIA_TYPE);
    httpAdapter.setHeader(response, 'Cache-Control', 'no-store');
    // Sent as a string: for an object body the adapter would reset any
    // Content-Type that is not application/json.
    httpAdapter.reply(response, JSON.stringify(body), problem.status);
  }

  private toProblem(exception: unknown): Problem {
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      // The pipe wraps anything a schema throws; only a ZodError is bad input.
      if (zodError instanceof z.core.$ZodError) {
        return invalidRequest(zodError.issues.map(toValidationIssue));
      }
      return unexpectedError();
    }
    if (exception instanceof InvalidRequestException) {
      return invalidRequest([...exception.issues]);
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return { status, detail: detailOf(exception, status) };
    }
    if (isClientHttpError(exception)) {
      return { status: exception.status, detail: exception.message };
    }
    return unexpectedError();
  }
}

function invalidRequest(issues: ValidationIssue[]): Problem {
  return { status: 400, detail: INVALID_REQUEST_DETAIL, issues };
}

function unexpectedError(): Problem {
  return { status: INTERNAL_SERVER_ERROR, detail: UNEXPECTED_ERROR_DETAIL };
}

function toValidationIssue(issue: z.core.$ZodIssue): ValidationIssue {
  return {
    path: issue.path.map((key) =>
      typeof key === 'number' ? key : String(key),
    ),
    message: issue.message,
  };
}

/**
 * The message an `HttpException` was thrown with, e.g. `Cannot GET /api/x`.
 * Left out when it only repeats the status's title, as in
 * `new NotFoundException()`.
 */
function detailOf(
  exception: HttpException,
  status: number,
): string | undefined {
  const response = exception.getResponse();
  const message =
    typeof response === 'string'
      ? response
      : (response as { message?: unknown }).message;
  if (typeof message !== 'string' || message === STATUS_CODES[status]) {
    return undefined;
  }
  return message;
}

/**
 * An `http-errors` error meant for the client, as Express's body parser
 * throws for a body that is too large or in an unsupported encoding.
 */
function isClientHttpError(
  error: unknown,
): error is Error & { status: number; expose: true } {
  if (!(error instanceof Error)) return false;
  const { status, expose } = error as { status?: unknown; expose?: unknown };
  return (
    expose === true &&
    typeof status === 'number' &&
    Number.isInteger(status) &&
    status >= 400 &&
    status < 500
  );
}

function describe(exception: unknown): string {
  return exception instanceof Error
    ? `${exception.name}: ${exception.message}`
    : String(exception);
}
