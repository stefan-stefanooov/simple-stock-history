# API

[← README](../README.md)

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

## Metrics

`GET /metrics` serves these in the Prometheus text format; Prometheus scrapes it every 30 seconds as `job="stock-history-api"`:

| Metric                                 | Type      | Labels                           | Measures                                                                                    |
| -------------------------------------- | --------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `http_requests_total`                  | counter   | `method`, `route`, `status_code` | Requests answered. Errors are the 4xx and 5xx values of `status_code`                       |
| `http_request_duration_seconds`        | histogram | `method`, `route`, `status_code` | Time from receiving a request to sending its response                                       |
| `best_trade_search_duration_seconds`   | histogram |                                  | Time the Best Trade search takes for one Time Slice, buckets from 5 µs to 10 ms             |
| `best_trade_time_slice_length_seconds` | histogram |                                  | Length of each valid Time Slice asked about, buckets from a minute to the whole Data Period |

- `route` is the route template, such as `/api/v1/trades/best`, so it has one value per route however clients write the URL. Requests no route answered (404s, Swagger UI) get `route="unmatched"`.
- `/healthz`, `/readyz` and `/metrics` are not counted.
- The search buckets stop at 10 ms on purpose: the search takes about 15–40 µs and the plain loop it replaced about 6 ms (ADR-0002), so a slower node or a regression to that loop shows.
- The Node.js process metrics come from prom-client's defaults: CPU, memory, heap, event-loop lag, garbage collection, open handles.
- Requests rejected by the rate limit (429) never reach the API; Traefik counts them in `traefik_router_requests_total`.

## Logs

The API logs one JSON line per request with pino (probes and scrapes are left out): `info` for 2xx and 3xx, `warn` for 4xx, `error` for 5xx.
