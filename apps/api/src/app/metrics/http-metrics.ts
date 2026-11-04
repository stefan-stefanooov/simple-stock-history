import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { Counter, Histogram, Registry } from 'prom-client';
import type { Observable } from 'rxjs';
import { isInternalRequest } from '../internal-routes';
import { SWAGGER_UI_PATH } from '../swagger/swagger';
import type { ExpressRequest } from './express-request.interface';

type HttpLabel = 'method' | 'route' | 'status_code';

/**
 * prom-client's default buckets (5 ms to 10 s) plus 1 ms and 2.5 ms: most
 * requests take 1-4 ms, so with the defaults every p95 reads as "under 5 ms".
 * 0.5 stays: the homelab's latency alert fires at a p95 above 500 ms.
 */
const DURATION_BUCKETS = [
  0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

/** The `route` label of requests nothing answered: 404s for unknown paths. */
export const UNMATCHED_ROUTE = 'unmatched';

/** The `route` label of what Swagger UI serves, written like a route template. */
export const SWAGGER_UI_ROUTE = `/${SWAGGER_UI_PATH}`;

const NOT_FOUND = 404;

/**
 * The `route` label of a request no controller route answered. Swagger UI
 * serves its page, files and the OpenAPI document outside the controllers,
 * so what it answers is labelled with its path; a 404 under that path is
 * unmatched like any other.
 */
function routeWithoutTemplate(
  req: ExpressRequest,
  res: ServerResponse,
): string {
  const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
  const isSwaggerUi =
    path === SWAGGER_UI_ROUTE || path.startsWith(`${SWAGGER_UI_ROUTE}/`);
  return isSwaggerUi && res.statusCode !== NOT_FOUND
    ? SWAGGER_UI_ROUTE
    : UNMATCHED_ROUTE;
}

/**
 * Leaves the route template of the controller route that answers a request,
 * such as `/api/v1/trades/best`, on the request for {@link HttpMetrics}. A
 * template, not the URL, so the `route` label has one value per route however
 * clients write the path or the query. `req.route` cannot be read later
 * instead: nestjs-pino's middleware is itself an Express route
 * (`/api{/*splat}`), which `req.route` still names when no controller route
 * matched.
 */
@Injectable()
export class RouteTemplateInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<ExpressRequest>();
      req.metricsRouteTemplate = req.route?.path;
    }
    return next.handle();
  }
}

/**
 * HTTP request metrics: every request except the internal routes is counted
 * and timed, labelled by method, route template (see
 * {@link RouteTemplateInterceptor}) and status code, once its response is
 * sent. Requests whose client hangs up first are not counted.
 */
@Injectable()
export class HttpMetrics {
  private readonly requests: Counter<HttpLabel>;
  private readonly duration: Histogram<HttpLabel>;

  constructor(registry: Registry) {
    const labelNames: HttpLabel[] = ['method', 'route', 'status_code'];
    this.requests = new Counter({
      name: 'http_requests_total',
      help: 'HTTP requests answered, by method, route template and status code.',
      labelNames,
      registers: [registry],
    });
    this.duration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Time from receiving an HTTP request to sending its response, by method, route template and status code.',
      labelNames,
      buckets: DURATION_BUCKETS,
      registers: [registry],
    });
  }

  /**
   * Express middleware that records each request. `configureApp` registers
   * it on the Express app, ahead of every route: as Nest middleware it would
   * only see paths under `/api`.
   */
  readonly middleware = (
    req: ExpressRequest,
    res: ServerResponse,
    next: () => void,
  ): void => {
    if (isInternalRequest(req.originalUrl ?? req.url)) return next();

    const stopTimer = this.duration.startTimer();
    res.once('finish', () => {
      const labels = {
        method: req.method ?? 'UNKNOWN',
        route: req.metricsRouteTemplate ?? routeWithoutTemplate(req, res),
        status_code: String(res.statusCode),
      };
      this.requests.inc(labels);
      stopTimer(labels);
    });
    next();
  };
}
