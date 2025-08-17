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
- MAX_MESSAGE_SIZE: default 1048576
- RELAY_NAME, RELAY_DESCRIPTION: for NIP-11

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
- Name: nostr-net, Driver: bridge, IPv6: OFF

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