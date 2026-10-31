import type { ReactNode } from 'react';
import type {
  EpochSeconds,
  PricePoint,
  Trade,
} from '@simple-stock-history/shared';
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

/**
 * Shows what a query found: the Profit as the headline, then when to buy and
 * sell and what it costs and brings in, side by side for the Buy Point and the
 * Sell Point.
 */
export function BestTradeResult({ result }: BestTradeResultProps) {
  const { timeSlice, fundsCents, bestTrade } = result;

  if (!bestTrade) {
    return (
      <ResultCard title="No Profitable Trade" timeSlice={timeSlice}>
        <Headline label="Profit" value={formatUsd(0)} tone="none" />
        <p className="text-slate-700">
          Between <UtcTime seconds={timeSlice.from} /> and{' '}
          <UtcTime seconds={timeSlice.to} />, the price never rose, so no Trade
          would have made a Profit.
        </p>
        <p className="text-slate-700">
          You should not have bought at all, and kept your{' '}
          {formatUsd(fundsCents)}.
        </p>
      </ResultCard>
    );
  }

  const { trade, outcome } = bestTrade;

  if (outcome.kind === 'insufficient-funds') {
    return (
      <ResultCard title="Best Trade" timeSlice={timeSlice}>
        <Headline
          label="Profit per share"
          value={formatUsd(trade.profitCents)}
          tone="profit"
        />
        <p
          role="note"
          className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200"
        >
          Your Available Funds of {formatUsd(fundsCents)} do not cover the price
          of one share at the Buy Point, so you could not have bought any.
        </p>
        <TradeTable buy={trade.buy} sell={trade.sell} />
      </ResultCard>
    );
  }

  const { shares, spentCents, leftoverCents, totalProfitCents } = outcome;
  return (
    <ResultCard title="Best Trade" timeSlice={timeSlice}>
      <Headline
        label="Profit"
        value={formatUsd(totalProfitCents)}
        detail={`${formatShares(shares)} × ${formatUsd(trade.profitCents)} a share`}
        tone="profit"
      />
      <p className="text-slate-700">
        You should have bought {formatShares(shares)} on{' '}
        <UtcTime seconds={trade.buy.time} /> and sold{' '}
        {shares === 1 ? 'it' : 'them'} on <UtcTime seconds={trade.sell.time} />.
      </p>
      <TradeTable
        buy={trade.buy}
        sell={trade.sell}
        shares={shares}
        costCents={spentCents}
        saleTotalCents={spentCents + totalProfitCents}
      />
      <dl className="grid grid-cols-2 gap-3">
        <Amount label="Available Funds" cents={fundsCents} />
        <Amount label="Left over" cents={leftoverCents} />
      </dl>
    </ResultCard>
  );
}

/** Shown in the result's place before the first query. */
export function QueryPlaceholder() {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="font-semibold text-slate-700">
        Your Best Trade will appear here.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Pick a Time Slice, enter your Available Funds and press Find best trade.
      </p>
    </div>
  );
}

/** Shown while a query runs. */
export function QueryInProgress() {
  return (
    <p className="flex items-center justify-center gap-3 py-10 text-slate-600">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-700"
      />
      Finding the Best Trade…
    </p>
  );
}

/** Shown when a query failed, with a message fit to show the user. */
export function QueryFailed({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-50 px-6 py-5 ring-1 ring-red-200">
      <h2 className="font-semibold text-red-800">
        Could not find the Best Trade
      </h2>
      <p className="mt-1 text-red-700">{message}</p>
    </div>
  );
}

function ResultCard({
  title,
  timeSlice,
  children,
}: {
  title: string;
  timeSlice: TimeSlice;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <header>
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Time Slice <UtcTime seconds={timeSlice.from} /> to{' '}
          <UtcTime seconds={timeSlice.to} />
        </p>
      </header>
      {children}
    </article>
  );
}

/** The one number to see at a glance. */
function Headline({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: 'profit' | 'none';
}) {
  const profit = tone === 'profit';
  return (
    <div
      className={
        profit
          ? 'rounded-lg bg-emerald-50 px-5 py-4 ring-1 ring-emerald-200'
          : 'rounded-lg bg-slate-100 px-5 py-4 ring-1 ring-slate-200'
      }
    >
      <dl>
        <dt
          className={`text-sm font-medium ${profit ? 'text-emerald-800' : 'text-slate-600'}`}
        >
          {label}
        </dt>
        <dd
          className={`text-5xl font-bold tracking-tight tabular-nums ${profit ? 'text-emerald-700' : 'text-slate-400'}`}
        >
          {value}
        </dd>
      </dl>
      {detail && <p className="mt-1 text-sm text-emerald-800">{detail}</p>}
    </div>
  );
}

/**
 * The Buy Point and the Sell Point side by side; the share and money rows only
 * when shares were bought.
 */
function TradeTable({
  buy,
  sell,
  shares,
  costCents,
  saleTotalCents,
}: {
  buy: PricePoint;
  sell: PricePoint;
  shares?: number;
  costCents?: number;
  saleTotalCents?: number;
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          <td className="w-1/4" />
          <th scope="col" className="py-2 pr-3 font-semibold text-slate-900">
            Buy Point
          </th>
          <th scope="col" className="py-2 font-semibold text-slate-900">
            Sell Point
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        <Row label="Date and time">
          <UtcTime seconds={buy.time} />
          <UtcTime seconds={sell.time} />
        </Row>
        <Row label="Price per share" strong>
          {formatUsd(buy.priceCents)}
          {formatUsd(sell.priceCents)}
        </Row>
        {shares !== undefined && (
          <Row label="Whole shares">
            {formatShares(shares)}
            {formatShares(shares)}
          </Row>
        )}
        {costCents !== undefined && saleTotalCents !== undefined && (
          <Row label="Cost / sale total" strong>
            {formatUsd(costCents)}
            {formatUsd(saleTotalCents)}
          </Row>
        )}
      </tbody>
    </table>
  );
}

function Row({
  label,
  strong = false,
  children: [buyCell, sellCell],
}: {
  label: string;
  strong?: boolean;
  children: [ReactNode, ReactNode];
}) {
  const cell = `py-2 tabular-nums ${strong ? 'text-base font-semibold text-slate-900' : 'text-slate-700'}`;
  return (
    <tr>
      <th scope="row" className="py-2 pr-3 font-normal text-slate-500">
        {label}
      </th>
      <td className={`${cell} pr-3`}>{buyCell}</td>
      <td className={cell}>{sellCell}</td>
    </tr>
  );
}

function Amount({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold text-slate-900 tabular-nums">
        {formatUsd(cents)}
      </dd>
    </div>
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
