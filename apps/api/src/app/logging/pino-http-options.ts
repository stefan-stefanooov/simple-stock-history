import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import { type LevelWithSilent, stdTimeFunctions } from 'pino';
import type { Options } from 'pino-http';
import type { AppConfig } from '../config/app-config';

/** What pino-http hands a custom `req` serializer: pino's standard fields, plus the raw request. */
interface StdSerializedRequest {
  id: unknown;
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  remoteAddress?: string;
  raw: IncomingMessage & { ip?: string };
}

/**
 * Keeps request logs to what is worth storing. `remoteAddress` is Express's
 * `req.ip`, which honours `trust proxy` (see `configureApp`), so behind
 * Traefik it is the client's address from `X-Forwarded-For`, not Traefik's.
 */
function serializeRequest(req: StdSerializedRequest) {
  return {
    id: req.id,
    method: req.method,
    url: req.url,
    remoteAddress: req.raw.ip ?? req.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

function serializeResponse(res: { statusCode: number | null }) {
  return { statusCode: res.statusCode };
}

function requestLogLevel(
  _req: IncomingMessage,
  res: ServerResponse,
  error?: Error,
): LevelWithSilent {
  if (error || res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  return 'info';
}

/**
 * pino-http options for the API: one JSON line per log, a request log line
 * per HTTP request. Only `NODE_ENV=development` pretty-prints, through
 * `pino-pretty`, which is a dev dependency and not in the container image.
 */
export function createPinoHttpOptions(config: AppConfig): Options {
  const shared: Options = {
    level: config.logLevel,
    customLogLevel: requestLogLevel,
    serializers: { req: serializeRequest, res: serializeResponse },
  };

  if (config.nodeEnv === 'development') {
    return {
      ...shared,
      transport: { target: 'pino-pretty', options: { singleLine: true } },
    };
  }

  return {
    ...shared,
    timestamp: stdTimeFunctions.isoTime,
    // "level":"info" instead of "level":30, so Grafana recognises the level.
    formatters: { level: (label) => ({ level: label }) },
  };
}
