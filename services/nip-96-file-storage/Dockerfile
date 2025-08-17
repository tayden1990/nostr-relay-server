FROM node:20-alpine AS deps
WORKDIR /app
# Copy manifest only (avoid problematic package-lock with local file refs)
COPY package.json yarn.lock* pnpm-lock.yaml* ./
# Prefer yarn/pnpm; otherwise use npm ci if package-lock.json exists; fall back to npm install.
RUN if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci || npm install; \
    else npm install; fi

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build || echo "Skipping build if plain ts-node runtime"

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=build /app .
EXPOSE 3001
# Healthcheck for /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health >/dev/null 2>&1 || exit 1
CMD ["node", "dist/server.js"]
