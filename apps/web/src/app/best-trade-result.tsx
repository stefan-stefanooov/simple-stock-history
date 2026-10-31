import type { EpochSeconds, Trade } from '@simple-stock-history/shared';
import { formatUtcDateTime, toIsoUtcDateTime } from '../date-time';
import { formatShares, formatUsd, type TradeOutcome } from '../funds';
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

export interface BestTradeResultProps {
  result: QueryResult;
}

/** Tells the user, in plain sentences, when to have bought and sold and what it would have made. */
export function BestTradeResult({ result }: BestTradeResultProps) {
  const { timeSlice, fundsCents, bestTrade } = result;
  const between = (
    <>
      Between <UtcTime seconds={timeSlice.from} /> and{' '}
      <UtcTime seconds={timeSlice.to} />
    </>
  );

  if (!bestTrade) {
    return (
      <>
        <h2>No Profitable Trade</h2>
        <p>
          {between}, the price never rose, so no Trade would have made a Profit.
        </p>
        <p>You should not have bought at all.</p>
      </>
    );
  }

  const { trade, outcome } = bestTrade;
  const buy = <UtcTime seconds={trade.buy.time} />;
  const sell = <UtcTime seconds={trade.sell.time} />;
  const buyPrice = formatUsd(trade.buy.priceCents);
  const sellPrice = formatUsd(trade.sell.priceCents);

  if (outcome.kind === 'insufficient-funds') {
    return (
      <>
        <h2>Best Trade</h2>
        <p>
          {between}, the Best Trade buys on {buy} at {buyPrice} a share and
          sells on {sell} at {sellPrice} a share, a Profit of{' '}
          {formatUsd(trade.profitCents)} a share.
        </p>
        <p>
          Your Available Funds of {formatUsd(fundsCents)} do not cover the price
          of one share, so you could not have bought any.
        </p>
      </>
    );
  }

  const { shares, spentCents, leftoverCents, totalProfitCents } = outcome;
  return (
    <>
      <h2>Best Trade</h2>
      <p>
        {between}, you should have bought {formatShares(shares)} on {buy} at{' '}
        {buyPrice} a share, spending {formatUsd(spentCents)}.
      </p>
      <p>
        You should then have sold {shares === 1 ? 'it' : 'them'} on {sell} at{' '}
        {sellPrice} a share, for {formatUsd(spentCents + totalProfitCents)}.
      </p>
      <p>
        That is a Profit of {formatUsd(totalProfitCents)} (
        {formatUsd(trade.profitCents)} a share), with {formatUsd(leftoverCents)}{' '}
        of your {formatUsd(fundsCents)} left unspent.
      </p>
    </>
  );
}

/** A second in the page's one date and time style, machine-readable too. */
function UtcTime({ seconds }: { seconds: EpochSeconds }) {
  return (
    <time dateTime={toIsoUtcDateTime(seconds)}>
      {formatUtcDateTime(seconds)}
    </time>
  );
}
