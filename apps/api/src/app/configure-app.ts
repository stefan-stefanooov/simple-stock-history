import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

/** Every API route is served under `/api`, the path Traefik routes to the API. */
export const GLOBAL_PREFIX = 'api';

/**
 * Traefik is the only proxy in front of the API, so exactly one hop is
 * trusted: `req.ip` is the last `X-Forwarded-For` entry, the one Traefik
 * appended. Entries a client sends itself end up to the left of it and are
 * ignored, so the logged client IP cannot be spoofed.
 */
const TRUSTED_PROXY_HOPS = 1;

/**
 * App-wide setup that modules cannot do themselves. `main.ts` and the e2e
 * tests both call it, so tests exercise the same app that runs in the cluster.
 * The app must be created with `bufferLogs: true`, so Nest's startup logs
 * also go through pino.
 */
export function configureApp(app: NestExpressApplication): void {
  app.useLogger(app.get(Logger));
  app.set('trust proxy', TRUSTED_PROXY_HOPS);
  app.use(helmet());
  app.setGlobalPrefix(GLOBAL_PREFIX);
  // On SIGTERM (Kubernetes stopping the pod) or SIGINT (Ctrl+C), Nest runs the
  // shutdown hooks and closes the HTTP server, which stops accepting
  // connections and lets in-flight requests finish. Exiting through
  // process.exit() then lets a pino transport flush its last lines.
  app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true });
}
