import type { ReadinessCheckResult } from './readiness-registry';

export interface ReadinessReport {
  /** True when every registered readiness check passes. */
  ready: boolean;
  checks: Record<string, ReadinessCheckResult>;
}
