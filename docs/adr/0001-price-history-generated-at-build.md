# Price History is generated at image build, pinned by a committed hash

The Price History must be static and identical in every build and every running pod. We commit only the generator, its config (seed, Data Period start and length, start price, step range, price floor) and the expected sha256 of its output; the api Docker build runs the generator and fails if the output's hash doesn't match. The resulting file is baked into the image and only read (and re-verified) at startup.

This depends on the generator being fully deterministic: its own seeded PRNG and integer-only arithmetic. Do not introduce `Math.random` or floating-point maths (`log`, `sin`, `exp`, …), since their results may differ between Node versions and silently change the data.

The hour summaries used by the Best Trade search are a second generated file under the same rules ([ADR-0002](0002-best-trade-search-uses-hour-summaries.md)).

## Considered Options

- **Generate in memory at startup**: rejected; the data would be produced at runtime instead of being a fixed artifact of the release, and startup would pay for it in every pod.
- **Commit the generated file**: rejected; a ~10 MB binary in git history for every regeneration, when the seed plus hash already pins it exactly.
