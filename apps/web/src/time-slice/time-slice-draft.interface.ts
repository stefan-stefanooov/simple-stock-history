import type { EpochSeconds } from '@simple-stock-history/shared';

/**
 * What the user has entered so far: the first and last day as the epoch second
 * of their UTC midnight (`lastDay` is absent while only one day is picked), and
 * the start and end times as typed, `HH:MM:SS` in UTC.
 */
export interface TimeSliceDraft {
  days: { firstDay: EpochSeconds; lastDay?: EpochSeconds } | undefined;
  startTime: string;
  endTime: string;
}
