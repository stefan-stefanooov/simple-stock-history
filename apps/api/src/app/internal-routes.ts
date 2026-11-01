/**
 * Routes for the cluster, not for clients: the Kubernetes probes and the
 * Prometheus scrape. They are served outside the `/api` global prefix (see
 * `configureApp`), so Traefik, which only routes `/api` to the API, never
 * exposes them. They are also left out of the request log and the HTTP
 * metrics: they are hit every few seconds and would drown the real requests.
 */
export const LIVENESS_PATH = 'healthz';
export const READINESS_PATH = 'readyz';
export const METRICS_PATH = 'metrics';

export const INTERNAL_PATHS: readonly string[] = [
  LIVENESS_PATH,
  READINESS_PATH,
  METRICS_PATH,
];

/** Whether a raw request URL, query string included, is for an internal route. */
export function isInternalRequest(url: string | undefined): boolean {
  if (url === undefined) return false;
  const path = url.split('?', 1)[0];
  return INTERNAL_PATHS.some((internalPath) => path === `/${internalPath}`);
}
