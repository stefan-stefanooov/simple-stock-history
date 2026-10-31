import { useCallback, useEffect, useState } from 'react';
import type { PeriodResponse } from '@simple-stock-history/shared';
import { getPeriod } from '../api/api-client';
import { errorMessage } from './error-message';

/** Where loading the Data Period from `GET /api/v1/period` has got to. */
export type DataPeriodState =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'loaded'; period: PeriodResponse };

/**
 * Loads the Data Period once on mount, and again on each `retry()` after a
 * failure. An unmount cancels the request in flight.
 */
export function useDataPeriod(): {
  dataPeriod: DataPeriodState;
  retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const [dataPeriod, setDataPeriod] = useState<DataPeriodState>({
    status: 'loading',
  });

  useEffect(() => {
    const controller = new AbortController();
    getPeriod({ signal: controller.signal }).then(
      (period) => {
        if (!controller.signal.aborted) {
          setDataPeriod({ status: 'loaded', period });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setDataPeriod({ status: 'failed', message: errorMessage(error) });
        }
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setDataPeriod({ status: 'loading' });
    setAttempt((previous) => previous + 1);
  }, []);

  return { dataPeriod, retry };
}
