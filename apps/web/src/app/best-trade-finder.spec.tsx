import type { BestTradeResponse, Trade } from '@simple-stock-history/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { getBestTrade, ProblemError } from '../api/api-client';
import { BestTradeFinder } from './best-trade-finder';
import { UNEXPECTED_ERROR_MESSAGE } from './error-message';

vi.mock('../api/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/api-client')>()),
  getPeriod: vi.fn(),
  getBestTrade: vi.fn(),
}));

// November 2025 UTC, as served by GET /api/v1/period
const NOVEMBER = { from: 1761955200, to: 1764547199 };
const DAY = 86_400;
const NOV_5 = NOVEMBER.from + 4 * DAY;
const NOV_7 = NOVEMBER.from + 6 * DAY;

/** The Time Slice of November 5th, 00:00:00 to 23:59:59 UTC. */
const NOV_5_WHOLE_DAY = { from: NOV_5, to: NOV_5 + DAY - 1 };

/** Buys at 08:15:01 for $100.12 and sells at 14:05:09 for $103.57. */
const trade: Trade = {
  buy: { time: NOV_5 + 8 * 3600 + 15 * 60 + 1, priceCents: 10012 },
  sell: { time: NOV_5 + 14 * 3600 + 5 * 60 + 9, priceCents: 10357 },
  profitCents: 345,
};

function bestTradeResponse(
  timeSlice: { from: number; to: number },
  bestTrade: Trade | null,
): BestTradeResponse {
  return { ...timeSlice, currency: 'USD', trade: bestTrade };
}

/** A promise to settle from the test, to look at the page while a query runs. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.mocked(getBestTrade).mockReset();
});

function renderFinder() {
  return render(<BestTradeFinder dataPeriod={NOVEMBER} />);
}

/** The calendar button for a day, by the date in its accessible name. */
function day(date: string) {
  return screen.getByRole('button', { name: new RegExp(`${date}, 2025`) });
}

function fundsInput() {
  return screen.getByLabelText('Available Funds (USD)');
}

function enterFunds(value: string) {
  fireEvent.change(fundsInput(), { target: { value } });
}

function findBestTradeButton() {
  return screen.getByRole('button', { name: 'Find best trade' });
}

function pressFindBestTrade() {
  fireEvent.click(findBestTradeButton());
}

function resultRegion() {
  return screen.getByRole('region', { name: 'Result' });
}

/** The text of each paragraph of the result, so sentences are compared whole. */
function resultParagraphs() {
  return Array.from(resultRegion().querySelectorAll('p'), (p) => p.textContent);
}

/** Picks November 5th and enters the funds, then presses the button. */
function queryNov5With(funds: string) {
  fireEvent.click(day('November 5th'));
  enterFunds(funds);
  pressFindBestTrade();
}

