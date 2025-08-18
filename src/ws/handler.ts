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

    ws.on('message', async (message: WebSocket.Data) => {
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
                    const count = await repo.countByFilters(filters);
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
                const filters = payload.slice(2) || [];
                const sent = new Set<string>();
                const t0 = startQueryTimer();
                try {
                    for (const f of filters) {
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
                    if (m) m.set(subId, filters);
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

            // EVENT handling requires auth (write)
            const evt = payload;
            if (!isAuthed(ws)) {
                ws.send(JSON.stringify(["OK", evt?.id || "", false, "auth-required"]));
                return;
            }
            if (!validateEvent(evt)) {
                ws.send(JSON.stringify(["OK", evt?.id || "", false, "invalid-event"]));
                return;
            }
            await ingestEvent(evt);
            recordMessageProcessed(); // keep existing counter
            // also count ingested events explicitly
            // (safe even if ingestEvent already published to Redis)
            recordEventIngested();
            ws.send(JSON.stringify(["OK", evt.id, true, ""]));
        } catch (error: any) {
            logError(`Error handling message: ${error?.message || String(error)}`);
            ws.send(JSON.stringify(["OK", "", false, "server-error"]));
        }
    });

    ws.on('close', () => {
        logInfo('WebSocket connection closed');
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