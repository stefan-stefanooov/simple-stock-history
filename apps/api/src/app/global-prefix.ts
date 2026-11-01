/**
 * Every API route is served under `/api`, the path Traefik routes to the API.
 * The Kubernetes probes are left out of it, so Traefik never exposes them.
 */
export const GLOBAL_PREFIX = 'api';
