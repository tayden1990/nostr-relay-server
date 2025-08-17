import WebSocket, { Server as WSServer } from 'ws';
import { validateEvent } from '../relay/events/validate';
import { ingestEvent } from '../relay/events/ingest';
import { recordMessageProcessed } from '../utils/metrics';
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
            } catch {}
        });
    } catch {}
}

export const handleWebSocketConnection = (ws: WebSocket) => {
    // Issue AUTH challenge on connect (NIP-42)
    issueAuthChallenge(ws);
    const repo = new PostgresRepository(process.env.DATABASE_URL as string);
    ensureLiveFeed();
    allSockets.add(ws);
    liveSubs.set(ws, new Map());
    ws.on('message', async (message: WebSocket.Data) => {
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
                const count = await repo.countByFilters(filters);
                ws.send(JSON.stringify(["COUNT", subId, { count }]));
                return;
            }

            // REQ subscription (NIP-01 + EOSE NIP-15): ["REQ", <subscription_id>, <filter1>, <filter2>, ...]
            if (Array.isArray(payload) && payload[0] === 'REQ') {
                const subId = payload[1];
                const filters = payload.slice(2) || [];
                const sent = new Set<string>();
                try {
                    for (const f of filters) {
                        const events = await repo.queryByFilters(f);
                        for (const evt of events) {
                            if (sent.has(evt.id)) continue;
                            ws.send(JSON.stringify(["EVENT", subId, evt]));
                            sent.add(evt.id);
                        }
                    }
                } catch (e) {
                    // ignore fetch errors; still send EOSE
                } finally {
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
            recordMessageProcessed();
            ws.send(JSON.stringify(["OK", evt.id, true, ""]));
        } catch (error: any) {
            logError(`Error handling message: ${error?.message || String(error)}`);
            ws.send(JSON.stringify(["OK", "", false, "server-error"]));
        }
    });

    ws.on('close', () => {
        logInfo('WebSocket connection closed');
        allSockets.delete(ws);
        liveSubs.delete(ws);
    });
};

// Exported setup used by app.ts
export function setupWebSocket(wss: WSServer) {
    wss.on('connection', (ws: WebSocket) => handleWebSocketConnection(ws));
}