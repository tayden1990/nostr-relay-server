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
- Self-host (aaPanel/VPS) with NIP-96 and Nginx
- Ports, URLs and TLS
- Configuration (env vars)
- Diagnostics (relay-diagnostic.ts)
- Publish to Docker Hub and GitHub
- Troubleshooting
- Logging and log viewer

## Features
- WebSocket and HTTP endpoints
- NIP-11 relay info with supported NIPs
- Postgres storage with replaceable and parameterized replaceable handling
- NIP-09 deletion, NIP-40 expiration, and ephemeral non-persistence
- Redis pub/sub for real-time delivery
- Optional NIP-96 file storage microservice (local or S3)
- Prometheus metrics

## Supported NIPs
1, 2, 4, 5, 9, 10, 11, 13, 15, 17, 18, 19, 21, 23, 25, 27, 28, 29, 30, 33, 40, 42, 44, 45, 47, 51, 57, 58, 59, 65, 78, 96, 98

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
- MAX_FILTERS: cap number of filters per REQ/COUNT (default 20, advertised in NIP-11)
- MAX_LIMIT: cap per-filter "limit" (default 500, advertised in NIP-11)

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

## Logging and log viewer
This server emits structured JSON logs to files and human-friendly logs to console.

- File location: LOG_DIR (default ./logs) with combined.log and error.log
- Optional rotation: if winston-daily-rotate-file is installed, files rotate daily (combined-%DATE%.log, error-%DATE%.log) and can be gzipped

Viewer endpoints (no auth by default; protect via proxy or network ACL):
- GET /logs — Simple HTML UI with filters and a Download button
- GET /logs/list — JSON list of available log files
- GET /logs/view — View logs as JSON with filters:
  - Query params: file, level=error|warn|info|debug, q=<substring>, limit=10..1000
  - Example: /logs/view?level=error&q=postgres&limit=200
- GET /logs/download — Download a raw log file
  - Query param: file (e.g., combined.log or combined-2025-08-18.log.gz)

Quick examples
```bash
# HTML UI (open in browser)
http://HOST:8080/logs

# List files
curl -s http://HOST:8080/logs/list | jq .

# Filter view (last 200 error lines containing "redis")
curl -s "http://HOST:8080/logs/view?level=error&q=redis&limit=200" | jq .

# Download a specific file
curl -OJ "http://HOST:8080/logs/download?file=combined.log"
```

Logging configuration (env)
- LOG_DIR: directory for log files (default ./logs)
- LOG_LEVEL: error | warn | info | debug (default info)
- LOG_MAX_FILES: retention when rotation is enabled (e.g., "14d")
- Note: for daily rotation, add winston-daily-rotate-file to your image/env. Without it, logs go to combined.log and error.log.

Security
- Place /logs behind your reverse proxy’s auth/ACL if exposed to the internet.
- Alternatively, bind the relay to a private network and access /logs via your admin VPN.

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

## Architecture overview
- Entrypoint: HTTP (Express) + WebSocket (ws)
- Storage: Postgres (events, replaceable/parameterized replaceable)
- Fan-out: Redis pub/sub for live EVENT delivery
- Metrics: Prometheus /metrics
- Optional: NIP-96 file storage sidecar (local or S3)

Data flow:
client -> EVENT/REQ over WS -> validate -> repository (Postgres) -> publish to Redis -> subscribers receive EVENT; queries served from Postgres.

## Protocol (NIPs) quick reference
- Client -> Relay: EVENT, REQ, CLOSE, AUTH, COUNT
- Relay -> Client: EVENT, OK, EOSE, NOTICE, CLOSED, AUTH, COUNT
- Writes: relay accepts ["EVENT", <event>] or bare event object and replies ["OK", <id>, <accepted>, <msg>]
- EOSE (NIP-15): sent after historical events for a REQ
- COUNT (NIP-45): ["COUNT", subId, { count }]

See the canonical NIPs list: https://github.com/nostr-protocol/nips

## HTTP API
- GET /health -> { status: "ok" }
- GET /ready -> checks DB connectivity
- GET /.well-known/nostr.json -> NIP-11 relay info (CORS enabled)
- HEAD/OPTIONS /.well-known/nostr.json -> preflight/probes
- GET /metrics -> Prometheus exposition
- POST /events -> Minimal HTTP ingestion (for tests/tools)
- GET /debug/nip11 -> Effective NIP-11 payload + select env (debug)

