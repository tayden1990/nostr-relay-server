"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebSocketConnection = void 0;
exports.setupWebSocket = setupWebSocket;
const validate_1 = require("../relay/events/validate");
const ingest_1 = require("../relay/events/ingest");
const metrics_1 = require("../utils/metrics");
const logger_1 = require("../utils/logger");
const auth_1 = require("./auth");
const repository_1 = require("../storage/postgres/repository");
const pubsub_1 = __importDefault(require("../storage/redis/pubsub"));
const match_1 = require("../relay/events/match");
const liveSubs = new WeakMap();
const allSockets = new Set();
let liveFeedStarted = false;
let globalPubSub;
function ensureLiveFeed() {
    if (liveFeedStarted)
        return;
    liveFeedStarted = true;
    try {
        globalPubSub = new pubsub_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
        globalPubSub.subscribe('events');
        globalPubSub.on('events', (msg) => {
            try {
                const evt = JSON.parse(msg);
                // fan-out to matching subs
                for (const sock of Array.from(allSockets)) {
                    const subs = liveSubs.get(sock);
                    if (!subs)
                        continue;
                    for (const [subId, filters] of subs.entries()) {
                        if (filters.some(f => (0, match_1.eventMatchesFilter)(evt, f))) {
                            try {
                                sock.send(JSON.stringify(["EVENT", subId, evt]));
                            }
                            catch { }
                        }
                    }
                }
            }
            catch { }
        });
    }
    catch { }
}
const handleWebSocketConnection = (ws) => {
    // Issue AUTH challenge on connect (NIP-42)
    (0, auth_1.issueAuthChallenge)(ws);
    const repo = new repository_1.PostgresRepository(process.env.DATABASE_URL);
    ensureLiveFeed();
    allSockets.add(ws);
    liveSubs.set(ws, new Map());
    ws.on('message', async (message) => {
        try {
            const text = typeof message === 'string' ? message : message.toString();
            const payload = JSON.parse(text);
            // Handle AUTH response
            if (Array.isArray(payload) && payload[0] === 'AUTH' && payload[1]) {
                // Some clients send back AUTH event here; accept either direct event or wrapper
                const evt = typeof payload[1] === 'object' ? payload[1] : undefined;
                if (evt)
                    (0, auth_1.handleAuthResponse)(ws, evt);
                return;
            }
            // COUNT request (NIP-45): ["COUNT", <subscription_id>, <filters>]
            if (Array.isArray(payload) && payload[0] === 'COUNT') {
                const [, subId, filters] = payload;
                const count = await repo.countByFilters(filters);
                ws.send(JSON.stringify(["COUNT", subId, { count }]));
                return;
            }
            // REQ subscription (NIP-01 + EOSE NIP-15): ["REQ", <subscription_id>, <filter1>, <filter2>, ...]
            if (Array.isArray(payload) && payload[0] === 'REQ') {
                const subId = payload[1];
                const filters = payload.slice(2) || [];
                const sent = new Set();
                try {
                    for (const f of filters) {
                        const events = await repo.queryByFilters(f);
                        for (const evt of events) {
                            if (sent.has(evt.id))
                                continue;
                            ws.send(JSON.stringify(["EVENT", subId, evt]));
                            sent.add(evt.id);
                        }
                    }
                }
                catch (e) {
                    // ignore fetch errors; still send EOSE
                }
                finally {
                    ws.send(JSON.stringify(["EOSE", subId]));
                    // register live subscription
                    const m = liveSubs.get(ws);
                    if (m)
                        m.set(subId, filters);
                }
                return;
            }
            // CLOSE subscription: ["CLOSE", <subscription_id>]
            if (Array.isArray(payload) && payload[0] === 'CLOSE') {
                const [, subId] = payload;
                const m = liveSubs.get(ws);
                if (m)
                    m.delete(subId);
                return;
            }
            // EVENT handling requires auth (write)
            const evt = payload;
            if (!(0, auth_1.isAuthed)(ws)) {
                ws.send(JSON.stringify(["OK", evt?.id || "", false, "auth-required"]));
                return;
            }
            if (!(0, validate_1.validateEvent)(evt)) {
                ws.send(JSON.stringify(["OK", evt?.id || "", false, "invalid-event"]));
                return;
            }
            await (0, ingest_1.ingestEvent)(evt);
            (0, metrics_1.recordMessageProcessed)();
            ws.send(JSON.stringify(["OK", evt.id, true, ""]));
        }
        catch (error) {
            (0, logger_1.logError)(`Error handling message: ${error?.message || String(error)}`);
            ws.send(JSON.stringify(["OK", "", false, "server-error"]));
        }
    });
    ws.on('close', () => {
        (0, logger_1.logInfo)('WebSocket connection closed');
        allSockets.delete(ws);
        liveSubs.delete(ws);
    });
};
exports.handleWebSocketConnection = handleWebSocketConnection;
function setupWebSocket(wss) {
    wss.on('connection', (ws) => (0, exports.handleWebSocketConnection)(ws));
}
