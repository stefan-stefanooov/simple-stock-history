import { Global, Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ReadinessRegistry } from './readiness-registry';

/**
 * `GET /healthz` and `GET /readyz` for Kubernetes. Global, so any module can
 * inject the {@link ReadinessRegistry} to register a readiness check without
 * importing this module.
 */
@Global()
@Module({
  controllers: [HealthController],
  providers: [ReadinessRegistry],
  exports: [ReadinessRegistry],
})
export class HealthModule {}
