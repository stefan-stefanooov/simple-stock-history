import type { ReadinessCheckResult } from './readiness-registry';

export interface ReadinessResponse {
  status: 'ready' | 'not ready';
  checks: Record<string, ReadinessCheckResult>;
}
