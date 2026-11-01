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
import type { ExpressRequest } from './express-request.interface';

type HttpLabel = 'method' | 'route' | 'status_code';

/**
 * The `route` label of requests no controller route answered: 404s for
 * unknown paths, and Swagger UI, which serves itself outside the controllers.
 */
export const UNMATCHED_ROUTE = 'unmatched';

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
        route: req.metricsRouteTemplate ?? UNMATCHED_ROUTE,
        status_code: String(res.statusCode),
      };
      this.requests.inc(labels);
      stopTimer(labels);
    });
    next();
  };
}
