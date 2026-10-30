import { BestTradeQuerySchema } from './best-trade.js';
import {
  ProblemDetailsSchema,
  ValidationIssueSchema,
  type ProblemDetails,
} from './problem-details.js';

describe('ProblemDetailsSchema', () => {
  const badRequest: ProblemDetails = {
    type: 'about:blank',
    title: 'Bad Request',
    status: 400,
    detail: 'The query is invalid.',
    instance: '/api/v1/trades/best?from=x&to=1762041599',
    issues: [
      {
        path: ['from'],
        message:
          'Must be Unix epoch seconds written with digits only: no sign, spaces, decimal point or exponent',
      },
    ],
  };

  it('accepts a problem with validation issues', () => {
    expect(ProblemDetailsSchema.parse(badRequest)).toEqual(badRequest);
  });

  it('accepts a problem with only type, title and status', () => {
    const notFound = { type: 'about:blank', title: 'Not Found', status: 404 };
    expect(ProblemDetailsSchema.parse(notFound)).toEqual(notFound);
  });

  it('drops extension members it does not know', () => {
    expect(
      ProblemDetailsSchema.parse({ ...badRequest, traceId: 'abc' }),
    ).toEqual(badRequest);
  });

  it.each([
    ['a missing type', { type: undefined }],
    ['a missing title', { title: undefined }],
    ['a missing status', { status: undefined }],
    ['a status as a string', { status: '400' }],
    ['a fractional status', { status: 400.5 }],
    ['a status below 100', { status: 99 }],
    ['a status above 599', { status: 600 }],
    ['a non-string detail', { detail: 42 }],
    ['issues that are not a list', { issues: { from: 'Required' } }],
    ['an issue without a message', { issues: [{ path: ['from'] }] }],
    [
      'an issue with a string path',
      { issues: [{ path: 'from', message: 'x' }] },
    ],
  ])('rejects %s', (_, change) => {
    expect(
      ProblemDetailsSchema.safeParse({ ...badRequest, ...change }).success,
    ).toBe(false);
  });
});

describe('ValidationIssueSchema', () => {
  it('fits the issues zod reports for a rejected query', () => {
    const result = BestTradeQuerySchema.safeParse({ to: '1.5' });
    const issues = result.error?.issues.map(({ path, message }) => ({
      path,
      message,
    }));
    expect(ValidationIssueSchema.array().parse(issues)).toEqual([
      { path: ['from'], message: 'Required' },
      {
        path: ['to'],
        message:
          'Must be Unix epoch seconds written with digits only: no sign, spaces, decimal point or exponent',
      },
    ]);
  });

  it('accepts array indices in the path', () => {
    const issue = { path: ['items', 0, 'time'], message: 'Required' };
    expect(ValidationIssueSchema.parse(issue)).toEqual(issue);
  });
});
