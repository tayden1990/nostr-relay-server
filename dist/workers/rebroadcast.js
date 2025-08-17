"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rebroadcast = rebroadcast;
const ENABLE_WORKERS = (process.env.ENABLE_WORKERS || 'false').toLowerCase() === 'true';
function rebroadcast(_evt) {
    if (!ENABLE_WORKERS)
        return;
    // would publish to redis or queues here when enabled
}
