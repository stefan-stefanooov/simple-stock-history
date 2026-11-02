# simple-stock-history

[![CI](https://github.com/stefan-stefanooov/simple-stock-history/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/stefan-stefanooov/simple-stock-history/actions/workflows/ci.yml)

A session-less web app that finds the **Best Trade** for the Share `ACME`: given a Time Slice of its Price History, when to buy and when to sell for the highest Profit. The Price History has one Price Point per second for all of November 2025 (UTC). The API finds the Best Trade; the web app lets you pick a Time Slice, enter your Available Funds and see the outcome.

- [ASSIGNMENT.md](ASSIGNMENT.md): the assignment this answers.
- [GLOSSARY.md](GLOSSARY.md): the domain words (Share, Time Slice, Best Trade, ...). Code, docs and issues use them exactly.
- [docs/adr](docs/adr): the decisions behind the design:
  - [ADR-0001](docs/adr/0001-price-history-generated-at-build.md): the Price History is generated at image build, pinned by a committed hash.
  - [ADR-0002](docs/adr/0002-best-trade-search-uses-hour-summaries.md): the Best Trade search uses hour summaries.
- [#2](https://github.com/stefan-stefanooov/simple-stock-history/issues/2): the agreed design and the issue tree the work follows.

## Layout

An [Nx](https://nx.dev) workspace with pnpm:

| Path                                                             | What it is                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`apps/api`](apps/api)                                           | NestJS API: loads the Price History, serves the Best Trade. Jest tests.                                 |
| [`apps/web`](apps/web)                                           | React + Vite web app, Tailwind CSS. Vitest tests.                                                       |
| [`libs/shared`](libs/shared)                                     | The API contract: zod schemas for validation, types and the OpenAPI document.                           |
| [`libs/best-trade`](libs/best-trade)                             | The Best Trade search over hour summaries, plain TypeScript ([README](libs/best-trade/README.md)).      |
| [`tools/price-history-generator`](tools/price-history-generator) | Generates the Price History and its hour summaries ([README](tools/price-history-generator/README.md)). |

## Local development

### Setup

1. **Node 24**: `nvm use` reads [`.nvmrc`](.nvmrc). pnpm does not enforce `engines.node` in `package.json`, so `.nvmrc` is the real pin.
2. **pnpm**: run `corepack enable` once. The version is pinned by `packageManager` in `package.json` (`pnpm@12.16.1`). Node 24 ships corepack; Node 25 and later don't, so a future Node bump changes this step. Without `corepack enable`, prefix every `pnpm` command with `corepack`.
3. **Dependencies**: `pnpm install`.

Nx commands below run as `pnpm nx ...`.

### Generate the Price History

```sh
pnpm nx run price-history-generator:generate
```

It writes `data/acme-2025-11.bin` (the Price History), `data/acme-2025-11.hours.bin` (its hour summaries) and `data/acme-2025-11.meta.json`, and checks both files against the sha256s pinned in [`price-history.config.json`](tools/price-history-generator/price-history.config.json). `data/` is gitignored. `api:serve` and `api:test` depend on this target, so you rarely need to run it yourself.

### Serve

```sh
pnpm nx serve api   # http://localhost:3000, routes under /api
pnpm nx serve web   # http://localhost:4200, forwards /api to the API on :3000
```

Open <http://localhost:4200> for the app and <http://localhost:3000/api/docs> for Swagger UI.

The API is configured with env vars (validated at startup by [`app-config.ts`](apps/api/src/app/config/app-config.ts); a bad value stops it with a list of every problem):

| Variable             | Default                 | Meaning                                                                          |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `PORT`               | `3000`                  | HTTP port                                                                        |
| `NODE_ENV`           | `production`            | `development` pretty-prints logs; `test` silences them unless `LOG_LEVEL` is set |
| `LOG_LEVEL`          | `info`                  | pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`       |
| `PRICE_HISTORY_PATH` | `data/acme-2025-11.bin` | The Price History; its `.hours.bin` and `.meta.json` are read from next to it    |
| `SWAGGER_ENABLED`    | `true`                  | `false` turns off Swagger UI and the OpenAPI document                            |

### Test and check

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

CI ([`ci.yml`](.github/workflows/ci.yml)) runs on every PR and on `main`: the affected lint, test, typecheck and build, the Prettier check, the TypeScript project references check, and a build of both container images.

### Container images

Built from the repository root, as CI and the release do:

```sh
docker build --platform linux/amd64 -f apps/api/Dockerfile -t stock-history-api .
docker run --rm -p 3000:3000 stock-history-api

docker build --platform linux/amd64 -f apps/web/Dockerfile -t stock-history-web .
docker run --rm -p 8080:8080 stock-history-web
```

The api image generates and checks the Price History while it builds, so a hash mismatch fails the build. Both images run as non-root. The web image only serves static files; it expects the API on the same origin under `/api`, which the homelab Ingress provides.

## Changing the Price History

The Price History is deterministic: [`price-history.config.json`](tools/price-history-generator/price-history.config.json) holds the seed and the parameters of the random walk, plus the sha256 the Price History and its hour summaries must hash to ([ADR-0001](docs/adr/0001-price-history-generated-at-build.md)). The generator refuses to write anything when a hash differs.

To change it on purpose (a new seed, a change to the walk, the hour length or the hour summary logic in `libs/best-trade`):

1. Make the change.
2. Run `pnpm nx run price-history-generator:generate`. It fails and prints the expected and the actual sha256 of each file.
3. Copy each actual sha256 into the config.
4. Run it again; it must pass.
5. Commit the new hashes in the same PR as the change (ADR-0002).

The Swagger examples are the real answers for the real Price History, and `swagger.spec.ts` replays them, so a new Price History also means updating [`best-trade.examples.ts`](apps/api/src/app/best-trade/best-trade.examples.ts). Details: the [generator's README](tools/price-history-generator/README.md).

## API

All routes for clients are under `/api` and documented in Swagger UI at `/api/docs` (<http://localhost:3000/api/docs> locally); the OpenAPI document is at `/api/docs/openapi.json`. Times are Unix epoch seconds (UTC), prices are in cents, and every error is an RFC 9457 `application/problem+json` body.

| Route                                     | Answers                                                                                                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/period`                      | The Share, the Data Period its Price History covers (`from`, `to`) and the currency                                                                                                                                   |
| `GET /api/v1/trades/best?from=<s>&to=<s>` | The Best Trade in the Time Slice from `from` to `to`, both included, or `trade: null` for No Profitable Trade. 400 for bad input or a Time Slice outside the Data Period, 422 for a Time Slice shorter than 2 seconds |

Both answers are fixed for a release, so they are sent with `Cache-Control: public, max-age=86400`.

Outside `/api`, for the cluster only (Traefik routes only `/api` to the API, so clients can't reach them):

| Route          | Answers                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /healthz` | Liveness: 200 while the process can serve HTTP                                                           |
| `GET /readyz`  | Readiness: 200 once the Price History is loaded and verified, otherwise 503                              |
| `GET /metrics` | Prometheus metrics: Node.js process metrics, HTTP requests, Best Trade search time and Time Slice length |

The API logs one JSON line per request with pino (probes and scrapes are left out).

## Release and deploy

1. **Release**: push a `vX.Y.Z` tag on `main`. The [Release workflow](.github/workflows/release.yml) publishes `ghcr.io/stefan-stefanooov/stock-history-api:X.Y.Z` and `stock-history-web:X.Y.Z`. Steps, checks and recovery: [docs/releasing.md](docs/releasing.md).
2. **Deploy**: the app runs on the homelab k3s cluster at `https://stocks.lan`, deployed by Argo CD from the [homelab repo](https://github.com/stefan-stefanooov/homelab). Its manifests live there, not here ([homelab#6](https://github.com/stefan-stefanooov/homelab/issues/6)). The deployed version is the image tag in `workloads/stock-history/api.yaml` and `web.yaml` there (first release: `0.1.0`). To deploy a release, open a PR in the homelab repo that bumps both image tags to `X.Y.Z`. Merging it to homelab `main` is the deploy: Argo CD syncs it right away. Then check that the Application is Synced and Healthy: `kubectl -n argocd get applications`.

Rolling back is the same: a homelab PR that sets the tags back to the previous version.

## Dashboards, logs and alerts

All of these are deployed and live in the homelab repo, next to the app's manifests in [`workloads/stock-history`](https://github.com/stefan-stefanooov/homelab/tree/main/workloads/stock-history). Grafana is at <https://grafana.lan>.

- **Dashboard**: [stock-history](https://grafana.lan/d/stock-history) ([homelab#8](https://github.com/stefan-stefanooov/homelab/issues/8)). It shows request rate by route and status, p95 latency, 5xx ratio, Best Trade search time, Time Slice length, rate-limited requests (429s, counted by Traefik), container CPU and memory against requests and limits, and the API's logs. Prometheus scrapes the API's `/metrics` every 30 seconds as `job="stock-history-api"`.
- **Logs**: in Grafana, from Loki, kept 7 days ([homelab#5](https://github.com/stefan-stefanooov/homelab/issues/5)). Explore → Loki, for example `{namespace="stock-history", container="api"} | json | res_statusCode >= 500`. Each request log line carries the method, URL, status code, client IP and request id. Without Grafana: `kubectl -n stock-history logs deploy/api`.
- **Alerts** ([homelab#9](https://github.com/stefan-stefanooov/homelab/issues/9)): `StockHistoryApiDown` (scrapes failing or no ready api pod, for 2 minutes), `StockHistoryApiHighErrorRate` (more than 5% 5xx, for 5 minutes) and `StockHistoryApiHighLatency` (p95 above 500 ms, for 10 minutes). They have promtool unit tests in the homelab repo. There is no notification channel yet, so alerts only show in Grafana (Alerting) and Alertmanager.
- **Rate limit** ([homelab#7](https://github.com/stefan-stefanooov/homelab/issues/7)): Traefik limits `/api` to 60 requests a minute per client IP, with bursts of 20. Over the limit, clients get `429 Too Many Requests` with `Retry-After`, and the API never sees the request. The web app isn't limited.
- **HSTS**: Traefik sets `Strict-Transport-Security` for the whole host ([homelab#6](https://github.com/stefan-stefanooov/homelab/issues/6)); neither image sends it ([#53](https://github.com/stefan-stefanooov/simple-stock-history/issues/53)).

## Contributing

Work follows the issue tree in [#2](https://github.com/stefan-stefanooov/simple-stock-history/issues/2): one leaf issue, one PR, whose body says `Closes #<n>`. Sign off every commit (`git commit -s`); the DCO check fails a PR with an unsigned commit. More in [CLAUDE.md](CLAUDE.md).
