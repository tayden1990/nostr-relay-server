import { Histogram, Counter } from 'prom-client';
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
};

export const recordMessageProcessed = () => {
    metrics.messageCount.inc();
};

export const recordDeliveryLatency = (duration: number) => {
    metrics.deliveryLatency.observe(duration);
};

export const recordFileUploadSize = (size: number) => {
    metrics.fileUploadSize.observe(size);
};

export default metrics;

export function sendJson(ws: WebSocket, data: unknown) {
    try {
        ws.send(JSON.stringify(data));
    } catch {
        // ignore
    }
}