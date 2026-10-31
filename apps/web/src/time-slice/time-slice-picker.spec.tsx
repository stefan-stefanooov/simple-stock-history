import { fireEvent, render, screen } from '@testing-library/react';

import { TimeSlicePicker } from './time-slice-picker';

// November 2025 UTC, as served by GET /api/v1/period
const NOVEMBER = { from: 1761955200, to: 1764547199 };
const DAY = 86_400;
const NOV_5 = NOVEMBER.from + 4 * DAY;
const NOV_7 = NOVEMBER.from + 6 * DAY;

function renderPicker(dataPeriod = NOVEMBER) {
  const onChange = vi.fn();
  render(<TimeSlicePicker dataPeriod={dataPeriod} onChange={onChange} />);
  return onChange;
}

/** The calendar button for a day, by the date in its accessible name. */
function day(date: string) {
  return screen.getByRole('button', { name: new RegExp(`${date}, 2025`) });
}

function startTime() {
  return screen.getByLabelText('Start time (UTC)');
}

function endTime() {
  return screen.getByLabelText('End time (UTC)');
}

function summary() {
  return screen.getByRole('status', { name: 'Selected Time Slice' });
}

function setTime(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe('TimeSlicePicker', () => {
  it('labels everything as UTC and defaults the times to the whole day', () => {
    renderPicker();

    expect(
      screen.getByRole('group', { name: 'Time Slice (UTC)' }),
    ).toBeTruthy();
    expect(screen.getByText(/All dates and times are in UTC/)).toBeTruthy();
    expect(startTime()).toHaveProperty('value', '00:00:00');
    expect(endTime()).toHaveProperty('value', '23:59:59');
    expect(startTime()).toHaveProperty('step', '1');
    expect(summary().textContent).toBe(
      'Pick the first and last day in the calendar.',
    );
  });

  it('shows only the months of the Data Period', () => {
    renderPicker();

    expect(screen.getByRole('grid', { name: 'November 2025' })).toBeTruthy();
    for (const name of [/previous month/i, /next month/i]) {
      expect(
        screen.getByRole('button', { name }).getAttribute('aria-disabled'),
      ).toBe('true');
    }
  });

  it('disables days outside the Data Period', () => {
    const onChange = renderPicker({
      from: NOVEMBER.from + 9 * DAY,
      to: NOVEMBER.from + 20 * DAY - 1,
    });

    expect(day('November 9th')).toHaveProperty('disabled', true);
    expect(day('November 10th')).toHaveProperty('disabled', false);
    expect(day('November 20th')).toHaveProperty('disabled', false);
    expect(day('November 21st')).toHaveProperty('disabled', true);

    fireEvent.click(day('November 9th'));
    expect(onChange).not.toHaveBeenCalled();
  });

  // Each zone is set before the component renders; Node picks up a changed
  // process.env.TZ at once. Calendar days must stay UTC days in all of them.
  describe.each([
    'UTC',
    'America/New_York',
    'Asia/Tokyo',
    'Pacific/Kiritimati',
    'Pacific/Pago_Pago',
  ])('with the browser in %s', (timeZone) => {
    const originalTimeZone = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = timeZone;
    });
    afterAll(() => {
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    });

    it('runs in that time zone', () => {
      const offset = new Date(NOV_5 * 1000).getTimezoneOffset();
      expect(offset === 0).toBe(timeZone === 'UTC');
    });

    it('lays out the UTC calendar', () => {
      renderPicker();

      // 1 November 2025 is a Saturday in UTC
      expect(day('Saturday, November 1st')).toBeTruthy();
      expect(day('Sunday, November 30th')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /October|December/ })).toBe(
        null,
      );
    });

    it('emits the picked days from 00:00:00 to 23:59:59 UTC', () => {
      const onChange = renderPicker();

      fireEvent.click(day('November 5th'));
      expect(onChange).toHaveBeenLastCalledWith({
        from: NOV_5,
        to: NOV_5 + DAY - 1,
      });

      fireEvent.click(day('November 7th'));
      expect(onChange).toHaveBeenLastCalledWith({
        from: NOV_5,
        to: NOV_7 + DAY - 1,
      });
      expect(summary().textContent).toBe(
        'Time Slice: 2025-11-05 00:00:00 UTC to 2025-11-07 23:59:59 UTC',
      );
    });

    it('emits the whole Data Period for its first and last day', () => {
      const onChange = renderPicker();

      fireEvent.click(day('November 1st'));
      fireEvent.click(day('November 30th'));
      expect(onChange).toHaveBeenLastCalledWith(NOVEMBER);
    });

    it('applies the times as UTC, to the second', () => {
      const onChange = renderPicker();

      fireEvent.click(day('November 5th'));
      setTime(startTime(), '08:15:01');
      setTime(endTime(), '17:45:59');
      expect(onChange).toHaveBeenLastCalledWith({
        from: NOV_5 + 8 * 3600 + 15 * 60 + 1,
        to: NOV_5 + 17 * 3600 + 45 * 60 + 59,
      });
    });
  });

  it('picks the end day after the start day, whichever is clicked first', () => {
    const onChange = renderPicker();

    fireEvent.click(day('November 7th'));
    fireEvent.click(day('November 5th'));
    expect(onChange).toHaveBeenLastCalledWith({
      from: NOV_5,
      to: NOV_7 + DAY - 1,
    });
  });

  it('starts a new range on a click after a range is complete', () => {
    const onChange = renderPicker();

    fireEvent.click(day('November 5th'));
    fireEvent.click(day('November 7th'));
    fireEvent.click(day('November 20th'));
    expect(onChange).toHaveBeenLastCalledWith({
      from: NOVEMBER.from + 19 * DAY,
      to: NOVEMBER.from + 20 * DAY - 1,
    });
  });

  it('blocks an end before the start', () => {
    const onChange = renderPicker();

    fireEvent.click(day('November 5th'));
    setTime(startTime(), '12:00:00');
    setTime(endTime(), '11:59:59');

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('alert').textContent).toBe(
      'The end is before the start.',
    );
    expect(endTime().getAttribute('aria-invalid')).toBe('true');
    expect(endTime().getAttribute('aria-describedby')).toBe(
      screen.getByRole('alert').id,
    );
    expect(summary().textContent).toBe('');

    setTime(endTime(), '12:00:01');
    expect(onChange).toHaveBeenLastCalledWith({
      from: NOV_5 + 12 * 3600,
      to: NOV_5 + 12 * 3600 + 1,
    });
    expect(screen.queryByRole('alert')).toBe(null);
    expect(endTime().getAttribute('aria-invalid')).toBe('false');
  });

  it('blocks a Time Slice of a single second', () => {
    const onChange = renderPicker();

    fireEvent.click(day('November 5th'));
    setTime(startTime(), '12:00:00');
    setTime(endTime(), '12:00:00');

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('alert').textContent).toMatch(/at least 2 seconds/);
  });

  it('blocks a missing time', () => {
    const onChange = renderPicker();

    fireEvent.click(day('November 5th'));
    setTime(startTime(), '');

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter the start time as HH:MM:SS.',
    );
    expect(startTime().getAttribute('aria-invalid')).toBe('true');
  });

  it('only reports changes of the Time Slice', () => {
    const onChange = renderPicker();

    setTime(startTime(), '08:00:00');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(day('November 5th'));
    fireEvent.click(day('November 5th'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('clears the Time Slice when its only day is clicked again', () => {
    const onChange = renderPicker();

    fireEvent.click(day('November 5th'));
    fireEvent.click(day('November 5th'));
    fireEvent.click(day('November 5th'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
