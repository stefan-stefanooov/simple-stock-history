# syntax=docker/dockerfile:1

# The api: webpack bundles it, the generator writes and checks the Price History
# and its hour summaries (ADR-0001, ADR-0002), and Node serves it on port 3000
# as a non-root user. Build from the repository root:
#   docker build --platform linux/amd64 -f apps/api/Dockerfile -t stock-history-api .
#   docker run --rm -p 3000:3000 stock-history-api
# Then try http://localhost:3000/api/v1/period, /api/docs, /healthz, /readyz
# and /metrics.
# Settings are env vars (apps/api/src/app/config/app-config.ts), for example
#   docker run --rm -p 3000:3000 -e LOG_LEVEL=debug -e SWAGGER_ENABLED=false stock-history-api

# The bundle, the production node_modules (plain JavaScript, no native addons)
# and the Price History (integer-only, ADR-0001) are the same for every
# platform, so these stages run on the builder's own platform. If a dependency
# with a native addon is ever added, `pnpm deploy` must move to a stage on the
# target platform. The Node major version follows .nvmrc.
FROM --platform=$BUILDPLATFORM node:24-trixie-slim AS workspace
ENV CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NX_DAEMON=false \
    NX_NO_CLOUD=true
RUN corepack enable
WORKDIR /repo

# pnpm fetch reads only the lockfile, so the slow download below is redone
# only when these files change. package.json is here for the pnpm version it
# pins in packageManager.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline

FROM workspace AS build
RUN pnpm nx run api:build
# The bundle leaves some packages external: those in the root package.json,
# like @nestjs/core (which loads @nestjs/platform-express itself), and the
# ones apps/api/webpack.config.js lists. So the runtime needs them and what
# they load. `pnpm deploy --prod` installs the api's production dependencies,
# at the lockfile's versions, into a folder of their own; only its
# node_modules is kept. It is not --offline because it checks the lockfile it
# writes against pnpm's supply-chain policies, which needs registry metadata;
# the packages themselves come from the store filled by pnpm fetch. The
# workspace libraries are in the bundle, and their copies here hold sources,
# specs and the benchmark, so they are removed.
RUN pnpm --filter @simple-stock-history/api deploy --prod /deploy \
 && rm -rf /deploy/node_modules/@simple-stock-history \
           /deploy/node_modules/.pnpm/@simple-stock-history+*

FROM workspace AS generate
# Writes data/acme-2025-11.bin, .hours.bin and .meta.json. The generator exits
# 1 without writing anything if either sha256 differs from the one pinned in
# tools/price-history-generator/price-history.config.json, failing the build.
RUN pnpm nx run price-history-generator:generate

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    PRICE_HISTORY_PATH=/app/data/acme-2025-11.bin
# Owned by root and read-only to the user the api runs as
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist/main.js ./
COPY --from=generate /repo/data/acme-2025-11.bin /repo/data/acme-2025-11.hours.bin /repo/data/acme-2025-11.meta.json ./data/
# The base image's unprivileged node user, by UID so Kubernetes can check
# runAsNonRoot.
USER 1000:1000
EXPOSE 3000
# For plain Docker; Kubernetes ignores this and probes /healthz and /readyz
# itself. Node's fetch needs no extra tools in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Exec form, so node is PID 1 and gets SIGTERM for the api's graceful shutdown
CMD ["node", "main.js"]
