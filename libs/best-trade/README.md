# best-trade

Finds the Best Trade, or No Profitable Trade, in a Time Slice of the Price History, using hour summaries ([ADR-0002](../../docs/adr/0002-best-trade-search-uses-hour-summaries.md)). Pure TypeScript with no dependencies.

Imported as `@simple-stock-history/best-trade`. It isn't built on its own: consumers compile it from source, and Node runs it as it is (type stripping), which is why imports in this package use `.ts` paths.

Everything works in positions: 0 is the Data Period's first second, and the Price History is an `Int32Array` of prices in cents. Converting from Unix epoch seconds is the caller's job.

```ts
const summaries = buildHourSummaries(prices, HOUR_LENGTH); // or decodeHourSummaries(bytes, HOUR_LENGTH)
const search = createBestTradeSearch(prices, summaries);
search.find(first, last); // { buy, sell } positions, or null for No Profitable Trade
```

- `buildHourSummaries(prices, hourLength)` splits the Price History into hours of `hourLength` Price Points (`HOUR_LENGTH`, 3,600, in production; the last hour may be shorter). For each hour it keeps the positions of its earliest lowest price, its earliest highest price, and the Buy Point and Sell Point of its own Best Trade (−1 for both when it has No Profitable Trade).
- `encodeHourSummaries(summaries)` / `decodeHourSummaries(bytes, hourLength)` write and read the summaries file, `<name>.hours.bin`: Int32 little-endian, 4 values per hour (lowest, highest, buy, sell). The file does not store the hour length.
- `createBestTradeSearch(prices, summaries).find(first, last)` returns the Best Trade in the Time Slice from `first` to `last`, both included: highest Profit, then earliest Buy Point, then earliest Sell Point. It loops over the Price Points of the partial hours at the two ends and joins the whole hours in between from their summaries. A join picks the best of the left piece's Best Trade, the right piece's, and buying at the left piece's earliest lowest price to sell at the right piece's earliest highest price.

## Tests

Run `nx test best-trade` to execute the unit tests via [Vitest](https://vitest.dev/). They use hours of 1–6 Price Points, so short random series cross hour boundaries and every join is checked against a brute-force reference.

## Benchmark

The worst-case Time Slice, positions 1 to 2,591,998 of the full Data Period (two almost-whole partial hours plus 718 hour summaries), must take at most 1 ms after warm-up on a dev machine. To measure it:

```sh
nx run price-history-generator:generate
node libs/best-trade/bench/worst-case-time-slice.ts
```
