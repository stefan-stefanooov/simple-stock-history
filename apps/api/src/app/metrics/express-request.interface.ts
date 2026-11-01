import type { IncomingMessage } from 'node:http';

/** The parts of Express's request the HTTP metrics read and write. */
export interface ExpressRequest extends IncomingMessage {
  originalUrl?: string;
  /** The Express route being run; Express sets it for each route it enters. */
  route?: { path: string };
  /** Left by `RouteTemplateInterceptor` for `HttpMetrics`. */
  metricsRouteTemplate?: string;
}
