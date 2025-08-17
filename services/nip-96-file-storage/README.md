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

## Configuration

Environment variables:
- PORT: default 3001
- MAX_FILE_SIZE: bytes (default 52428800)
- BASE_URL: URL prefix for returned media links (e.g., "/nip96")
- STORAGE_METHOD or STORAGE_TYPE: "local" (default) or "s3"
- For S3: AWS_REGION, S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- NIP98_REQUIRED: "true" (default) to require NIP-98 auth on /upload
- UPLOAD_IP_ALLOWLIST: comma-separated IPs allowed to use /upload (optional)

## License

MIT