import WebSocket, { Server as WSServer } from 'ws';
import { validateEvent } from '../relay/events/validate';
import { ingestEvent } from '../relay/events/ingest';
import { recordMessageProcessed, incWsConnections, decWsConnections, incWsMessages, startQueryTimer, observeQueryDuration, setRedisUp, recordEventIngested } from '../utils/metrics';
import { logError, logInfo } from '../utils/logger';
import { issueAuthChallenge, handleAuthResponse, isAuthed } from './auth';
import { PostgresRepository } from '../storage/postgres/repository';
import PubSub from '../storage/redis/pubsub';
import { eventMatchesFilter } from '../relay/events/match';

const liveSubs: WeakMap<WebSocket, Map<string, any[]>> = new WeakMap();
const allSockets = new Set<WebSocket>();
let liveFeedStarted = false;
let globalPubSub: PubSub | undefined;
const REQUIRE_AUTH_FOR_WRITE = String(process.env.REQUIRE_AUTH_FOR_WRITE || 'false').toLowerCase() === 'true';
const MAX_FILTERS = Number(process.env.MAX_FILTERS || 20);
const MAX_LIMIT = Number(process.env.MAX_LIMIT || 500);
const MAX_MESSAGE_SIZE = Number(process.env.MAX_MESSAGE_SIZE || 1024 * 1024);

function sendNotice(ws: WebSocket, text: string) {
    try { ws.send(JSON.stringify(["NOTICE", text])); } catch {}
}

function sanitizeFilters(filters: any[]): any[] {
    const trimmed = Array.isArray(filters) ? filters.slice(0, MAX_FILTERS) : [];
    for (const f of trimmed) {
        if (typeof f?.limit === 'number' && f.limit > MAX_LIMIT) f.limit = MAX_LIMIT;
    }
    return trimmed;
}

function ensureLiveFeed() {
    if (liveFeedStarted) return;
    liveFeedStarted = true;
    try {
        globalPubSub = new PubSub(process.env.REDIS_URL || 'redis://localhost:6379');
        globalPubSub.subscribe('events');
        setRedisUp(1);
        logInfo('Subscribed to 1 channel(s).');
        globalPubSub.on('events', (msg: string) => {
            try {
                const evt = JSON.parse(msg);
                // fan-out to matching subs
                for (const sock of Array.from(allSockets)) {
                    const subs = liveSubs.get(sock);
                    if (!subs) continue;
                    for (const [subId, filters] of subs.entries()) {
                        if (filters.some(f => eventMatchesFilter(evt, f))) {
                            try { sock.send(JSON.stringify(["EVENT", subId, evt])); } catch {}
                        }
                    }
                }
            } catch (e: any) {
                logError(`Error parsing pubsub event: ${e?.message || String(e)}`);
            }
        });
    } catch (e: any) {
        setRedisUp(0);
        logError(`Redis pubsub setup failed: ${e?.message || String(e)}`);
    }
}

