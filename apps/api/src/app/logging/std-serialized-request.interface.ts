import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';

/** What pino-http hands a custom `req` serializer: pino's standard fields, plus the raw request. */
export interface StdSerializedRequest {
  id: unknown;
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  remoteAddress?: string;
  raw: IncomingMessage & { ip?: string };
}
