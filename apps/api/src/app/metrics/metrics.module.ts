import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Registry } from 'prom-client';
import { HttpMetrics, RouteTemplateInterceptor } from './http-metrics';
import { MetricsController } from './metrics.controller';
import { metricsRegistryProvider } from './metrics-registry.provider';

/**
 * Prometheus metrics: `GET /metrics`, the default Node.js process metrics and
 * the HTTP request metrics, whose middleware `configureApp` registers.
 * Global, so any module can inject the `Registry` to register its own metrics
 * without importing this module.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    metricsRegistryProvider,
    HttpMetrics,
    { provide: APP_INTERCEPTOR, useClass: RouteTemplateInterceptor },
  ],
  exports: [Registry, HttpMetrics],
})
export class MetricsModule {}
