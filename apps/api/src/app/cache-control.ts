/**
 * `Cache-Control` of every successful API response (#2). The Price History is
 * fixed for a release (ADR-0001), so the same request always gets the same
 * answer, and clients and proxies may keep it for a day:
 * `@Header('Cache-Control', CACHE_FOR_A_DAY)`. Error responses are never
 * cached; `ProblemDetailsFilter` answers them with `no-store`.
 */
export const CACHE_FOR_A_DAY = 'public, max-age=86400';
