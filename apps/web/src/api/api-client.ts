import {
  BestTradeQuerySchema,
  BestTradeResponseSchema,
  PeriodResponseSchema,
  PROBLEM_JSON_MEDIA_TYPE,
  ProblemDetailsSchema,
  type BestTradeResponse,
  type EpochSeconds,
  type PeriodResponse,
  type ProblemDetails,
} from '@simple-stock-history/shared';

/** Options every request accepts. */
export interface RequestOptions {
  /**
   * Cancels the request. The promise then rejects with the signal's reason
   * (an `AbortError` by default), never with an {@link ApiError}.
   */
  signal?: AbortSignal;
}

/**
 * Any failure to get an answer from the API that matches the shared
 * contract. `message` is readable and can be shown to the user as is.
 */
export class ApiError extends Error {
  override name = 'ApiError';

  /** HTTP status of the response, or `undefined` if none arrived. */
  readonly status: number | undefined;

  constructor(message: string, options: { status?: number; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.status = options.status;
  }
}

/**
 * The API rejected the request with RFC 9457 problem details: 400 for bad
 * input (listed in `problem.issues`), 422 for a Time Slice shorter than
 * 2 seconds.
 */
export class ProblemError extends ApiError {
  override name = 'ProblemError';

  declare readonly status: number;

  constructor(
    status: number,
    readonly problem: ProblemDetails,
  ) {
    super(
      sentences(
        problem.detail ?? problem.title,
        ...(problem.issues ?? []).map(describeIssue),
      ),
      { status },
    );
  }
}

/** The API answered with success, but its body breaks the shared contract. */
export class UnexpectedResponseError extends ApiError {
  override name = 'UnexpectedResponseError';

  declare readonly status: number;

  constructor(
    request: string,
    status: number,
    reasons: readonly string[],
    cause: unknown,
  ) {
    super(
      sentences(
        `The API sent an unexpected response to ${request}`,
        ...reasons,
      ),
      { status, cause },
    );
  }
}

/** `GET /api/v1/period`: the Share and the Data Period its Price History covers. */
export function getPeriod(
  options: RequestOptions = {},
): Promise<PeriodResponse> {
  return request('/api/v1/period', PeriodResponseSchema, options);
}

/**
 * `GET /api/v1/trades/best`: the Best Trade in the Time Slice from `from` to
 * `to`, Unix epoch seconds, both ends included; `trade` is `null` for No
 * Profitable Trade. Whether the Time Slice lies within the Data Period is
 * checked by the API, which answers with a {@link ProblemError}.
 *
 * Rejects with a `RangeError`, without asking the API, if `from` or `to` is
 * not a whole, non-negative number of seconds.
 */
export async function getBestTrade(
  from: EpochSeconds,
  to: EpochSeconds,
  options: RequestOptions = {},
): Promise<BestTradeResponse> {
  const query = BestTradeQuerySchema.safeEncode({ from, to });
  if (!query.success) {
    throw new RangeError(
      sentences(
        'A Time Slice is given in whole Unix epoch seconds',
        ...query.error.issues.map(describeIssue),
      ),
    );
  }
  const search = new URLSearchParams(query.data);
  return request(
    `/api/v1/trades/best?${search}`,
    BestTradeResponseSchema,
    options,
  );
}

/** One thing wrong with a value, as both zod and `ProblemDetails` report it. */
interface Issue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/**
 * The part of a zod schema the client needs, so the web app gets by without
 * depending on zod itself.
 */
interface ResponseSchema<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly Issue[] } };
}

const ACCEPT = `application/json, ${PROBLEM_JSON_MEDIA_TYPE}`;

async function request<T>(
  path: string,
  schema: ResponseSchema<T>,
  { signal }: RequestOptions,
): Promise<T> {
  try {
    return await exchange(path, schema, signal);
  } catch (error) {
    // Whatever failed once the request was cancelled failed because of it.
    if (signal?.aborted) throw signal.reason;
    throw error;
  }
}

async function exchange<T>(
  path: string,
  schema: ResponseSchema<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  const request = `GET ${path}`;

  let response: Response;
  try {
    response = await fetch(path, { headers: { Accept: ACCEPT }, signal });
  } catch (error) {
    throw new ApiError('Could not reach the API. Check your connection.', {
      cause: error,
    });
  }

  if (!response.ok) throw await rejection(response);

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new UnexpectedResponseError(
      request,
      response.status,
      ['The body is not JSON'],
      error,
    );
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new UnexpectedResponseError(
      request,
      response.status,
      result.error.issues.map(describeIssue),
      result.error,
    );
  }
  return result.data;
}

/** The error for a response with a status outside 200–299. */
async function rejection(response: Response): Promise<ApiError> {
  const problem = await readProblem(response);
  if (problem) return new ProblemError(response.status, problem);
  const status = `${response.status} ${response.statusText}`.trim();
  return new ApiError(`The API answered with HTTP ${status}.`, {
    status: response.status,
  });
}

/** The problem details in the body, if it is a valid `application/problem+json` one. */
async function readProblem(
  response: Response,
): Promise<ProblemDetails | undefined> {
  const mediaType = response.headers
    .get('Content-Type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== PROBLEM_JSON_MEDIA_TYPE) return undefined;
  const body: unknown = await response.json().catch(() => undefined);
  const result = ProblemDetailsSchema.safeParse(body);
  return result.success ? result.data : undefined;
}

/** `from: Required`, or just the message for an issue with the value as a whole. */
function describeIssue({ path, message }: Issue): string {
  return path.length === 0
    ? message
    : `${path.map(String).join('.')}: ${message}`;
}

/** Joins the parts into sentences, ending each one with a full stop if it has none. */
function sentences(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
    .join(' ');
}
