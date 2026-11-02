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

The API logs one JSON line per request with pino (probes and scrapes are left out).
