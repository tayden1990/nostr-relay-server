# Nostr Relay Server

[![Build & Publish](https://github.com/tayden1990/nostr-relay-server/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/tayden1990/nostr-relay-server/actions)
![Docker Pulls](https://img.shields.io/docker/pulls/taksa1990/nostr-relay)
![Image Size](https://img.shields.io/docker/image-size/taksa1990/nostr-relay/latest)

A production-ready Nostr relay server written in TypeScript. It implements core NIPs, stores events in Postgres, uses Redis for fan-out, and offers optional NIP-96 HTTP file storage.

## Table of contents
- Features and supported NIPs
- Quickstart
- Elementary step-by-step (no Compose)
- Docker Compose
- aaPanel setup (step-by-step)
- Ports, URLs and TLS
- Configuration (env vars)
- Publish to Docker Hub and GitHub
- Troubleshooting

## Features
- WebSocket and HTTP endpoints
- NIP-11 relay info with supported NIPs
- Postgres storage with replaceable and parameterized replaceable handling
- NIP-09 deletion, NIP-40 expiration, and ephemeral non-persistence
- Redis pub/sub for real-time delivery
- Optional NIP-96 file storage microservice (local or S3)
- Prometheus metrics

## Supported NIPs
1, 2, 4, 5, 9, 10, 11, 13, 17, 18, 19, 21, 23, 25, 27, 28, 29, 30, 33, 40, 42, 44, 47, 51, 57, 58, 59, 65, 78, 96, 98

## Quickstart (Docker)
```bash
docker pull taksa1990/nostr-relay:latest
docker run --rm -p 8080:8080 \
  -e DATABASE_URL="postgres://user:password@host:5432/nostr" \
  -e REDIS_URL="redis://host:6379" \
  taksa1990/nostr-relay:latest
```
Health and info:
- Health: GET http://localhost:8080/health
- Readiness: GET http://localhost:8080/ready
- NIP-11: GET http://localhost:8080/.well-known/nostr.json

## Elementary step-by-step (no Compose)
Stop any old containers:
```bash
docker stop nostr-relay postgres redis 2>/dev/null || true
docker rm   nostr-relay postgres redis 2>/dev/null || true
```
Ensure a shared network:
```bash
docker network inspect nostr-net >/dev/null 2>&1 || docker network create nostr-net
```
Run Postgres and Redis:
```bash
docker run -d --name postgres --network nostr-net \
  -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=nostr \
  -v /srv/nostr/pgdata:/var/lib/postgresql/data postgres:13

docker run -d --name redis --network nostr-net \
  redis:6 redis-server --appendonly yes
```
Run the relay:
```bash
docker pull taksa1990/nostr-relay:latest
docker run -d --name nostr-relay --network nostr-net -p 8080:8080 \
  -e NODE_ENV=production -e PORT=8080 \
  -e DATABASE_URL=postgres://user:password@postgres:5432/nostr \
  -e REDIS_URL=redis://redis:6379 \
  taksa1990/nostr-relay:latest
```
Validate:
- http://YOUR_SERVER_IP:8080/health
- http://YOUR_SERVER_IP:8080/.well-known/nostr.json
- WebSocket: ws://YOUR_SERVER_IP:8080

## Ports and URLs
- Default container port: 8080 (configurable via PORT env).
- Standalone Docker: publish with -p 8080:8080 and connect your client to ws://HOST:8080.
- Behind TLS proxy: use wss://YOUR_DOMAIN and forward Upgrade + /.well-known/nostr.json.

```yaml
# Docker Compose without reverse proxy
services:
  nostr-relay:
    image: taksa1990/nostr-relay:latest
    environment:
      - DATABASE_URL=postgres://user:password@postgres:5432/nostr
      - REDIS_URL=redis://redis:6379
    ports:
      - "8080:8080"
    depends_on: [postgres, redis]
  postgres:
    image: postgres:13
  redis:
    image: redis:6
```

## Docker Compose (with NIP-96)
See docker/docker-compose.yml for a full stack (Relay + Postgres + Redis + Caddy + NIP-96). Basic example:
```yaml
services:
  nostr-relay:
    image: taksa1990/nostr-relay:latest
    environment:
      - DATABASE_URL=postgres://user:password@postgres:5432/nostr
      - REDIS_URL=redis://redis:6379
    ports: ["8080:8080"]
    depends_on: [postgres, redis]

  postgres:
    image: postgres:13
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: nostr

  redis:
    image: redis:6
```

## Configuration (env vars)
- PORT: default 8080
- DATABASE_URL: Postgres connection string
- REDIS_URL: Redis connection string
- MAX_MESSAGE_SIZE: default 1048576 (bytes, also sets express.json limit)
- RELAY_NAME, RELAY_DESCRIPTION: for NIP-11
- CREATED_AT_MAX_FUTURE_SKEW_SEC: default 900 (NIP-22 future skew)
- CREATED_AT_MAX_AGE_SEC: default 604800 (NIP-22 max age)
- RATE_LIMIT: default 100 (requests per window)
- RATE_LIMIT_WINDOW_MS: default 60000 (window in ms)
- REQUIRE_AUTH_FOR_WRITE: "true" to require NIP-42 auth to publish events (default "false")
- RUN_MIGRATIONS: "1" to execute dist/scripts/migrate.js on container start (default "0")

NIP-96 service (optional):
- PORT: default 3001
- STORAGE_METHOD: local or s3
- BASE_URL: prefix/origin for returned links
- MAX_FILE_SIZE: bytes (default 52428800)

## Important: the published image is not all-in-one
- taksa1990/nostr-relay:latest only runs the relay.
- Postgres and Redis must run as separate containers (or external services).

## aaPanel: exact settings (step-by-step)
1) Docker > Network > Add
- Network name: nostr-net
- Device (driver): bridge
- IPv4 subnet: leave empty (auto) OR 172.25.0.0/16
- IPv4 gateway: leave empty (auto) OR 172.25.0.1
- IPv4 range: leave empty (optional) OR 172.25.0.0/24
- Enable IPv6: OFF
- Confirm


2) Create Postgres
- Image: postgres:13
- Network: nostr-net
- Env (one per line):
  POSTGRES_USER=user
  POSTGRES_PASSWORD=password
  POSTGRES_DB=nostr
- Volume: /srv/nostr/pgdata:/var/lib/postgresql/data

3) Create Redis
- Image: redis:6
- Network: nostr-net
- Command: redis-server --appendonly yes
- Volume (optional): /srv/nostr/redis:/data

4) Create Relay (taksa1990/nostr-relay:latest)
- Network: nostr-net
- Ports: 8080 (host) -> 8080 (container)
- Env (one per line):
  NODE_ENV=production
  PORT=8080
  DATABASE_URL=postgres://user:password@postgres:5432/nostr
  REDIS_URL=redis://redis:6379
  RELAY_NAME=your-relay-name-or-domain
  RELAY_DESCRIPTION=Your relay description

