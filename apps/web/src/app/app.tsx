import { BestTradeFinder } from './best-trade-finder';
import { useDataPeriod } from './use-data-period';

/**
 * The query page. It needs the Data Period before the Time Slice can be
 * picked, so it loads that first and offers to try again if that fails.
 */
export function App() {
  const { dataPeriod, retry } = useDataPeriod();

  return (
    <main className="page">
      <header>
        <h1>Simple Stock History</h1>
        <p className="lead">
          When should you have bought and sold ACME to make the most Profit?
          Pick a Time Slice, enter your Available Funds and find the Best Trade.
        </p>
      </header>

      {dataPeriod.status === 'loading' && (
        <p role="status">Loading the Data Period…</p>
      )}
      {dataPeriod.status === 'failed' && (
        <div className="notice" role="alert">
          <p>
            <strong>Could not load the Data Period.</strong>{' '}
            {dataPeriod.message}
          </p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {dataPeriod.status === 'loaded' && (
        <BestTradeFinder dataPeriod={dataPeriod.period} />
      )}
    </main>
  );
}

export default App;
