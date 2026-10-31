import type { BestTradeResponse, Trade } from '@simple-stock-history/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';

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

/** Each figure the result names, e.g. `{ Profit: '$31.05' }`. */
function resultFigures() {
  return Object.fromEntries(
    Array.from(resultRegion().querySelectorAll('dt'), (term) => [
      term.textContent,
      term.nextElementSibling?.textContent,
    ]),
  );
}

/** The Buy Point / Sell Point table, one `[row header, buy, sell]` per row. */
function tradeTable() {
  return Array.from(
    within(resultRegion()).getByRole('table').querySelectorAll('tr'),
    (row) => Array.from(row.cells, (cell) => cell.textContent),
  );
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
    expect(resultRegion().textContent).toBe(
      'Your Best Trade will appear here.Pick a Time Slice, enter your Available Funds and press Find best trade.',
    );

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
    expect(resultFigures()).toEqual({
      Profit: '$31.05',
      'Available Funds': '$1,000.00',
      'Left over': '$98.92',
    });
    expect(resultParagraphs()).toEqual([
      'Time Slice Nov 5, 2025, 00:00:00 UTC to Nov 5, 2025, 23:59:59 UTC',
      '9 shares × $3.45 a share',
      'You should have bought 9 shares on Nov 5, 2025, 08:15:01 UTC and sold them on Nov 5, 2025, 14:05:09 UTC.',
    ]);
    expect(tradeTable()).toEqual([
      ['', 'Buy Point', 'Sell Point'],
      [
        'Date and time',
        'Nov 5, 2025, 08:15:01 UTC',
        'Nov 5, 2025, 14:05:09 UTC',
      ],
      ['Price per share', '$100.12', '$103.57'],
      ['Whole shares', '9 shares', '9 shares'],
      ['Cost / sale total', '$901.08', '$932.13'],
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
      // the Time Slice
      '2025-11-05T00:00:00Z',
      '2025-11-05T23:59:59Z',
      // the sentence
      '2025-11-05T08:15:01Z',
      '2025-11-05T14:05:09Z',
      // the table
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
    expect(resultParagraphs()).toContain(
      'You should have bought 1 share on Nov 5, 2025, 08:15:01 UTC and sold it on Nov 5, 2025, 14:05:09 UTC.',
    );
    expect(resultFigures()).toEqual({
      Profit: '$3.45',
      'Available Funds': '$100.12',
      'Left over': '$0.00',
    });
    expect(tradeTable().slice(3)).toEqual([
      ['Whole shares', '1 share', '1 share'],
      ['Cost / sale total', '$100.12', '$103.57'],
    ]);
  });

  it('still shows the Best Trade when the Available Funds cannot buy one share', async () => {
    vi.mocked(getBestTrade).mockResolvedValue(
      bestTradeResponse(NOV_5_WHOLE_DAY, trade),
    );
    renderFinder();

    queryNov5With('50');

    await screen.findByRole('heading', { name: 'Best Trade' });
    expect(resultFigures()).toEqual({ 'Profit per share': '$3.45' });
    expect(within(resultRegion()).getByRole('note').textContent).toBe(
      'Your Available Funds of $50.00 do not cover the price of one share at the Buy Point, so you could not have bought any.',
    );
    // Only when and at what price: no shares were bought.
    expect(tradeTable()).toEqual([
      ['', 'Buy Point', 'Sell Point'],
      [
        'Date and time',
        'Nov 5, 2025, 08:15:01 UTC',
        'Nov 5, 2025, 14:05:09 UTC',
      ],
      ['Price per share', '$100.12', '$103.57'],
    ]);
  });

  it('reports No Profitable Trade', async () => {
    vi.mocked(getBestTrade).mockResolvedValue(
      bestTradeResponse(NOV_5_WHOLE_DAY, null),
    );
    renderFinder();

    queryNov5With('1,000');

    await screen.findByRole('heading', { name: 'No Profitable Trade' });
    expect(resultFigures()).toEqual({ Profit: '$0.00' });
    expect(resultParagraphs().slice(1)).toEqual([
      'Between Nov 5, 2025, 00:00:00 UTC and Nov 5, 2025, 23:59:59 UTC, the price never rose, so no Trade would have made a Profit.',
      'You should not have bought at all, and kept your $1,000.00.',
    ]);
    expect(within(resultRegion()).queryByRole('table')).toBe(null);
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

    await screen.findByRole('heading', {
      name: 'Could not find the Best Trade',
    });
    expect(resultParagraphs()).toEqual([
      'A Time Slice must be at least 2 seconds long.',
    ]);
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

    await screen.findByRole('heading', {
      name: 'Could not find the Best Trade',
    });
    expect(resultParagraphs()).toEqual([UNEXPECTED_ERROR_MESSAGE]);
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
    expect(resultParagraphs()[1]).toBe(
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
