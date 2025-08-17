FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
# Prefer yarn/pnpm when lockfiles exist; otherwise use npm ci if package-lock.json exists; fall back to npm install.
RUN if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci || npm install; \
    else npm install; fi

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json package.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=8080
# Prefer service-name defaults; override in aaPanel:
ENV DATABASE_URL=postgres://user:password@postgres:5432/nostr \
    REDIS_URL=redis://redis:6379
# OCI metadata (provided via build args from CI)
ARG VCS_REF
ARG BUILD_DATE
ARG VERSION=1.0.0
ARG REPO_URL="https://github.com/tayden1990/nostr-relay-server"
LABEL org.opencontainers.image.title="Nostr Relay Server" \
      org.opencontainers.image.description="A Nostr relay server supporting many NIPs, with Postgres + Redis and optional NIP-96 file storage." \
      org.opencontainers.image.url="${REPO_URL}" \
      org.opencontainers.image.source="${REPO_URL}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="tayden1990"
# app artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
# include SQL migrations in dist path expected by migrate script
COPY src/storage/postgres/migrations ./dist/src/storage/postgres/migrations
EXPOSE 8080
# Simple healthcheck hitting /health (busybox wget is available in alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health >/dev/null 2>&1 || exit 1
# Run DB migrations, then start the app
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/src/app.js"]
