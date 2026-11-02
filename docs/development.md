# Development

[← README](../README.md)

Working on the code locally: setup, running, testing and the container images.

## Setup

1. **Node 24**: `nvm use` reads [`.nvmrc`](../.nvmrc). pnpm does not enforce `engines.node` in `package.json`, so `.nvmrc` is the real pin.
2. **pnpm**: run `corepack enable` once. The version is pinned by `packageManager` in `package.json` (`pnpm@12.16.1`). Node 24 ships corepack; Node 25 and later don't, so a future Node bump changes this step. Without `corepack enable`, prefix every `pnpm` command with `corepack`.
3. **Dependencies**: `pnpm install`.

Nx commands below run as `pnpm nx ...`.

## Generate the Price History

```sh
pnpm nx run price-history-generator:generate
```

It writes `data/acme-2025-11.bin` (the Price History), `data/acme-2025-11.hours.bin` (its hour summaries) and `data/acme-2025-11.meta.json`, and checks both files against the sha256s pinned in [`price-history.config.json`](../tools/price-history-generator/price-history.config.json). `data/` is gitignored. `api:serve` and `api:test` depend on this target, so you rarely need to run it yourself.

## Serve

```sh
pnpm nx serve api   # http://localhost:3000, routes under /api
pnpm nx serve web   # http://localhost:4200, forwards /api to the API on :3000
```

Open <http://localhost:4200> for the app and <http://localhost:3000/api/docs> for Swagger UI.

The API is configured with env vars (validated at startup by [`app-config.ts`](../apps/api/src/app/config/app-config.ts); a bad value stops it with a list of every problem):

| Variable             | Default                 | Meaning                                                                          |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `PORT`               | `3000`                  | HTTP port                                                                        |
| `NODE_ENV`           | `production`            | `development` pretty-prints logs; `test` silences them unless `LOG_LEVEL` is set |
| `LOG_LEVEL`          | `info`                  | pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`       |
| `PRICE_HISTORY_PATH` | `data/acme-2025-11.bin` | The Price History; its `.hours.bin` and `.meta.json` are read from next to it    |
| `SWAGGER_ENABLED`    | `true`                  | `false` turns off Swagger UI and the OpenAPI document                            |

## Test and check

| Command                                         | What it does                                                    |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `pnpm test`                                     | Every project's tests                                           |
| `pnpm lint`                                     | ESLint on every project                                         |
| `pnpm typecheck`                                | TypeScript on every project                                     |
| `pnpm format`                                   | Prettier on the files changed against `main`                    |
| `pnpm format:check`                             | Prettier check of the whole workspace                           |
| `pnpm nx test api`                              | One project's tests (`api`, `web`, `shared`, `best-trade`, ...) |
| `pnpm nx affected -t lint test typecheck build` | What CI runs: only the projects a change affects                |

There are no browser end-to-end tests. The API's e2e tests start the whole Nest app over a small fixture Price History; the web app's tests render components with Testing Library.

CI ([`ci.yml`](../.github/workflows/ci.yml)) runs on every PR and on `main`: the affected lint, test, typecheck and build, the Prettier check, the TypeScript project references check, and a build of both container images.

## Container images

Built from the repository root, as CI and the release do:

```sh
docker build --platform linux/amd64 -f apps/api/Dockerfile -t stock-history-api .
docker run --rm -p 3000:3000 stock-history-api

docker build --platform linux/amd64 -f apps/web/Dockerfile -t stock-history-web .
docker run --rm -p 8080:8080 stock-history-web
```

The api image generates and checks the Price History while it builds, so a hash mismatch fails the build. Both images run as non-root. The web image only serves static files; it expects the API on the same origin under `/api`, which the homelab Ingress provides.

## Changing the Price History

The Price History is deterministic: [`price-history.config.json`](../tools/price-history-generator/price-history.config.json) holds the seed and the parameters of the random walk, plus the sha256 the Price History and its hour summaries must hash to ([ADR-0001](adr/0001-price-history-generated-at-build.md)). The generator refuses to write anything when a hash differs.

To change it on purpose (a new seed, a change to the walk, the hour length or the hour summary logic in `libs/best-trade`):

1. Make the change.
2. Run `pnpm nx run price-history-generator:generate`. It fails and prints the expected and the actual sha256 of each file.
3. Copy each actual sha256 into the config.
4. Run it again; it must pass.
5. Commit the new hashes in the same PR as the change (ADR-0002).

The Swagger examples are the real answers for the real Price History, and `swagger.spec.ts` replays them, so a new Price History also means updating [`best-trade.examples.ts`](../apps/api/src/app/best-trade/best-trade.examples.ts). Details: the [generator's README](../tools/price-history-generator/README.md).
