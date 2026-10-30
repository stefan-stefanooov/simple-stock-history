import { EpochSecondsParamSchema, EpochSecondsSchema } from './time.js';

const DIGITS_ONLY_MESSAGE =
  'Must be Unix epoch seconds written with digits only: no sign, spaces, decimal point or exponent';

describe('EpochSecondsSchema', () => {
  it.each([0, 1761955200, Number.MAX_SAFE_INTEGER])('accepts %d', (value) => {
    expect(EpochSecondsSchema.parse(value)).toBe(value);
  });

  it.each([
    -1,
    1761955200.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.POSITIVE_INFINITY,
    Number.NaN,
    '1761955200',
    null,
  ])('rejects %s', (value) => {
    expect(EpochSecondsSchema.safeParse(value).success).toBe(false);
  });
});

describe('EpochSecondsParamSchema', () => {
  it.each([
    ['0', 0],
    ['1761955200', 1761955200],
    ['1764547199', 1764547199],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
    ['01761955200', 1761955200],
  ])('decodes %j to %d', (input, expected) => {
    expect(EpochSecondsParamSchema.parse(input)).toBe(expected);
  });

  it.each([
    ['empty', ''],
    ['leading space', ' 1761955200'],
    ['trailing space', '1761955200 '],
    ['trailing newline', '1761955200\n'],
    ['inner space', '1761 955200'],
    ['plus sign', '+1761955200'],
    ['minus sign', '-1761955200'],
    ['negative zero', '-0'],
    ['decimal point', '1761955200.0'],
    ['fraction', '1761955200.5'],
    ['trailing dot', '1761955200.'],
    ['exponent', '1.7619552e9'],
    ['integer exponent', '1e9'],
    ['hex', '0x69053B00'],
    ['binary', '0b1'],
    ['separator', '1_761_955_200'],
    ['comma', '1,761,955,200'],
    ['word', 'abc'],
    ['Infinity', 'Infinity'],
    ['NaN', 'NaN'],
    ['Arabic-Indic digits', '١٧٦١٩٥٥٢٠٠'],
    ['full-width digits', '１７６１９５５２００'],
  ])('rejects %s', (_, input) => {
    const result = EpochSecondsParamSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ message: DIGITS_ONLY_MESSAGE }),
    ]);
  });

  it.each([
    ['one above the largest safe integer', '9007199254740992'],
    ['far beyond the largest safe integer', '1'.repeat(400)],
  ])('rejects %s', (_, input) => {
    const result = EpochSecondsParamSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ message: 'Must be at most 9007199254740991' }),
    ]);
  });

  it('rejects a missing value as required', () => {
    expect(EpochSecondsParamSchema.safeParse(undefined).error?.issues).toEqual([
      expect.objectContaining({ message: 'Required' }),
    ]);
  });

  it('rejects a repeated query parameter', () => {
    expect(
      EpochSecondsParamSchema.safeParse(['1761955200', '1762041599']).error
        ?.issues,
    ).toEqual([
      expect.objectContaining({ message: 'Must be given only once' }),
    ]);
  });

  it.each([1761955200, null, { value: '1761955200' }])(
    'rejects the non-string %j',
    (input) => {
      expect(EpochSecondsParamSchema.safeParse(input).success).toBe(false);
    },
  );

  it('encodes seconds back to digits', () => {
    expect(EpochSecondsParamSchema.encode(1761955200)).toBe('1761955200');
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'refuses to encode %d',
    (value) => {
      expect(() => EpochSecondsParamSchema.encode(value)).toThrow();
    },
  );
});