describe('BestTradeFinder', () => {
  it('asks for the Best Trade only when the button is pressed', async () => {
    vi.mocked(getBestTrade).mockResolvedValue(
      bestTradeResponse(NOV_5_WHOLE_DAY, trade),
    );
    renderFinder();

    fireEvent.click(day('November 5th'));
    enterFunds('1,000');
    expect(getBestTrade).not.toHaveBeenCalled();
    expect(resultRegion().textContent).toBe('');

    pressFindBestTrade();

    expect(getBestTrade).toHaveBeenCalledTimes(1);
    expect(getBestTrade).toHaveBeenCalledWith(
      NOV_5_WHOLE_DAY.from,
      NOV_5_WHOLE_DAY.to,
      { signal: expect.any(AbortSignal) },
    );
    await screen.findByRole('heading', { name: 'Best Trade' });
  });

  it('does not point out missing input before the first press', () => {
    renderFinder();

    expect(screen.queryByRole('alert')).toBe(null);
    expect(fundsInput().getAttribute('aria-invalid')).toBe('false');
  });

  it('asks for a Time Slice and Available Funds instead of querying without them', () => {
    renderFinder();

    pressFindBestTrade();

    expect(getBestTrade).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole('alert').map((alert) => alert.textContent),
    ).toEqual([
      'Pick a valid Time Slice above.',
      'Enter your Available Funds.',
    ]);
    expect(fundsInput().getAttribute('aria-invalid')).toBe('true');
    expect(fundsInput().getAttribute('aria-describedby')).toContain(
      screen.getByText('Enter your Available Funds.').id,
    );
  });

  it('checks the Available Funds as they are typed once the button was pressed', () => {
    renderFinder();
    fireEvent.click(day('November 5th'));
    pressFindBestTrade();

    enterFunds('12.345');
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter at most 2 decimal places (whole cents).',
    );

    enterFunds('12.34');
    expect(screen.queryByRole('alert')).toBe(null);
    expect(fundsInput().getAttribute('aria-invalid')).toBe('false');
    expect(getBestTrade).not.toHaveBeenCalled();
  });

  it('shows that the query runs and ignores presses until it is done', async () => {
    const response = deferred<BestTradeResponse>();
    vi.mocked(getBestTrade).mockReturnValue(response.promise);
    renderFinder();

    queryNov5With('1,000');

    expect(resultRegion().textContent).toBe('Finding the Best Trade…');
    expect(findBestTradeButton().getAttribute('aria-disabled')).toBe('true');
    pressFindBestTrade();
    expect(getBestTrade).toHaveBeenCalledTimes(1);

    response.resolve(bestTradeResponse(NOV_5_WHOLE_DAY, trade));

    await screen.findByRole('heading', { name: 'Best Trade' });
    expect(findBestTradeButton().getAttribute('aria-disabled')).toBe('false');
  });

  it('tells when to buy and sell, how many shares and the Profit', async () => {
    vi.mocked(getBestTrade).mockResolvedValue(
      bestTradeResponse(NOV_5_WHOLE_DAY, trade),
    );
    renderFinder();

    queryNov5With('1,000');

    await screen.findByRole('heading', { name: 'Best Trade' });
    // $1,000.00 buys 9 shares at $100.12 ($901.08), leaving $98.92; they sell
    // at $103.57 for $932.13, a Profit of 9 × $3.45 = $31.05.
    expect(resultParagraphs()).toEqual([
      'Between Nov 5, 2025, 00:00:00 UTC and Nov 5, 2025, 23:59:59 UTC, you should have bought 9 shares on Nov 5, 2025, 08:15:01 UTC at $100.12 a share, spending $901.08.',
      'You should then have sold them on Nov 5, 2025, 14:05:09 UTC at $103.57 a share, for $932.13.',
      'That is a Profit of $31.05 ($3.45 a share), with $98.92 of your $1,000.00 left unspent.',
    ]);
  });

  it('marks up every date and time as a machine-readable UTC second', async () => {
    vi.mocked(getBestTrade).mockResolvedValue(
      bestTradeResponse(NOV_5_WHOLE_DAY, trade),
    );
    renderFinder();

    queryNov5With('1,000');

    await screen.findByRole('heading', { name: 'Best Trade' });
    expect(
      Array.from(resultRegion().querySelectorAll('time'), (time) =>
        time.getAttribute('datetime'),
      ),
    ).toEqual([
      '2025-11-05T00:00:00Z',
      '2025-11-05T23:59:59Z',
      '2025-11-05T08:15:01Z',
      '2025-11-05T14:05:09Z',
    ]);
  });

  it('speaks of a single share as "it"', async () => {
    vi.mocked(getBestTrade).mockResolvedValue(
      bestTradeResponse(NOV_5_WHOLE_DAY, trade),
    );
    renderFinder();

    queryNov5With('100.12');

    await screen.findByRole('heading', { name: 'Best Trade' });
    expect(resultParagraphs()).toEqual([
      'Between Nov 5, 2025, 00:00:00 UTC and Nov 5, 2025, 23:59:59 UTC, you should have bought 1 share on Nov 5, 2025, 08:15:01 UTC at $100.12 a share, spending $100.12.',
      'You should then have sold it on Nov 5, 2025, 14:05:09 UTC at $103.57 a share, for $103.57.',
      'That is a Profit of $3.45 ($3.45 a share), with $0.00 of your $100.12 left unspent.',
    ]);
  });

  it('still shows the Best Trade when the Available Funds cannot buy one share', async () => {
    vi.mocked(getBestTrade).mockResolvedValue(
      bestTradeResponse(NOV_5_WHOLE_DAY, trade),
    );
    renderFinder();

    queryNov5With('50');

    await screen.findByRole('heading', { name: 'Best Trade' });
    expect(resultParagraphs()).toEqual([
      'Between Nov 5, 2025, 00:00:00 UTC and Nov 5, 2025, 23:59:59 UTC, the Best Trade buys on Nov 5, 2025, 08:15:01 UTC at $100.12 a share and sells on Nov 5, 2025, 14:05:09 UTC at $103.57 a share, a Profit of $3.45 a share.',
      'Your Available Funds of $50.00 do not cover the price of one share, so you could not have bought any.',
    ]);
  });

  it('reports No Profitable Trade', async () => {
    vi.mocked(getBestTrade).mockResolvedValue(
      bestTradeResponse(NOV_5_WHOLE_DAY, null),
    );
    renderFinder();

    queryNov5With('1,000');

    await screen.findByRole('heading', { name: 'No Profitable Trade' });
    expect(resultParagraphs()).toEqual([
      'Between Nov 5, 2025, 00:00:00 UTC and Nov 5, 2025, 23:59:59 UTC, the price never rose, so no Trade would have made a Profit.',
      'You should not have bought at all.',
    ]);
  });

  it('shows why the API refused the query', async () => {
    vi.mocked(getBestTrade).mockRejectedValue(
      new ProblemError(422, {
        type: 'about:blank',
        title: 'Unprocessable Content',
        status: 422,
        detail: 'A Time Slice must be at least 2 seconds long',
      }),
    );
    renderFinder();

    queryNov5With('1,000');

    await waitFor(() =>
      expect(resultRegion().textContent).toBe(
        'Could not find the Best Trade. A Time Slice must be at least 2 seconds long.',
      ),
    );
    expect(findBestTradeButton().getAttribute('aria-disabled')).toBe('false');
  });

  it('shows a generic message for a failure that is not an ApiError', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.mocked(getBestTrade).mockResolvedValue(
      // Contract-valid but absurd: 100,000,000 shares at 1¢, each making
      // about $90 billion, a total Profit too large to be exact.
      bestTradeResponse(NOV_5_WHOLE_DAY, {
        buy: { time: trade.buy.time, priceCents: 1 },
        sell: { time: trade.sell.time, priceCents: 9e12 + 1 },
        profitCents: 9e12,
      }),
    );
    renderFinder();

    queryNov5With('100,000,000');

    await waitFor(() =>
      expect(resultRegion().textContent).toBe(
        `Could not find the Best Trade. ${UNEXPECTED_ERROR_MESSAGE}`,
      ),
    );
    expect(consoleError).toHaveBeenCalledWith(expect.any(RangeError));
    consoleError.mockRestore();
  });

  it('keeps the result of the last press until the button is pressed again', async () => {
    vi.mocked(getBestTrade).mockResolvedValueOnce(
      bestTradeResponse(NOV_5_WHOLE_DAY, trade),
    );
    renderFinder();
    queryNov5With('1,000');
    await screen.findByRole('heading', { name: 'Best Trade' });
    const firstResult = resultRegion().textContent;

    fireEvent.click(day('November 7th'));
    enterFunds('50');
    expect(resultRegion().textContent).toBe(firstResult);
    expect(getBestTrade).toHaveBeenCalledTimes(1);

    const nov5To7 = { from: NOV_5, to: NOV_7 + DAY - 1 };
    vi.mocked(getBestTrade).mockResolvedValueOnce(
      bestTradeResponse(nov5To7, null),
    );
    pressFindBestTrade();

    expect(getBestTrade).toHaveBeenLastCalledWith(
      nov5To7.from,
      nov5To7.to,
      expect.anything(),
    );
    await screen.findByRole('heading', { name: 'No Profitable Trade' });
    expect(resultParagraphs()[0]).toBe(
      'Between Nov 5, 2025, 00:00:00 UTC and Nov 7, 2025, 23:59:59 UTC, the price never rose, so no Trade would have made a Profit.',
    );
  });

  it('cancels the query in flight when it goes away', () => {
    vi.mocked(getBestTrade).mockReturnValue(new Promise(() => undefined));
    const { unmount } = renderFinder();

    queryNov5With('1,000');

    const [, , { signal } = {}] = vi.mocked(getBestTrade).mock.calls[0];
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
