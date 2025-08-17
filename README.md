# Nostr Relay Server

[![Build & Publish](https://github.com/tayden1990/nostr-relay-server/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/tayden1990/nostr-relay-server/actions)
![Docker Pulls](https://img.shields.io/docker/pulls/taksa1990/nostr-relay)
![Image Size](https://img.shields.io/docker/image-size/taksa1990/nostr-relay/latest)

A production-ready Nostr relay server written in TypeScript. It implements core NIPs, stores events in Postgres, uses Redis for fan-out, and offers optional NIP-96 HTTP file storage.

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

## Docker Compose (with NIP-96)

See docker/docker-compose.yml for a full stack (Relay + Postgres + Redis + Caddy + NIP-96).
Basic example:

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

## Configuration

Common environment variables:
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

## Building locally

```bash
npm install
npm run build
npm test
npm start
```

## Image metadata

The published image contains OCI labels:
- org.opencontainers.image.title
- org.opencontainers.image.description
- org.opencontainers.image.version
- org.opencontainers.image.revision
- org.opencontainers.image.url
- org.opencontainers.image.source
- org.opencontainers.image.licenses

## License

MIT