"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordFileUploadSize = exports.recordDeliveryLatency = exports.recordMessageProcessed = void 0;
exports.sendJson = sendJson;
const prom_client_1 = require("prom-client");
const metrics = {
    messageCount: new prom_client_1.Counter({
        name: 'message_count',
        help: 'Total number of messages processed',
    }),
    deliveryLatency: new prom_client_1.Histogram({
        name: 'delivery_latency_seconds',
        help: 'Latency of message delivery in seconds',
        buckets: [0.1, 0.5, 1, 2, 5, 10],
    }),
    fileUploadSize: new prom_client_1.Histogram({
        name: 'file_upload_size_bytes',
        help: 'Size of uploaded files in bytes',
        buckets: [1024, 1024 * 10, 1024 * 100, 1024 * 1024, 1024 * 10 * 1024],
    }),
};
const recordMessageProcessed = () => {
    metrics.messageCount.inc();
};
exports.recordMessageProcessed = recordMessageProcessed;
const recordDeliveryLatency = (duration) => {
    metrics.deliveryLatency.observe(duration);
};
exports.recordDeliveryLatency = recordDeliveryLatency;
const recordFileUploadSize = (size) => {
    metrics.fileUploadSize.observe(size);
};
exports.recordFileUploadSize = recordFileUploadSize;
exports.default = metrics;
function sendJson(ws, data) {
    try {
        ws.send(JSON.stringify(data));
    }
    catch {
        // ignore
    }
}
