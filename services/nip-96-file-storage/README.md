# NIP-96 File Storage Service

This document provides an overview of the NIP-96 file storage service, which is designed to facilitate the storage and retrieval of files in compliance with the NIP-96 protocol.

## Overview

The NIP-96 file storage service allows users to upload, store, and manage files efficiently. It supports various storage backends, including local storage and cloud storage solutions like Amazon S3.

## Features

- File uploads with size limits defined by service policies.
- Local or S3 storage backends.
- Optional NIP-98 signed HTTP requests and IP allowlist.

## Running the Service

```
npm start
```

## API Endpoints

- POST /upload — Upload a file. Multipart form field name: "file". Returns JSON: { url, size, type, name }.
- GET /media/:key — Retrieve a locally stored file (only when using local storage).
- GET /health — Service health.
- GET /info — Non-sensitive runtime info (storage method, limits).

## Quick upload examples
- Local storage:
```bash
curl -F "file=@/path/to/image.png" http://HOST:3001/upload
# -> {"url":"/media/<uuid>.png","size":...,"type":"image/png","name":"image.png"}
```
- With BASE_URL prefix (behind proxy):
```bash
# BASE_URL=/nip96 -> URLs like /nip96/media/<key>
curl -F "file=@/path/to/image.jpg" https://YOUR_DOMAIN/nip96/upload
```
- S3 backend (streamed, no large memory buffers):
```bash
export STORAGE_METHOD=s3 AWS_REGION=us-east-1 S3_BUCKET_NAME=your-bucket
curl -F "file=@/large/video.mp4" http://HOST:3001/upload
# -> {"url":"https://your-bucket.s3.us-east-1.amazonaws.com/<key>", ...}
```

## How large files are handled
- Incoming files are written to disk in a temp directory (UPLOAD_TMP_DIR or OS tmp).
- Local storage: the temp file is moved to the media directory.
- S3: the temp file is streamed to S3 (no buffering in memory) and then deleted.

## Security
- NIP-98: enabled by default (NIP98_REQUIRED=true). Disable only if you trust callers.
- IP allowlist: set UPLOAD_IP_ALLOWLIST with comma-separated IPs.
- Set MAX_FILE_SIZE to constrain uploads (bytes).

## Configuration
- PORT: default 3001
- MAX_FILE_SIZE: bytes (default 52428800)
- BASE_URL: URL prefix for returned links (e.g., "/nip96")
- STORAGE_METHOD or STORAGE_TYPE: "local" (default) or "s3"
- UPLOAD_TMP_DIR: directory for temp files (default OS tmp)
- For S3: AWS_REGION, S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- NIP98_REQUIRED: "true" (default) to require NIP-98 on /upload
- UPLOAD_IP_ALLOWLIST: comma-separated IPs allowed to use /upload

Note about the AWS SDK:
- The service lazy-loads @aws-sdk/client-s3 only when STORAGE_METHOD=s3.
- If not installed, S3 uploads will fail at runtime; install it where needed.

## Minimal Docker Compose
```yaml
services:
  nip96:
    build: ./services/nip-96-file-storage
    environment:
      - PORT=3001
      - STORAGE_METHOD=local # or s3
      - MAX_FILE_SIZE=52428800
      - BASE_URL=/nip96
      # - AWS_REGION=us-east-1
      # - S3_BUCKET_NAME=your-bucket
      # - AWS_ACCESS_KEY_ID=...
      # - AWS_SECRET_ACCESS_KEY=...
    volumes:
      - ./uploads:/data
    ports: ["3001:3001"]
```

## License

MIT