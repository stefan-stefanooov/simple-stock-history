import { BestTradeFinder } from './best-trade-finder';
import { useDataPeriod } from './use-data-period';

/**
 * The query page. It needs the Data Period before the Time Slice can be
 * picked, so it loads that first and offers to try again if that fails. From
 * 1024px wide it fills exactly one screen: the query on the left, the result on
 * the right.
 */
export function App() {
  const { dataPeriod, retry } = useDataPeriod();

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-slate-200 bg-white px-6 py-4 lg:px-10">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Simple Stock History
        </h1>
        <p className="text-sm text-slate-600">
          When should you have bought and sold ACME to make the most Profit?
          Pick a Time Slice, enter your Available Funds and find the Best Trade.
        </p>
      </header>

      <main className="flex-1 lg:min-h-0">
        {dataPeriod.status === 'loading' && (
          <p
            role="status"
            className="flex items-center justify-center gap-3 py-24 text-slate-600"
          >
            Loading the Data Period…
          </p>
        )}
        {dataPeriod.status === 'failed' && (
          <div className="flex justify-center px-6 py-24">
            <div
              role="alert"
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-red-200"
            >
              <p className="text-slate-700">
                <strong className="block text-lg text-red-800">
                  Could not load the Data Period.
                </strong>{' '}
                {dataPeriod.message}
              </p>
              <button
                type="button"
                onClick={retry}
                className="mt-4 rounded-lg bg-emerald-700 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                Try again
              </button>
            </div>
          </div>
        )}
        {dataPeriod.status === 'loaded' && (
          <BestTradeFinder dataPeriod={dataPeriod.period} />
        )}
      </main>
    </div>
  );
}

export default App;
