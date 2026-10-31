import { isProbeRequest } from './probe-routes';

describe('isProbeRequest', () => {
  it.each(['/healthz', '/readyz', '/readyz?verbose=1'])(
    'recognises %s as a probe request',
    (url) => {
      expect(isProbeRequest(url)).toBe(true);
    },
  );

  it.each(['/api/healthz', '/healthz/extra', '/healthzz', '/api', undefined])(
    'does not recognise %s as a probe request',
    (url) => {
      expect(isProbeRequest(url)).toBe(false);
    },
  );
});
