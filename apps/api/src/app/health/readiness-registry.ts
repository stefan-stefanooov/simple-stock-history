import { Injectable, Logger } from '@nestjs/common';

/**
 * Answers whether one part of the API can serve requests yet. Resolving to
 * `false` or throwing both count as failing. It runs on every `GET /readyz`,
 * so it must be cheap: report state the module already holds, don't do the
 * work.
 */
export type ReadinessCheck = () => boolean | Promise<boolean>;

export type ReadinessCheckResult = 'pass' | 'fail';

export interface ReadinessReport {
  /** True when every registered readiness check passes. */
  ready: boolean;
  checks: Record<string, ReadinessCheckResult>;
}

/**
 * The readiness checks behind `GET /readyz`. The API is ready when every
 * registered check passes; with no checks registered it is ready as soon as
 * it listens.
 *
 * A module registers its check while Nest builds the app, in its constructor
 * or `onModuleInit`, so the check is in place before the first probe:
 *
 * ```ts
 * constructor(readiness: ReadinessRegistry) {
 *   readiness.register('price-history', () => this.loaded);
 * }
 * ```
 *
 * Probe requests are not logged, so the registry logs each time a check
 * starts or stops passing instead.
 */
@Injectable()
export class ReadinessRegistry {
  private readonly logger = new Logger(ReadinessRegistry.name);
  private readonly checks = new Map<string, ReadinessCheck>();
  private readonly lastResults = new Map<string, ReadinessCheckResult>();

  /**
   * Adds a readiness check under a unique, stable name, which is how
   * `GET /readyz` and the logs refer to it.
   */
  register(name: string, check: ReadinessCheck): void {
    if (name.trim() === '') {
      throw new Error('A readiness check needs a name');
    }
    if (this.checks.has(name)) {
      throw new Error(`Readiness check "${name}" is already registered`);
    }
    this.checks.set(name, check);
  }

  /** Runs every readiness check, all at once. */
  async check(): Promise<ReadinessReport> {
    const results = await Promise.all(
      [...this.checks].map(
        async ([name, check]) => [name, await this.run(name, check)] as const,
      ),
    );
    return {
      ready: results.every(([, result]) => result === 'pass'),
      checks: Object.fromEntries(results),
    };
  }

  private async run(
    name: string,
    check: ReadinessCheck,
  ): Promise<ReadinessCheckResult> {
    let result: ReadinessCheckResult;
    let error: unknown;
    try {
      result = (await check()) === true ? 'pass' : 'fail';
    } catch (thrown) {
      result = 'fail';
      error = thrown;
    }
    this.logChange(name, result, error);
    return result;
  }

  private logChange(
    name: string,
    result: ReadinessCheckResult,
    error: unknown,
  ): void {
    const previous = this.lastResults.get(name);
    this.lastResults.set(name, result);
    if (result === previous) return;

    if (result === 'pass') {
      this.logger.log(`Readiness check "${name}" passes`);
    } else if (error !== undefined) {
      this.logger.error(
        `Readiness check "${name}" fails: it threw`,
        error instanceof Error ? error.stack : String(error),
      );
    } else if (previous !== undefined) {
      // A check that has not passed yet is expected during startup; only
      // losing readiness is worth a warning.
      this.logger.warn(`Readiness check "${name}" fails`);
    }
  }
}
