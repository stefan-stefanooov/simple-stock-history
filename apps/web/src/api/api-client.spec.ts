import type {
  BestTradeResponse,
  PeriodResponse,
  ProblemDetails,
} from '@simple-stock-history/shared';
import {
  ApiError,
  getBestTrade,
  getPeriod,
  ProblemError,
  UnexpectedResponseError,
} from './api-client';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    ...init,
  });
}

function problemResponse(problem: ProblemDetails): Response {
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
  });
}

/** Resolves to what the promise rejected with, failing the test if it resolved. */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

const period: PeriodResponse = {
  share: 'ACME',
  from: 1761955200,
  to: 1764547199,
  currency: 'USD',
};

// The first day of the Data Period.
const from = 1761955200;
const to = 1762041599;

const bestTrade: BestTradeResponse = {
  from,
  to,
  currency: 'USD',
  trade: {
    buy: { time: 1761960000, priceCents: 10012 },
    sell: { time: 1762030000, priceCents: 10357 },
    profitCents: 345,
  },
};

describe('getPeriod', () => {
  it('returns the Share and the Data Period', async () => {
    fetchMock.mockResolvedValue(jsonResponse(period));

    await expect(getPeriod()).resolves.toEqual(period);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/period', expect.anything());
  });

  it('names every field that breaks the contract', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...period, from: '1761955200', currency: 'EUR' }),
    );

    const error = await rejectionOf(getPeriod());

    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toMatch(
      /^The API sent an unexpected response to GET \/api\/v1\/period\. from: .+\. currency: .+\.$/,
    );
    expect((error as ApiError).status).toBe(200);
  });

  it('rejects a body that is not JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('<!doctype html><title>Simple Stock History</title>', {
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const error = await rejectionOf(getPeriod());

    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect(error).toMatchObject({
      message:
        'The API sent an unexpected response to GET /api/v1/period. The body is not JSON.',
      cause: expect.any(SyntaxError),
    });
  });
});

describe('getBestTrade', () => {
  it('asks for the Time Slice with from and to in epoch seconds', async () => {
    fetchMock.mockResolvedValue(jsonResponse(bestTrade));

    await getBestTrade(from, to);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/trades/best?from=1761955200&to=1762041599',
      expect.anything(),
    );
  });

  it('returns the Best Trade', async () => {
    fetchMock.mockResolvedValue(jsonResponse(bestTrade));

    await expect(getBestTrade(from, to)).resolves.toEqual(bestTrade);
  });

  it('returns trade: null for No Profitable Trade', async () => {
    const none = { ...bestTrade, trade: null };
    fetchMock.mockResolvedValue(jsonResponse(none));

    await expect(getBestTrade(from, to)).resolves.toEqual(none);
  });

  it('rejects a Trade whose Profit is not the price difference', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...bestTrade,
        trade: { ...bestTrade.trade, profitCents: 344 },
      }),
    );

    await expect(getBestTrade(from, to)).rejects.toThrow(
      "The API sent an unexpected response to GET /api/v1/trades/best?from=1761955200&to=1762041599. trade.profitCents: Profit must equal the Sell Point's price minus the Buy Point's.",
    );
  });

  it('rejects a Trade that buys before the Time Slice', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...bestTrade,
        trade: {
          ...bestTrade.trade,
          buy: { time: from - 1, priceCents: 10012 },
        },
      }),
    );

    await expect(getBestTrade(from, to)).rejects.toThrow(
      /\. trade: Trade must lie within the Time Slice\.$/,
    );
  });

  it('turns a 400 with issues into a message listing each one', async () => {
    const badRequest: ProblemDetails = {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'The query is invalid.',
      instance: '/api/v1/trades/best?from=1761955200&to=1764547200',
      issues: [
        { path: ['to'], message: 'Must lie within the Data Period' },
        { path: [], message: 'from must not be after to' },
      ],
    };
    fetchMock.mockResolvedValue(problemResponse(badRequest));

    const error = await rejectionOf(getBestTrade(from, 1764547200));

    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message:
        'The query is invalid. to: Must lie within the Data Period. from must not be after to.',
      status: 400,
      problem: badRequest,
    });
  });

  it('turns a 422 for a Time Slice shorter than 2 seconds into its detail', async () => {
    fetchMock.mockResolvedValue(
      problemResponse({
        type: 'about:blank',
        title: 'Unprocessable Content',
        status: 422,
        detail: 'A Time Slice must be at least 2 seconds long',
      }),
    );

    const error = await rejectionOf(getBestTrade(from, from));

    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toMatchObject({
      message: 'A Time Slice must be at least 2 seconds long.',
      status: 422,
    });
  });

  it('falls back to the title of a problem without detail', async () => {
    fetchMock.mockResolvedValue(
      problemResponse({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
      }),
    );

    const error = await rejectionOf(getBestTrade(from, to));

    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toMatchObject({
      message: 'Internal Server Error.',
      status: 500,
    });
  });

  it('reports the HTTP status of an error that is not problem+json', async () => {
    fetchMock.mockResolvedValue(
      new Response('Too Many Requests', {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const error = await rejectionOf(getBestTrade(from, to));

    expect(error).not.toBeInstanceOf(ProblemError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: 'The API answered with HTTP 429 Too Many Requests.',
      status: 429,
    });
  });

  it('reports the HTTP status of problem+json that breaks the contract', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ statusCode: 502, message: 'Bad Gateway' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    );

    const error = await rejectionOf(getBestTrade(from, to));

    expect(error).not.toBeInstanceOf(ProblemError);
    expect(error).toMatchObject({
      message: 'The API answered with HTTP 502.',
      status: 502,
    });
  });

  it('reports an API that cannot be reached', async () => {
    const offline = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValue(offline);

    const error = await rejectionOf(getBestTrade(from, to));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: 'Could not reach the API. Check your connection.',
      status: undefined,
      cause: offline,
    });
  });

  it('rejects with the abort reason, not an ApiError, when cancelled', async () => {
    const controller = new AbortController();
    const reason = new DOMException('Left the page', 'AbortError');
    fetchMock.mockImplementation(
      (_, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new TypeError('Failed to fetch')),
          );
        }),
    );

    const pending = getBestTrade(from, to, { signal: controller.signal });
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });

  it.each([
    ['a fractional from', 1761955200.5, to],
    ['a negative to', from, -1],
  ])('refuses %s without asking the API', async (_, badFrom, badTo) => {
    const error = await rejectionOf(getBestTrade(badFrom, badTo));

    expect(error).toBeInstanceOf(RangeError);
    expect((error as RangeError).message).toMatch(
      /^A Time Slice is given in whole Unix epoch seconds\. (from|to): .+\.$/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
