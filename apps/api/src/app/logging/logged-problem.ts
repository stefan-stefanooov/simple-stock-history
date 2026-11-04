import type { ProblemDetails } from '@simple-stock-history/shared';

/** What a request's log line says about the problem the API answered with. */
export type LoggedProblem = Pick<ProblemDetails, 'detail' | 'issues'>;

const problems = new WeakMap<object, LoggedProblem>();

/**
 * Records the problem a response answers with, so the request's log line
 * says why it failed, not only its status. Called by the
 * `ProblemDetailsFilter`; read by the request log's `res` serializer.
 */
export function logProblem(response: object, problem: LoggedProblem): void {
  problems.set(response, problem);
}

/** The problem recorded for `response`, if it answered with one. */
export function loggedProblemOf(response: object): LoggedProblem | undefined {
  return problems.get(response);
}
