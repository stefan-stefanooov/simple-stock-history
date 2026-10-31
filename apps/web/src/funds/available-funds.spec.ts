import {
  MAX_AVAILABLE_FUNDS_CENTS,
  parseAvailableFunds,
} from './available-funds';

describe('parseAvailableFunds', () => {
  it.each([
    ['250', 25_000],
    ['250.5', 25_050],
    ['250.50', 25_050],
    ['0.01', 1],
    ['0.10', 10],
    ['0.1', 10],
    ['$1,000.50', 100_050],
    ['1,000,000', 100_000_000],
    ['1000000', 100_000_000],
    ['007', 700],
    ['  42.99\t', 4_299],
    ['\u00a0$42\n', 4_200], // no-break space
  ])('reads %j as %i cents', (input, cents) => {
    expect(parseAvailableFunds(input)).toEqual({ ok: true, cents });
  });

  // Through floats these come out a cent short when truncated:
  // parseFloat('0.29') * 100 === 28.999999999999996.
  it.each([
    ['0.29', 29],
    ['0.57', 57],
    ['4.35', 435],
    ['19.99', 1_999],
  ])('reads %j exactly as %i cents', (input, cents) => {
    expect(parseAvailableFunds(input)).toEqual({ ok: true, cents });
  });

  it.each(['0', '0.00', '$0'])(
    'accepts zero (%j), which buys no shares',
    (input) => {
      expect(parseAvailableFunds(input)).toEqual({ ok: true, cents: 0 });
    },
  );

  it('accepts exactly the maximum', () => {
    expect(parseAvailableFunds('$100,000,000.00')).toEqual({
      ok: true,
      cents: MAX_AVAILABLE_FUNDS_CENTS,
    });
  });

  it.each(['', ' ', '\t\n '])('rejects blank input %j as empty', (input) => {
    expect(parseAvailableFunds(input)).toEqual({
      ok: false,
      error: 'empty',
      message: 'Enter your Available Funds.',
    });
  });

  it.each([
    'abc',
    '12abc',
    '1e3',
    '0x10',
    'Infinity',
    'NaN',
    '+5',
    '.5',
    '5.',
    '1.2.3',
    '1 000',
    '$ 5',
    '5$',
    'USD 5',
    '$$5',
    '$-5',
    '--5',
    '1,00',
    '10,50',
    '1000,000',
    ',100',
    '100,',
    '1,000.5,0',
    '\u0661\u0662', // Arabic-Indic digits
    '\uff11\uff12', // fullwidth digits
  ])('rejects %j as not a number', (input) => {
    expect(parseAvailableFunds(input)).toEqual({
      ok: false,
      error: 'not-a-number',
      message: 'Enter an amount in US dollars, like 1,000 or 250.50.',
    });
  });

  it.each(['-5', '-0.01', '-$1,000.50', '-0', ' -5 '])(
    'rejects %j as negative',
    (input) => {
      expect(parseAvailableFunds(input)).toEqual({
        ok: false,
        error: 'negative',
        message: 'Available Funds cannot be negative.',
      });
    },
  );

  it.each(['1.005', '1.500', '0.001', '$1,000.123'])(
    'rejects %j for having more than 2 decimal places',
    (input) => {
      expect(parseAvailableFunds(input)).toEqual({
        ok: false,
        error: 'too-many-decimals',
        message: 'Enter at most 2 decimal places (whole cents).',
      });
    },
  );

  it.each([
    '100,000,000.01',
    '100000001',
    '999999999.99',
    '1000000000',
    '90071992547409.92', // Number.MAX_SAFE_INTEGER + 1 cents
    '9'.repeat(400),
  ])('rejects %j as too large', (input) => {
    expect(parseAvailableFunds(input)).toEqual({
      ok: false,
      error: 'too-large',
      message: 'Enter at most $100,000,000.00.',
    });
  });

  it('ignores leading zeros when checking the maximum', () => {
    expect(parseAvailableFunds('0000000000100000000.00')).toEqual({
      ok: true,
      cents: MAX_AVAILABLE_FUNDS_CENTS,
    });
  });
});