## Configuration (env vars)
- PORT: default 8080
- HOST: default 0.0.0.0
- DATABASE_URL, REDIS_URL
- RELAY_NAME, RELAY_DESCRIPTION
- RELAY_CONTACT: email/identifier advertised in NIP-11
- RELAY_PUBKEY: hex pubkey advertised in NIP-11
- MAX_MESSAGE_SIZE: JSON body limit (bytes), affects Express and NIP-11 limitation
- REQUIRE_AUTH_FOR_WRITE: "true" to enforce NIP-42 for EVENT (default "false")
- MAX_FILTERS: cap number of filters per REQ/COUNT (default 20)
- MAX_LIMIT: cap per-filter limit (default 500)
- RATE_LIMIT, RATE_LIMIT_WINDOW_MS: simple HTTP rate limiting knobs (if enabled)
- RUN_MIGRATIONS: "1" to run dist/scripts/migrate.js at start (default "0")

NIP-96 service (sidecar):
- PORT (default 3001), STORAGE_METHOD(local|s3), BASE_URL, MAX_FILE_SIZE
- AWS_REGION, S3_BUCKET_NAME (for S3)

## Prometheus metrics
Emitted counters/gauges/histograms:
- http_requests_total{method,route,status}
- http_request_duration_seconds{method,route,status}
- ws_connections (gauge), ws_messages_total
- events_ingested_total
- query_duration_seconds (DB for REQ/COUNT)
- db_up, redis_up
- nip11_requests_total{status}, nip11_last_success_timestamp
- message_count (compat), delivery_latency_seconds, file_upload_size_bytes

## Reverse proxy (Caddy) example
```
:443 {
  tls you@example.com
  encode zstd gzip
  @nostr path /.well-known/nostr.json
  route @nostr {
    header {
      Access-Control-Allow-Origin "*"
      Access-Control-Allow-Methods "GET, OPTIONS, HEAD"
      Access-Control-Allow-Headers "Content-Type, Accept"
    }
    reverse_proxy nostr-relay:8080
  }
  route {
    reverse_proxy nostr-relay:8080 {
      header_up Connection {>Connection}
      header_up Upgrade {>Upgrade}
    }
  }
}
```

## Reverse proxy (Nginx) example

Important: many Nginx templates block “dotfiles” via location ~ /\. which unintentionally blocks /.well-known/nostr.json. Add an explicit exception BEFORE any dotfile/regex deny blocks.

```
server {
  listen 80;
  server_name YOUR_HOST;

  # If you have TLS, use listen 443 ssl http2; and your ssl_* directives.

  # 1) NIP-11: forward /.well-known/nostr.json explicitly (CORS + cache ok)
  location = /.well-known/nostr.json {
    proxy_pass http://nostr-relay:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Optional: surface CORS from proxy (the app also sets these)
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS, HEAD" always;
    add_header Access-Control-Allow-Headers "Content-Type, Accept" always;
    add_header Cache-Control "public, max-age=60" always;
  }

  # 2) WebSocket + HTTP to relay
  location / {
    proxy_pass http://nostr-relay:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # 3) If your config has a "deny dotfiles" rule, keep it AFTER the /.well-known block.
  # location ~ /\. {
  #   deny all;
  # }
}
```

Notes
- Replace nostr-relay with the container/service name or 127.0.0.1:8080 if running locally.
- Also forward HEAD and OPTIONS unmodified; the explicit location handles them.
- If you still see 404 from Nginx, ensure no other location blocks match before the one above (directive order matters).

## Self-host (aaPanel/VPS) with NIP-96 and Nginx

Use this compact Compose to run Relay + Postgres + Redis + NIP-96 locally and terminate TLS in Nginx. Relay listens on 127.0.0.1:8080, NIP-96 on 127.0.0.1:3001.