export const handleWebSocketConnection = (ws: WebSocket) => {
    const cid = Math.random().toString(36).slice(2, 10);
    logInfo(`WS open cid=${cid}`);
    // Issue AUTH challenge on connect (NIP-42)
    issueAuthChallenge(ws);
    const repo = new PostgresRepository(process.env.DATABASE_URL as string);
    ensureLiveFeed();
    allSockets.add(ws);
    liveSubs.set(ws, new Map());
    incWsConnections();

    // Keepalive (avoid idle timeouts)
    let alive = true;
    ws.on('pong', () => { alive = true; });
    const pingTimer = setInterval(() => {
        if (!alive) return ws.terminate();
        alive = false;
        try { ws.ping(); } catch {}
    }, 30000);

    // Serialize message handling per-connection to preserve ordering and avoid races
    let queue = Promise.resolve();
    ws.on('message', (message: WebSocket.Data) => {
        queue = queue.then(async () => {
        incWsMessages();
        try {
            const text = typeof message === 'string' ? message : message.toString();
            const payload = JSON.parse(text);

            // Handle AUTH response
            if (Array.isArray(payload) && payload[0] === 'AUTH' && payload[1]) {
                // Some clients send back AUTH event here; accept either direct event or wrapper
                const evt = typeof payload[1] === 'object' ? payload[1] : undefined;
                if (evt) handleAuthResponse(ws, evt);
                return;
            }

            // COUNT request (NIP-45): ["COUNT", <subscription_id>, <filters>]
            if (Array.isArray(payload) && payload[0] === 'COUNT') {
                const [, subId, filters] = payload;
                const t0 = startQueryTimer();
                try {
                    const safeFilters = sanitizeFilters(filters);
                    const count = await repo.countByFilters(safeFilters);
                    ws.send(JSON.stringify(["COUNT", subId, { count }]));
                } catch (e: any) {
                    logError(`COUNT failed: ${e?.message || String(e)}`);
                    ws.send(JSON.stringify(["COUNT", subId, { count: 0 }]));
                } finally {
                    observeQueryDuration(t0);
                }
                return;
            }

            // REQ subscription (NIP-01 + EOSE NIP-15): ["REQ", <subscription_id>, <filter1>, <filter2>, ...]
            if (Array.isArray(payload) && payload[0] === 'REQ') {
                const subId = payload[1];
                let filters = payload.slice(2) || [];
                if (!Array.isArray(filters)) filters = [];
                const over = filters.length - MAX_FILTERS;
                const safeFilters = sanitizeFilters(filters);
                if (over > 0) {
                    sendNotice(ws, `too-many-filters: received=${filters.length}, allowed=${MAX_FILTERS}`);
                }
                const sent = new Set<string>();
                const t0 = startQueryTimer();
                try {
                    for (const f of safeFilters) {
                        const events = await repo.queryByFilters(f);
                        for (const evt of events) {
                            if (sent.has(evt.id)) continue;
                            ws.send(JSON.stringify(["EVENT", subId, evt]));
                            sent.add(evt.id);
                        }
                    }
                } catch (e: any) {
                    logError(`REQ query failed: ${e?.message || String(e)}`);
                } finally {
                    observeQueryDuration(t0);
                    ws.send(JSON.stringify(["EOSE", subId]));
                    // register live subscription
                    const m = liveSubs.get(ws);
                    if (m) m.set(subId, safeFilters);
                }
                return;
            }

            // CLOSE subscription: ["CLOSE", <subscription_id>]
            if (Array.isArray(payload) && payload[0] === 'CLOSE') {
                const [, subId] = payload;
                const m = liveSubs.get(ws);
                if (m) m.delete(subId);
                return;
            }

            // EVENT publish (support both ["EVENT", <event>] and bare event object)
            let evt: any | undefined;
            if (Array.isArray(payload) && payload[0] === 'EVENT' && typeof payload[1] === 'object' && payload[1]) {
                evt = payload[1];
            } else if (payload && typeof payload === 'object' && payload.id && payload.pubkey) {
                evt = payload;
            }

            if (evt) {
                const id = evt.id || '';
                if (REQUIRE_AUTH_FOR_WRITE && !isAuthed(ws)) {
                    ws.send(JSON.stringify(["OK", id, false, "auth-required"]));
                    return;
                }
                if (!validateEvent(evt)) {
                    ws.send(JSON.stringify(["OK", id, false, "invalid-event"]));
                    return;
                }
                // Enforce size limit on event content
                try {
                    const size = Buffer.byteLength(typeof evt.content === 'string' ? evt.content : JSON.stringify(evt.content || ''), 'utf8');
                    if (size > MAX_MESSAGE_SIZE) {
                        ws.send(JSON.stringify(["OK", id, false, "too-large"]));
                        return;
                    }
                } catch {
                    // if content cannot be measured, let validation fail elsewhere
                }
                try {
                    await ingestEvent(evt);
                    recordMessageProcessed();
                    recordEventIngested();
                    ws.send(JSON.stringify(["OK", id, true, ""]));
                } catch (e: any) {
                    logError(`ingest failed id=${id}: ${e?.message || String(e)}`);
                    ws.send(JSON.stringify(["OK", id, false, "server-error"]));
                }
                return;
            }

            // Unknown message type; inform client per NIP-01
            sendNotice(ws, 'unrecognized-message');
            return;
        } catch (error: any) {
            logError(`WS error cid=${cid} ${error?.message || String(error)}`);
            ws.send(JSON.stringify(["OK", "", false, "server-error"]));
        }
        }).catch((err: any) => {
            logError(`WS queue error cid=${cid} ${err?.message || String(err)}`);
            try { ws.send(JSON.stringify(["OK", "", false, "server-error"])); } catch {}
        });
    });

    ws.on('close', () => {
        logInfo(`WS close cid=${cid}`);
        clearInterval(pingTimer);
        allSockets.delete(ws);
        liveSubs.delete(ws);
        decWsConnections();
    });
};

// Exported setup used by app.ts
export function setupWebSocket(wss: WSServer) {
    wss.on('connection', (ws: WebSocket) => handleWebSocketConnection(ws));
}