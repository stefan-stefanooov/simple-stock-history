import { Injectable } from '@nestjs/common';
import { Histogram, Registry } from 'prom-client';

/**
 * From 5 µs to 10 ms. ADR-0002 measured about 0.04 ms for the worst-case Time
 * Slice and about 6 ms for the plain loop it replaced, so the range shows both
 * a slower node and a regression to that loop.
 */
const SEARCH_DURATION_BUCKETS = [
  0.000005, 0.00001, 0.000025, 0.00005, 0.0001, 0.00025, 0.0005, 0.001, 0.0025,
  0.005, 0.01,
];

/** A minute, 10 minutes, an hour (ADR-0002's hours), 6 hours, a day, a week, the whole Data Period. */
const TIME_SLICE_LENGTH_BUCKETS = [
  60, 600, 3600, 21600, 86400, 604800, 2592000,
];

/** Prometheus metrics of the Best Trade search, on the app's `Registry`. */
@Injectable()
export class BestTradeMetrics {
  private readonly searchDuration: Histogram;
  private readonly timeSliceLength: Histogram;

  constructor(registry: Registry) {
    this.searchDuration = new Histogram({
      name: 'best_trade_search_duration_seconds',
      help: 'Time the Best Trade search takes for one Time Slice.',
      buckets: SEARCH_DURATION_BUCKETS,
      registers: [registry],
    });
    this.timeSliceLength = new Histogram({
      name: 'best_trade_time_slice_length_seconds',
      help: 'Length of each valid Time Slice asked about, in seconds, both ends included.',
      buckets: TIME_SLICE_LENGTH_BUCKETS,
      registers: [registry],
    });
  }

  /** Records the length of the Time Slice from `from` to `to`, both included. */
  recordTimeSlice(from: number, to: number): void {
    this.timeSliceLength.observe(to - from + 1);
  }

  /** Runs `search` and records how long it took. */
  timeSearch<T>(search: () => T): T {
    const stopTimer = this.searchDuration.startTimer();
    try {
      return search();
    } finally {
      stopTimer();
    }
  }
}
