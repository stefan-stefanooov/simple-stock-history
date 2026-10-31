import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { getBestTrade } from '../api/api-client';
import { calculateTradeOutcome, parseAvailableFunds } from '../funds';
import {
  TimeSlicePicker,
  type DataPeriod,
  type TimeSlice,
} from '../time-slice';
import { BestTradeResult, type QueryResult } from './best-trade-result';
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
    <>
      <form noValidate onSubmit={handleSubmit}>
        <TimeSlicePicker dataPeriod={dataPeriod} onChange={setTimeSlice} />
        {showTimeSliceProblem && (
          <p className="problem" role="alert">
            Pick a valid Time Slice above.
          </p>
        )}

        <div className="field">
          <label htmlFor={fundsId}>Available Funds (USD)</label>
          <span id={fundsHintId} className="hint">
            The most you would spend on shares, e.g. 1,000 or 250.50.
          </span>
          <input
            id={fundsId}
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
            <span id={fundsProblemId} className="problem" role="alert">
              {funds.message}
            </span>
          )}
        </div>

        <p>
          <button type="submit" aria-disabled={loading}>
            Find best trade
          </button>
        </p>
      </form>

      <section className="result" aria-label="Result" aria-live="polite">
        {query.status === 'loading' && <p>Finding the Best Trade…</p>}
        {query.status === 'failed' && (
          <p className="problem">
            Could not find the Best Trade. {query.message}
          </p>
        )}
        {query.status === 'done' && <BestTradeResult result={query.result} />}
      </section>
    </>
  );
}
