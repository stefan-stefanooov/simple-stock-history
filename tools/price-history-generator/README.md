# price-history-generator

Generates the Share's Price History deterministically, as [ADR-0001](../../docs/adr/0001-price-history-generated-at-build.md) requires: the same options always produce the same prices, on every Node version.

`generatePriceHistory({ seed, count, startPriceCents, maxStepCents, floorPriceCents })` returns an `Int32Array` with the price, in cents, of each consecutive Price Point. The first is the start price. Each later one adds a step drawn uniformly from −`maxStepCents`…+`maxStepCents`; when `price + step` would fall below the floor, `price − step` is used instead (the walk reflects off the floor).

Determinism rules for this project:

- Randomness comes only from the in-repo, seeded mulberry32 PRNG (`src/lib/mulberry32.ts`). `Math.random` is banned by this project's ESLint config.
- No floating-point maths: every value is an integer, so each operation is exact.

Run `nx test price-history-generator` to execute the unit tests via [Vitest](https://vitest.dev/).
