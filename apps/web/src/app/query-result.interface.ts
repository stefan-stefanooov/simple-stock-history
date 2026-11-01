import type { Trade } from '@simple-stock-history/shared';
import type { TradeOutcome } from '../funds';
import type { TimeSlice } from '../time-slice';

/**
 * What one press of "Find best trade" found, with what it was asked: the Time
 * Slice the API searched and the Available Funds, in cents, entered at the
 * time. Changing the inputs afterwards does not change it.
 */
export interface QueryResult {
  timeSlice: TimeSlice;
  fundsCents: number;
  /** The Best Trade and what the Available Funds make on it; `null` for No Profitable Trade. */
  bestTrade: { trade: Trade; outcome: TradeOutcome } | null;
}
