import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { getBestTrade } from '../api/api-client';
import { calculateTradeOutcome, parseAvailableFunds } from '../funds';
import {
  TimeSlicePicker,
  type DataPeriod,
  type TimeSlice,
} from '../time-slice';
import {
  BestTradeResult,
  QueryFailed,
  QueryInProgress,
  QueryPlaceholder,
  type QueryResult,
} from './best-trade-result';
import { errorMessage } from './error-message';

export interface BestTradeFinderProps {
  /** The Data Period, as loaded from `GET /api/v1/period`. */
  dataPeriod: DataPeriod;
}

type QueryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'done'; result: QueryResult };

/**
 * The query form: a Time Slice, Available Funds and a "Find best trade"
 * button. The Best Trade is asked for only when the button is pressed, and
 * only once both inputs are valid; until the first press, invalid input is not
 * pointed out. While a query runs the button does nothing, and the result
 * shown is always that of the last press.
 */
export function BestTradeFinder({ dataPeriod }: BestTradeFinderProps) {
  const id = useId();
  const fundsId = `${id}-funds`;
  const fundsHintId = `${id}-funds-hint`;
  const fundsProblemId = `${id}-funds-problem`;

  const [timeSlice, setTimeSlice] = useState<TimeSlice | null>(null);
  const [fundsText, setFundsText] = useState('');
  const [pressed, setPressed] = useState(false);
  const [query, setQuery] = useState<QueryState>({ status: 'idle' });

  // The query in flight, cancelled if the page goes away.
  const queryController = useRef<AbortController | null>(null);
  useEffect(() => () => queryController.current?.abort(), []);

  const funds = parseAvailableFunds(fundsText);
  const loading = query.status === 'loading';
  const showTimeSliceProblem = pressed && !timeSlice;
  const showFundsProblem = pressed && !funds.ok;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setPressed(true);
    if (!timeSlice || !funds.ok) return;

    const controller = new AbortController();
    queryController.current = controller;
    setQuery({ status: 'loading' });
    try {
      const response = await getBestTrade(timeSlice.from, timeSlice.to, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const { trade } = response;
      setQuery({
        status: 'done',
        result: {
          timeSlice: { from: response.from, to: response.to },
          fundsCents: funds.cents,
          bestTrade: trade && {
            trade,
            outcome: calculateTradeOutcome(funds.cents, trade),
          },
        },
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setQuery({ status: 'failed', message: errorMessage(error) });
    }
  }

  return (
    <div className="grid lg:h-full lg:grid-cols-[34rem_minmax(0,1fr)] xl:grid-cols-2">
      <form
        noValidate
        onSubmit={handleSubmit}
        aria-label="Query"
        className="bg-white px-6 py-6 lg:overflow-y-auto xl:px-10"
      >
        <div className="mx-auto flex max-w-xl flex-col gap-5">
          <div>
            <TimeSlicePicker dataPeriod={dataPeriod} onChange={setTimeSlice} />
            {showTimeSliceProblem && (
              <p className="mt-2 text-sm text-red-700" role="alert">
                Pick a valid Time Slice above.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={fundsId}
              className="text-sm font-semibold text-slate-900"
            >
              Available Funds (USD)
            </label>
            <span id={fundsHintId} className="text-sm text-slate-600">
              The most you would spend on shares, e.g. 1,000 or 250.50.
            </span>
            <input
              id={fundsId}
              className="mt-1 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-lg text-slate-900 tabular-nums shadow-xs focus:border-emerald-600 focus:outline-2 focus:outline-emerald-600/30 aria-invalid:border-red-600"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required
              value={fundsText}
              onChange={(event) => setFundsText(event.target.value)}
              aria-invalid={showFundsProblem}
              aria-describedby={
                showFundsProblem
                  ? `${fundsHintId} ${fundsProblemId}`
                  : fundsHintId
              }
            />
            {showFundsProblem && (
              <span
                id={fundsProblemId}
                className="text-sm text-red-700"
                role="alert"
              >
                {funds.message}
              </span>
            )}
          </div>

          <div>
            <button
              type="submit"
              aria-disabled={loading}
              className="rounded-lg bg-emerald-700 px-6 py-2.5 font-semibold text-white shadow-sm hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 aria-disabled:cursor-progress aria-disabled:opacity-60"
            >
              Find best trade
            </button>
          </div>
        </div>
      </form>

      <section
        aria-label="Result"
        aria-live="polite"
        className="border-t border-slate-200 bg-slate-50 px-6 py-6 lg:overflow-y-auto lg:border-t-0 lg:border-l xl:px-10"
      >
        <div className="mx-auto max-w-xl lg:flex lg:min-h-full lg:flex-col lg:justify-center">
          {query.status === 'idle' && <QueryPlaceholder />}
          {query.status === 'loading' && <QueryInProgress />}
          {query.status === 'failed' && <QueryFailed message={query.message} />}
          {query.status === 'done' && <BestTradeResult result={query.result} />}
        </div>
      </section>
    </div>
  );
}
