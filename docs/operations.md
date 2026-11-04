# Operations

[← README](../README.md)

How the app is released, deployed and watched on the homelab.

## Release and deploy

1. **Release**: push a `vX.Y.Z` tag on `main`. The [Release workflow](../.github/workflows/release.yml) publishes `ghcr.io/stefan-stefanooov/stock-history-api:X.Y.Z` and `stock-history-web:X.Y.Z`. Steps, checks and recovery: [Releasing](releasing.md).
2. **Deploy**: the app runs on the homelab k3s cluster at `https://stocks.lan`, deployed by Argo CD from the [homelab repo](https://github.com/stefan-stefanooov/homelab). Its manifests live there, not here ([homelab#6](https://github.com/stefan-stefanooov/homelab/issues/6)). The deployed version is the image tag in `workloads/stock-history/api.yaml` and `web.yaml` there (first release: `0.1.0`). To deploy a release, open a PR in the homelab repo that bumps both image tags to `X.Y.Z`. Merging it to homelab `main` is the deploy: Argo CD syncs it right away. Then check that the Application is Synced and Healthy: `kubectl -n argocd get applications`.

Rolling back is the same: a homelab PR that sets the tags back to the previous version.

## Dashboards, logs and alerts

All of these are deployed and live in the homelab repo, next to the app's manifests in [`workloads/stock-history`](https://github.com/stefan-stefanooov/homelab/tree/main/workloads/stock-history). Grafana is at <https://grafana.lan>.

- **Dashboard**: [stock-history](https://grafana.lan/d/stock-history) ([homelab#8](https://github.com/stefan-stefanooov/homelab/issues/8)). It shows request rate by route and status, p95 latency, 5xx ratio, Best Trade search time, Time Slice length, rate-limited requests (429s, counted by Traefik), container CPU and memory against requests and limits, and the API's logs. Prometheus scrapes the API's `/metrics` every 30 seconds as `job="stock-history-api"`.
- **Logs**: in Grafana, from Loki, kept 7 days ([homelab#5](https://github.com/stefan-stefanooov/homelab/issues/5)). Explore → Loki, for example `{namespace="stock-history", container="api"} | json | res_statusCode >= 500`. Each request log line carries the method, URL, status code, client IP and request id; for an error response it also carries the reason the client was sent (`res.detail`, and `res.issues` for a 400), and for a 500 the error itself (`err`). Without Grafana: `kubectl -n stock-history logs deploy/api`.
- **Alerts** ([homelab#9](https://github.com/stefan-stefanooov/homelab/issues/9)): `StockHistoryApiDown` (scrapes failing or no ready api pod, for 2 minutes), `StockHistoryApiHighErrorRate` (more than 5% 5xx, for 5 minutes) and `StockHistoryApiHighLatency` (p95 above 500 ms, for 10 minutes). They have promtool unit tests in the homelab repo. There is no notification channel yet, so alerts only show in Grafana (Alerting) and Alertmanager.
- **Rate limit** ([homelab#7](https://github.com/stefan-stefanooov/homelab/issues/7)): Traefik limits `/api` to 60 requests a minute per client IP, with bursts of 20. Over the limit, clients get `429 Too Many Requests` with `Retry-After`, and the API never sees the request. The web app isn't limited.
- **HSTS**: Traefik sets `Strict-Transport-Security` for the whole host ([homelab#6](https://github.com/stefan-stefanooov/homelab/issues/6)); neither image sends it ([#53](https://github.com/stefan-stefanooov/simple-stock-history/issues/53)).
