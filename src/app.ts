import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import { healthCheck } from './http/health';
import client from 'prom-client';
import { infoNip11 } from './http/info-nip11';
import { PostgresRepository } from './storage/postgres/repository';
import { ingestEvent } from './relay/events/ingest';
import { validateEvent } from './relay/events/validate';
import { handleWebSocketConnection } from './ws/handler';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', healthCheck);

// Prometheus metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();
app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.send(await client.register.metrics());
});

// NIP-11 info endpoints
app.get('/.well-known/nostr.json', infoNip11);
// Alias used by tests and some tools
app.get('/info-nip11', infoNip11);

// Minimal HTTP event ingestion (for tests/tools)
app.post('/events', async (req, res) => {
    const evt = req.body;
    if (!validateEvent(evt)) {
        return res.status(400).json({ error: 'Invalid event' });
    }
    try {
        await ingestEvent(evt);
        return res.status(200).json({ id: evt.id });
    } catch (e: any) {
        return res.status(500).json({ error: e?.message || 'ingest-failed' });
    }
});

// Setup WebSocket handling
wss.on('connection', (ws: WebSocket) => handleWebSocketConnection(ws));

// Export server for tests
export async function createServer() {
    return server;
}

// Start the server unless running tests
const PORT = Number(process.env.PORT || 8080);
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
        console.log(`Relay server is running on http://0.0.0.0:${PORT}`);
    });
}

// Background: scheduled cleanup of expired events every 10 minutes
if (process.env.DATABASE_URL) {
    const repo = new PostgresRepository(process.env.DATABASE_URL);
    const sweep = async () => {
        try {
            await (repo as any).pool.query('DELETE FROM nostr_events WHERE expires_at IS NOT NULL AND expires_at <= EXTRACT(EPOCH FROM NOW())');
        } catch {
            // ignore errors
        }
    };
    setInterval(sweep, 10 * 60 * 1000);
}