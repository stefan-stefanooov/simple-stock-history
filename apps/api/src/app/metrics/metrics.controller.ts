import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { ServerResponse } from 'node:http';
import { Registry } from 'prom-client';
import { METRICS_PATH } from '../internal-routes';

/**
 * `GET /metrics`: every metric in the Prometheus text format, for the
 * Prometheus scrape. Left out of the OpenAPI document: it is not served under
 * `/api`, so clients cannot reach it.
 */
@ApiExcludeController()
@Controller()
export class MetricsController {
  constructor(private readonly registry: Registry) {}

  @Get(METRICS_PATH)
  @Header('Cache-Control', 'no-store')
  async metrics(
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<string> {
    response.setHeader('Content-Type', this.registry.contentType);
    return this.registry.metrics();
  }
}
