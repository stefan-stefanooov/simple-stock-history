import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { LIVENESS_PATH, READINESS_PATH } from './probe-routes';
import {
  type ReadinessCheckResult,
  ReadinessRegistry,
} from './readiness-registry';

export interface LivenessResponse {
  status: 'ok';
}

export interface ReadinessResponse {
  status: 'ready' | 'not ready';
  checks: Record<string, ReadinessCheckResult>;
}

/**
 * Kubernetes probes. Kept out of every cache, since a stale answer is worse
 * than none.
 */
@Controller()
export class HealthController {
  constructor(private readonly registry: ReadinessRegistry) {}

  /** Liveness: answers 200 for as long as the process can serve HTTP at all. */
  @Get(LIVENESS_PATH)
  @Header('Cache-Control', 'no-store')
  liveness(): LivenessResponse {
    return { status: 'ok' };
  }

  /** Readiness: 200 when every registered readiness check passes, otherwise 503. */
  @Get(READINESS_PATH)
  @Header('Cache-Control', 'no-store')
  async readiness(
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<ReadinessResponse> {
    const report = await this.registry.check();
    // Set directly rather than thrown as an HttpException, so the body stays
    // the readiness report and not an error document.
    response.statusCode = report.ready
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;
    return {
      status: report.ready ? 'ready' : 'not ready',
      checks: report.checks,
    };
  }
}