```yaml
version: "3.8"
services:
  relay:
    build:
      context: https://github.com/tayden1990/nostr-relay-server.git#main
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: "production"
      PORT: "8080"
      DATABASE_URL: "postgres://user:password@postgres:5432/nostr"
      REDIS_URL: "redis://redis:6379"
      RELAY_NAME: "YOUR RELAY NAME"
      RELAY_DESCRIPTION: "Your relay description"
    expose: ["8080"]
    ports: ["127.0.0.1:8080:8080"]
    depends_on: [postgres, redis]

  postgres:
    image: postgres:13
    restart: unless-stopped
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: nostr
    volumes:
      - ./data/postgres:/var/lib/postgresql/data

  redis:
    image: redis:6
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - ./data/redis:/data

  nip96:
    build:
      context: "https://github.com/tayden1990/nostr-relay-server.git#main:services/nip-96-file-storage"
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      PORT: "3001"
      STORAGE_METHOD: "local"
      BASE_URL: "https://YOUR_DOMAIN"
      LOCAL_DIR: "/data/uploads"
      UPLOAD_TMP_DIR: "/data/uploads/tmp"
      ALWAYS_COPY_UPLOADS: "true"
      NIP98_REQUIRED: "false"
    expose: ["3001"]
    ports: ["127.0.0.1:3001:3001"]
    volumes:
      - ./data/uploads:/data/uploads
```

Nginx path routing (add inside your server block)
```nginx
# NIP-11
location = /.well-known/nostr.json {
  proxy_pass http://127.0.0.1:8080;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  add_header Access-Control-Allow-Origin "*" always;
  add_header Cache-Control "public, max-age=60" always;
}

# Health (optional explicit)
location = /health { proxy_pass http://127.0.0.1:8080/health; }

# Relay root (edit your existing location /, don't duplicate)
location / {
  proxy_pass http://127.0.0.1:8080;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

# NIP-96
client_max_body_size 50m;
location = /upload { proxy_pass http://127.0.0.1:3001/upload; }
location ^~ /media/ { proxy_pass http://127.0.0.1:3001; }
```

Tips
- Only one root location block should exist; edit the existing one to add WS headers.
- Ensure UPLOAD_TMP_DIR is under LOCAL_DIR so rename works across same device, or keep ALWAYS_COPY_UPLOADS=true.

## Diagnostics (relay-diagnostic.ts)

Run an end-to-end probe of HTTP, WS, NIPs and optional NIP-96 upload. Requires Node 18+.
```bash
npm run diag -- --url https://YOUR_DOMAIN --nip96 https://YOUR_DOMAIN
# If NIP98_REQUIRED=true for uploads:
npm run diag -- --url https://YOUR_DOMAIN --nip96 https://YOUR_DOMAIN --auth "Nostr {signed_event_json}"
```
Checks covered
- /health, NIP-11 (/.well-known/nostr.json and /nip11)
- WS connect, publish OK (NIP-20), REQ/EVENT, EOSE (NIP-15)
- NIP-09 delete, NIP-33 replaceable latest-wins, size limit enforcement
- NIP-96 POST /upload -> JSON with url to /media/...

Expected: 11/11 checks passed.

## NIP-96 env additions
- LOCAL_DIR: destination directory (inside container)
- UPLOAD_TMP_DIR: temp directory; put under LOCAL_DIR to avoid EXDEV
- ALWAYS_COPY_UPLOADS: "true" to force copy+unlink (safest default)
- NIP98_REQUIRED: "true" to require NIP-98 Authorization for /upload

## Final aaPanel Nginx config (paste ONLY new location blocks; edit existing “/”)

Add these new blocks inside your existing server { }:
```
# Exact NIP-11 (add)
location = /.well-known/nostr.json {
  proxy_pass http://127.0.0.1:8080;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_cache relay1_matrus_org_cache;
  proxy_cache_valid 200 1m;
  add_header X-Cache $upstream_cache_status always;
  add_header Access-Control-Allow-Origin "*" always;
  add_header Access-Control-Allow-Methods "GET, OPTIONS, HEAD" always;
  add_header Access-Control-Allow-Headers "Content-Type, Accept" always;
  add_header Cache-Control "public, max-age=60" always;
}

# Optional aliases (add)
location = /nostr.json { proxy_pass http://127.0.0.1:8080; }
location = /nip11      { proxy_pass http://127.0.0.1:8080; }
```

Edit your existing root block (do NOT add a second “location /”). Ensure these lines are present inside it:
```
proxy_pass http://127.0.0.1:8080;
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $http_host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_connect_timeout 60s;
proxy_send_timeout 600s;
proxy_read_timeout 600s;
```

Tip
- Error “duplicate location "/"” means you pasted a second root block. Remove the new one and only edit the original root block.
- Restart Nginx after saving and test:
  - curl -i https://YOUR_DOMAIN/.well-known/nostr.json
  - curl -I https://YOUR_DOMAIN/.well-known/nostr.json