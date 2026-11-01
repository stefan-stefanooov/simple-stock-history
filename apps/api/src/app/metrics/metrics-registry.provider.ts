import type { Provider } from '@nestjs/common';
import { collectDefaultMetrics, Registry } from 'prom-client';

/**
 * The Prometheus registry every API metric is registered on, injected as
 * `Registry`. One per app instead of prom-client's global one, so every app
 * a test starts gets fresh metrics instead of a "metric already registered"
 * error. It holds prom-client's default Node.js process metrics: CPU,
 * memory, event loop lag, GC, handles.
 */
export const metricsRegistryProvider: Provider = {
  provide: Registry,
  useFactory: (): Registry => {
    const registry = new Registry();
    collectDefaultMetrics({ register: registry });
    return registry;
  },
};
