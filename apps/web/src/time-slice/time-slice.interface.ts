import type { EpochSeconds } from '@simple-stock-history/shared';

/** A Time Slice: its first and last second, both included. */
export interface TimeSlice {
  from: EpochSeconds;
  to: EpochSeconds;
}
