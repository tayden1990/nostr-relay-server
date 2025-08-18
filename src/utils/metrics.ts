import { Histogram, Counter, Gauge } from 'prom-client';
import WebSocket from 'ws';

const metrics = {
    messageCount: new Counter({
        name: 'message_count',
        help: 'Total number of messages processed',
    }),
    deliveryLatency: new Histogram({
        name: 'delivery_latency_seconds',
        help: 'Latency of message delivery in seconds',
        buckets: [0.1, 0.5, 1, 2, 5, 10],
    }),
    fileUploadSize: new Histogram({
        name: 'file_upload_size_bytes',
        help: 'Size of uploaded files in bytes',
        buckets: [1024, 1024 * 10, 1024 * 100, 1024 * 1024, 1024 * 10 * 1024],
    }),

    // New metrics
    wsConnections: new Gauge({
        name: 'ws_connections',
        help: 'Current number of open WebSocket connections',
    }),
    wsMessagesTotal: new Counter({
        name: 'ws_messages_total',
        help: 'Total number of WebSocket messages received',
    }),
    eventsIngestedTotal: new Counter({
        name: 'events_ingested_total',
        help: 'Total number of events successfully ingested',
    }),
    queryDuration: new Histogram({
        name: 'query_duration_seconds',
        help: 'Duration of DB queries for REQ/COUNT',
        buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
    }),
    dbUp: new Gauge({
        name: 'db_up',
        help: 'Database connectivity (1=up, 0=down)',
    }),
    redisUp: new Gauge({
        name: 'redis_up',
        help: 'Redis connectivity (1=up, 0=down)',
    }),

    // HTTP metrics
    httpRequestsTotal: new Counter({
        name: 'http_requests_total',
        help: 'Total HTTP requests',
        labelNames: ['method', 'route', 'status'] as const,
    }),
    httpRequestDuration: new Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status'] as const,
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    }),

    // NIP-11 metrics
    nip11RequestsTotal: new Counter({
        name: 'nip11_requests_total',
        help: 'Total NIP-11 requests',
        labelNames: ['status'] as const, // "ok" | "error"
    }),
    nip11LastSuccessTs: new Gauge({
        name: 'nip11_last_success_timestamp',
        help: 'Unix timestamp of last successful NIP-11 response',
    }),
};

export const recordMessageProcessed = () => {
    metrics.messageCount.inc();
};

// New helpers
export const incWsConnections = () => metrics.wsConnections.inc();
export const decWsConnections = () => metrics.wsConnections.dec();
export const incWsMessages = () => metrics.wsMessagesTotal.inc();
export const recordEventIngested = () => metrics.eventsIngestedTotal.inc();

export const startQueryTimer = () => Date.now();
export const observeQueryDuration = (startedAtMs: number) => {
    const sec = Math.max(0, (Date.now() - startedAtMs) / 1000);
    metrics.queryDuration.observe(sec);
};

export const setDbUp = (up: boolean | number) => metrics.dbUp.set(up ? 1 : 0);
export const setRedisUp = (up: boolean | number) => metrics.redisUp.set(up ? 1 : 0);

export const recordDeliveryLatency = (duration: number) => {
    metrics.deliveryLatency.observe(duration);
};

export const recordFileUploadSize = (size: number) => {
    metrics.fileUploadSize.observe(size);
};

// HTTP metrics
export const observeHttpRequest = (method: string, route: string, status: number, durationSec: number) => {
    const labels = { method, route, status: String(status) };
    metrics.httpRequestsTotal.inc(labels);
    metrics.httpRequestDuration.observe(labels, durationSec);
};

// NIP-11 metrics
export const incNip11 = (ok: boolean) => {
    metrics.nip11RequestsTotal.inc({ status: ok ? 'ok' : 'error' });
    if (ok) metrics.nip11LastSuccessTs.set(Math.floor(Date.now() / 1000));
};

export default metrics;

export function sendJson(ws: WebSocket, data: unknown) {
    try {
        ws.send(JSON.stringify(data));
    } catch {
        // ignore
    }
}