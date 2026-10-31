# syntax=docker/dockerfile:1

# The web app: Vite builds it, nginx serves it on port 8080 as a non-root user.
# Build from the repository root:
#   docker build --platform linux/amd64 -f apps/web/Dockerfile -t stock-history-web .
#   docker run --rm -p 8080:8080 stock-history-web

# The static build is the same for every platform, so this stage runs on the
# builder's own platform. The Node major version follows .nvmrc.
FROM --platform=$BUILDPLATFORM node:24-trixie-slim AS build
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
RUN pnpm nx run web:build

FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/web
# Fail the build, not the rollout, on a broken nginx config
RUN nginx -t
# The base image already runs as the unprivileged nginx user (UID 101); stated
# here so the image's contract is visible in this file.
USER 101
EXPOSE 8080