Test:
- http://YOUR_SERVER_IP:8080/health
- http://YOUR_SERVER_IP:8080/.well-known/nostr.json
- WebSocket: ws://YOUR_SERVER_IP:8080

aaPanel Compose template:
```yaml
services:
  postgres:
    image: postgres:13
    restart: unless-stopped
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: nostr
    volumes:
      - /srv/nostr/pgdata:/var/lib/postgresql/data
    networks: [nostr-net]

  redis:
    image: redis:6
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - /srv/nostr/redis:/data
    networks: [nostr-net]

  nostr-relay:
    image: taksa1990/nostr-relay:latest
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 8080
      DATABASE_URL: postgres://user:password@postgres:5432/nostr
      REDIS_URL: redis://redis:6379
      RELAY_NAME: your-relay-name-or-domain
      RELAY_DESCRIPTION: Your relay description
      MAX_MESSAGE_SIZE: 2097152
    ports:
      - "8080:8080"
    depends_on: [postgres, redis]
    networks: [nostr-net]

networks:
  nostr-net:
    external: true
```

## Publish to Docker Hub and GitHub
- Docker Hub (manual):
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t YOUR_DH_USER/nostr-relay:latest --push .
```
- GitHub Actions:
  - Set repo secrets: DOCKERHUB_USERNAME, DOCKERHUB_TOKEN
  - Push to main/master; workflow .github/workflows/docker-publish.yml builds and pushes multi-arch with OCI labels and healthcheck baked in.

## Troubleshooting
- ECONNREFUSED 127.0.0.1:5432 or 127.0.0.1:6379:
  - Set DATABASE_URL=postgres://user:password@postgres:5432/nostr
  - Set REDIS_URL=redis://redis:6379
  - Ensure all three containers are on the same network (nostr-net)
- 502 from proxy:
  - Put proxy and relay on the same network and target nostr-relay:8080
- Port binding:
  - Avoid “publish all ports”; map explicitly: -p 8080:8080
- “No relay acknowledgement” when publishing:
  - If your client does not support NIP-42 auth, set REQUIRE_AUTH_FOR_WRITE=false (default).
  - Check /metrics ws_messages_total and events_ingested_total while publishing.
- NIP-11 “Failed to fetch”:
  - Use: http://YOUR_SERVER_IP:8080/.well-known/nostr.json
  - If behind TLS proxy, ensure the proxy allows GET/HEAD/OPTIONS and does not strip /.well-known.
  - CORS is enabled with Access-Control-Allow-Origin: * on NIP-11 responses.

## Building locally
```bash
npm install
npm run build
npm test
npm start
```

## Image metadata
- org.opencontainers.image.title, description, version, revision, url, source, licenses

## License
MIT

## Fix migration syntax error (near WHERE)

If the container logs show “Error running migrations: syntax error at or near WHERE”, your SQL migration has a stray WHERE or duplicated index blocks. Update your migration (e.g., src/storage/postgres/migrations/001_init.sql) to use this tag-array trigger/function and keep only one set of unique indexes:

```sql
-- filepath: src/storage/postgres/migrations/001_init.sql
-- Ensure helper columns exist
ALTER TABLE nostr_events
  ADD COLUMN IF NOT EXISTS e_tags text[],
  ADD COLUMN IF NOT EXISTS p_tags text[];

