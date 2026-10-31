import type { PeriodResponse } from '@simple-stock-history/shared';
import { fireEvent, render, screen } from '@testing-library/react';

import { ApiError, getBestTrade, getPeriod } from '../api/api-client';
import App from './app';
import { UNEXPECTED_ERROR_MESSAGE } from './error-message';

vi.mock('../api/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/api-client')>()),
  getPeriod: vi.fn(),
  getBestTrade: vi.fn(),
}));

// November 2025 UTC
const period: PeriodResponse = {
  share: 'ACME',
  from: 1761955200,
  to: 1764547199,
  currency: 'USD',
};

afterEach(() => {
  vi.mocked(getPeriod).mockReset();
  vi.mocked(getBestTrade).mockReset();
});

function findButton() {
  return screen.findByRole('button', { name: 'Find best trade' });
}

describe('App', () => {
  it('loads the Data Period, then shows the query form', async () => {
    vi.mocked(getPeriod).mockResolvedValue(period);
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Simple Stock History' }),
    ).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      'Loading the Data Period…',
    );

    expect(await findButton()).toBeTruthy();
    expect(
      screen.getByRole('group', { name: 'Time Slice (UTC)' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Available Funds (USD)')).toBeTruthy();
    expect(screen.getByText(/Prices are available from/).textContent).toContain(
      'from Nov 1, 2025, 00:00:00 UTC to Nov 30, 2025, 23:59:59 UTC.',
    );
    expect(screen.queryByText('Loading the Data Period…')).toBe(null);
    expect(getPeriod).toHaveBeenCalledTimes(1);
    expect(getBestTrade).not.toHaveBeenCalled();
  });

  it('explains a failed load and loads again on request', async () => {
    vi.mocked(getPeriod).mockRejectedValueOnce(
      new ApiError('The API answered with HTTP 502 Bad Gateway.', {
        status: 502,
      }),
    );
    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'Could not load the Data Period. The API answered with HTTP 502 Bad Gateway.Try again',
    );
    expect(screen.queryByRole('button', { name: 'Find best trade' })).toBe(
      null,
    );

    vi.mocked(getPeriod).mockResolvedValueOnce(period);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('status').textContent).toBe(
      'Loading the Data Period…',
    );
    expect(screen.queryByRole('alert')).toBe(null);
    expect(await findButton()).toBeTruthy();
    expect(getPeriod).toHaveBeenCalledTimes(2);
  });

  it('shows a generic message for a failure that is not an ApiError', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const bug = new TypeError('period is undefined');
    vi.mocked(getPeriod).mockRejectedValue(bug);
    render(<App />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      `Could not load the Data Period. ${UNEXPECTED_ERROR_MESSAGE}`,
    );
    expect(consoleError).toHaveBeenCalledWith(bug);
    consoleError.mockRestore();
  });

  it('cancels loading the Data Period when it goes away', () => {
    vi.mocked(getPeriod).mockReturnValue(new Promise(() => undefined));
    const { unmount } = render(<App />);

    const [{ signal } = {}] = vi.mocked(getPeriod).mock.calls[0];
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
