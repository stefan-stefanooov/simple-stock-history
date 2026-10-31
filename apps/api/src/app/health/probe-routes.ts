/**
 * Kubernetes probe paths. They are served outside the `/api` global prefix
 * (see `configureApp`), so Traefik, which only routes `/api` to the API,
 * never exposes them, and they are left out of the request log.
 */
export const LIVENESS_PATH = 'healthz';
export const READINESS_PATH = 'readyz';

export const PROBE_PATHS: readonly string[] = [LIVENESS_PATH, READINESS_PATH];

/** Whether a raw request URL, query string included, is a probe request. */
export function isProbeRequest(url: string | undefined): boolean {
  if (url === undefined) return false;
  const path = url.split('?', 1)[0];
  return PROBE_PATHS.some((probePath) => path === `/${probePath}`);
}