-- Set e_tags/p_tags from JSONB tags
CREATE OR REPLACE FUNCTION nostr_events_update_tag_arrays()
RETURNS TRIGGER AS $$
BEGIN
  NEW.e_tags := (
    SELECT array_agg(elem->>1)
    FROM jsonb_array_elements(NEW.tags) AS elem
    WHERE elem->>0 = 'e'
  );
  NEW.p_tags := (
    SELECT array_agg(elem->>1)
    FROM jsonb_array_elements(NEW.tags) AS elem
    WHERE elem->>0 = 'p'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nostr_events_set_tag_arrays ON nostr_events;
CREATE TRIGGER nostr_events_set_tag_arrays
BEFORE INSERT OR UPDATE OF tags ON nostr_events
FOR EACH ROW
EXECUTE FUNCTION nostr_events_update_tag_arrays();

-- Indexes for tag lookups
CREATE INDEX IF NOT EXISTS idx_events_e_tags_gin ON nostr_events USING GIN (e_tags);
CREATE INDEX IF NOT EXISTS idx_events_p_tags_gin ON nostr_events USING GIN (p_tags);

-- Keep one set of unique indexes only (remove duplicates if present)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_replaceable_pubkey_kind
  ON nostr_events (pubkey, kind)
  WHERE kind IN (0,3) AND deleted = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_param_replaceable
  ON nostr_events (pubkey, kind, d_tag)
  WHERE kind BETWEEN 30000 AND 39999 AND d_tag IS NOT NULL AND deleted = FALSE;
```

After updating the SQL, restart the stack:
```bash
docker restart nostr-relay
# or re-pull/recreate if needed:
# docker stop nostr-relay && docker rm nostr-relay
# docker pull taksa1990/nostr-relay:latest
# docker run -d --name nostr-relay --network nostr-net -p 8080:8080 \
#   -e NODE_ENV=production -e PORT=8080 \
#   -e DATABASE_URL=postgres://user:password@postgres:5432/nostr \
#   -e REDIS_URL=redis://redis:6379 \
#   taksa1990/nostr-relay:latest
```

## Docker Hub Overview (copy/paste)

Production-ready Nostr relay server written in TypeScript. Implements core NIPs, stores events in Postgres, uses Redis pub/sub for fan-out, and offers optional NIP-96 HTTP file storage.

Features
- WebSocket and HTTP endpoints
- NIP-11 relay info
- Postgres storage (replaceable and parameterized replaceable)
- NIP-09 deletion, NIP-40 expiration, ephemeral non-persistence
- Redis pub/sub for real-time delivery
- Prometheus /metrics

Image
- Repository: taksa1990/nostr-relay
- Tag: latest
- Exposed port: 8080
- Healthcheck: GET /health

Requirements
- Postgres 13+
- Redis 6+
- These are external dependencies; this image is not all-in-one.

Quick start
```bash
docker pull taksa1990/nostr-relay:latest
docker run -d --name nostr-relay -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e DATABASE_URL=postgres://user:password@DB_HOST:5432/nostr \
  -e REDIS_URL=redis://REDIS_HOST:6379 \
  taksa1990/nostr-relay:latest
```

Recommended (networked services)
```bash
docker network create nostr-net

docker run -d --name postgres --network nostr-net \
  -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=nostr \
  postgres:13

docker run -d --name redis --network nostr-net redis:6

docker run -d --name nostr-relay --network nostr-net -p 8080:8080 \
  -e NODE_ENV=production -e PORT=8080 \
  -e DATABASE_URL=postgres://user:password@postgres:5432/nostr \
  -e REDIS_URL=redis://redis:6379 \
  taksa1990/nostr-relay:latest
```

Docker Compose (minimal)
```yaml
services:
  nostr-relay:
    image: taksa1990/nostr-relay:latest
    environment:
      - DATABASE_URL=postgres://user:password@postgres:5432/nostr
      - REDIS_URL=redis://redis:6379
    ports: ["8080:8080"]
    depends_on: [postgres, redis]
  postgres:
    image: postgres:13
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: nostr
  redis:
    image: redis:6
```

Environment variables
- PORT: default 8080
- DATABASE_URL: postgres://USER:PASS@HOST:5432/DB
- REDIS_URL: redis://HOST:6379
- MAX_MESSAGE_SIZE: default 1048576
- RELAY_NAME, RELAY_DESCRIPTION: NIP-11 info (optional)

Health and info
- Health: http://HOST:8080/health
- Readiness: http://HOST:8080/ready
- NIP-11: http://HOST:8080/.well-known/nostr.json
- Metrics: http://HOST:8080/metrics

Notes
- Put a reverse proxy (Caddy/Nginx) in front for TLS and use wss://YOUR_DOMAIN.
- If logs show ECONNREFUSED 127.0.0.1 for DB/Redis, set DATABASE_URL/REDIS_URL to service names/hosts reachable from the container.

Links
- Source: https://github.com/tayden1990/nostr-relay-server
- Issues: https://github.com/tayden1990/nostr-relay-server/issues
- License: MIT

## Debug checklist

1) Check container logs
```bash
docker logs -f --tail=200 nostr-relay
```

2) Verify readiness (DB reachable)
- http://YOUR_SERVER_IP:8080/ready should return {"ok":true,"db":"ok"} when DATABASE_URL is set and reachable.

3) Verify schema in Postgres
```bash
docker exec -it postgres psql -U user -d nostr -c "\d nostr_events"
# If the table is missing, repository bootstrap should create it on first query.
```

4) Exercise endpoints
```bash
curl -fsS http://YOUR_SERVER_IP:8080/health
curl -fsS http://YOUR_SERVER_IP:8080/.well-known/nostr.json
```

5) WebSocket smoke test
- Connect with a Nostr client to ws://YOUR_SERVER_IP:8080
- Subscribe (REQ), you should receive EOSE and events if any exist.

If migrate.js fails but the app is up, the repository bootstrap will create the schema automatically on first use. Fix your migration file later as documented in “Fix migration syntax error”.