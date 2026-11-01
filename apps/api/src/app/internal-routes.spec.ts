import { isInternalRequest } from './internal-routes';

describe('isInternalRequest', () => {
  it.each(['/healthz', '/readyz', '/readyz?verbose=1', '/metrics'])(
    'recognises %s as an internal request',
    (url) => {
      expect(isInternalRequest(url)).toBe(true);
    },
  );

  it.each([
    '/api/healthz',
    '/api/metrics',
    '/healthz/extra',
    '/healthzz',
    '/api',
    undefined,
  ])('does not recognise %s as an internal request', (url) => {
    expect(isInternalRequest(url)).toBe(false);
  });
});
