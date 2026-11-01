# price-history-generator

Generates the Share's Price History deterministically, as [ADR-0001](../../docs/adr/0001-price-history-generated-at-build.md) requires: the same options always produce the same prices, on every Node version.

`generatePriceHistory({ seed, count, startPriceCents, maxStepCents, floorPriceCents })` returns an `Int32Array` with the price, in cents, of each consecutive Price Point. The first is the start price. Each later one adds a step drawn uniformly from −`maxStepCents`…+`maxStepCents`; when `price + step` would fall below the floor, `price − step` is used instead (the walk reflects off the floor).

Determinism rules for this project:

- Randomness comes only from the in-repo, seeded mulberry32 PRNG (`src/lib/mulberry32.ts`). `Math.random` is banned by this project's ESLint config.
- No floating-point maths: every value is an integer, so each operation is exact.

Run `nx test price-history-generator` to execute the unit tests via [Vitest](https://vitest.dev/).

## Generating the Price History and hour summaries files

```sh
nx run price-history-generator:generate
```

writes, relative to the workspace root:

- `data/acme-2025-11.bin`: the Price History, one Int32 little-endian value per Price Point (the price in cents), one Price Point per second from the start of the Data Period. 2,592,000 Price Points, 10,368,000 bytes.
- `data/acme-2025-11.hours.bin`: the hour summaries the Best Trade search uses ([ADR-0002](../../docs/adr/0002-best-trade-search-uses-hour-summaries.md)), built and encoded by `buildHourSummaries` and `encodeHourSummaries` from [`@simple-stock-history/best-trade`](../../libs/best-trade). Int32 little-endian, 4 values per hour: the positions of the hour's earliest lowest price, its earliest highest price, and the Buy Point and Sell Point of its own Best Trade (−1 for both when it has No Profitable Trade). Positions count from 0, the Data Period's first second. 720 hours of 3,600 Price Points, 11,520 bytes.
- `data/acme-2025-11.meta.json`: `{ dataPeriodStart, count, seed, generatorVersion, sha256, hourLength, hourSummariesSha256 }`. `dataPeriodStart` is in Unix epoch seconds, `generatorVersion` is this package's `version`, `sha256` is the hash of the `.bin` file, `hourLength` is the number of Price Points per hour summary (the `.hours.bin` file does not store it), `hourSummariesSha256` is the hash of the `.hours.bin` file.

`data/` is gitignored. The target is cached: its outputs are restored from the Nx cache until this package's sources, its config, `libs/best-trade` (`^production`) or the Node version change. `api:serve` and `api:test` depend on it.

The target runs `node tools/price-history-generator/src/main.ts --out data/acme-2025-11.bin`. Node runs the TypeScript sources as they are (type stripping), this package's and `libs/best-trade`'s, so the generator needs no build step; that is why imports in both packages use `.ts` paths. It does need `pnpm install`, which links `@simple-stock-history/best-trade` into this package's `node_modules`. Options:

- `--config <path>`: config file, default `price-history.config.json` in this package.
- `--out <path>`: the `.bin` file, default `data/acme-2025-11.bin` relative to the working directory. Must end in `.bin`; the hour summaries and the meta are written next to it, ending in `.hours.bin` and `.meta.json`.

## The committed config

[`price-history.config.json`](price-history.config.json) holds everything that determines the Price History and its hour summaries, plus the sha256 each must hash to:

| Field                 | Meaning                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `seed`                | mulberry32 seed, an unsigned 32-bit integer                       |
| `dataPeriodStart`     | first second of the Data Period, Unix epoch seconds (UTC)         |
| `count`               | number of Price Points, one per second                            |
| `startPriceCents`     | price of the first Price Point                                    |
| `maxStepCents`        | each step is drawn uniformly from −`maxStepCents`…+`maxStepCents` |
| `floorPriceCents`     | lowest price; a step that would go below it is reflected          |
| `sha256`              | expected sha256 of the `.bin` file                                |
| `hourLength`          | Price Points per hour summary, `3600`                             |
| `hourSummariesSha256` | expected sha256 of the `.hours.bin` file                          |

If either generated file's sha256 differs from the config's, the CLI prints the expected and actual hashes, writes nothing and exits 1, so `api:serve` and `api:test` fail with it.

To change the Price History or its hour summaries on purpose (a new seed, a change to the walk, the hour length or the summary logic in `libs/best-trade`): make the change, run `nx run price-history-generator:generate`, copy each `actual` sha256 it prints into the config, and run it again. ADR-0002 requires the new sha256 in the same PR as the change.
