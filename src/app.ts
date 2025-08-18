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
import { observeHttpRequest, setDbUp, recordMessageProcessed, recordEventIngested } from './utils/metrics';
import { getNip11Info } from './relay/nips/nip11';
import { logInfo, logError } from './utils/logger';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.set('trust proxy', 1);
const jsonLimit = Number(process.env.MAX_MESSAGE_SIZE || 1048576); // bytes
app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ extended: true }));

// Request logging + HTTP metrics
app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    res.on('finish', () => {
        const durSec = Number(process.hrtime.bigint() - start) / 1e9;
        const route = req.route?.path || req.path;
        observeHttpRequest(req.method, route, res.statusCode, durSec);
        logInfo(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${durSec.toFixed(3)}s ip=${ip} ua="${req.get('user-agent') || ''}"`);
    });
    next();
});

// Health check endpoint
app.get('/health', healthCheck);

// Readiness endpoint (checks DB connection if configured)
app.get('/ready', async (_req, res) => {
    const status: any = { ok: true };
    try {
        if (process.env.DATABASE_URL) {
            const repo = new PostgresRepository(process.env.DATABASE_URL);
            await (repo as any).pool.query('SELECT 1');
            status.db = 'ok';
            setDbUp(1);
        } else {
            status.db = 'skipped';
            setDbUp(0);
        }
    } catch (e: any) {
        status.ok = false;
        status.db = 'error';
        status.error = e?.message || 'db-check-failed';
        setDbUp(0);
    }
    res.status(status.ok ? 200 : 503).json(status);
});

// Prometheus metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();
app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.send(await client.register.metrics());
});

// NIP-11 preflight (CORS)
app.options('/.well-known/nostr.json', (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.sendStatus(204);
});

// NIP-11 HEAD (some tools probe with HEAD)
app.head('/.well-known/nostr.json', (_req, res) => {
    res.set('Content-Type', 'application/nostr+json; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).end();
});

// NIP-11 info endpoints
app.get('/.well-known/nostr.json', infoNip11);
// Compatibility aliases
app.get('/nostr.json', infoNip11);
app.get('/nip11', infoNip11);
// Alias used by tests and some tools
app.get('/info-nip11', infoNip11);

// Debug endpoint for NIP-11 values (do not use in production if you don’t want env leak)
app.get('/debug/nip11', (_req, res) => {
    try {
        const info = getNip11Info();
        res.set('Access-Control-Allow-Origin', '*');
        res.json({
            info,
            env: {
                RELAY_NAME: process.env.RELAY_NAME,
                RELAY_DESCRIPTION: process.env.RELAY_DESCRIPTION,
                RELAY_CONTACT: process.env.RELAY_CONTACT,
                MAX_MESSAGE_SIZE: process.env.MAX_MESSAGE_SIZE,
            },
        });
    } catch (e: any) {
        logError(`debug/nip11 error ${e?.message || e}`);
        res.status(500).json({ error: 'debug-nip11-failed' });
    }
});

// Minimal HTTP event ingestion (for tests/tools)
app.post('/events', async (req, res) => {
    const evt = req.body;
    if (!validateEvent(evt)) {
        return res.status(400).json({ error: 'Invalid event' });
    }
    try {
        await ingestEvent(evt);
        recordMessageProcessed();
        recordEventIngested();
        return res.status(200).json({ id: evt.id });
    } catch (e: any) {
        return res.status(500).json({ error: e?.message || 'ingest-failed' });
    }
});

// Simple root page to reduce 404 noise and provide pointers
app.get('/', (_req, res) => {
    res
      .type('text/plain; charset=utf-8')
      .send(
`Nostr Relay is running.

Useful endpoints:
- Health:        /health
- Readiness:     /ready
- NIP-11:        /.well-known/nostr.json
- Metrics:       /metrics
`
      );
});

// Setup WebSocket handling
wss.on('connection', (ws: WebSocket) => handleWebSocketConnection(ws));

// Export server for tests
export async function createServer() {
    return server;
}

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logError(`[HTTP-ERR] ${req.method} ${req.originalUrl} ${err?.message || err}`);
    if (res.headersSent) return;
    res.status(500).json({ error: 'internal-error' });
});

// Start the server unless running tests
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, HOST, () => {
        console.log(`Relay server is running on http://${HOST}:${PORT}`);
    });
}

// Background: scheduled cleanup of expired events every 10 minutes
let repoForSweep: PostgresRepository | undefined;
// Use platform-compatible type for setInterval handle
let sweepTimer: ReturnType<typeof setInterval> | undefined;
if (process.env.DATABASE_URL) {
    repoForSweep = new PostgresRepository(process.env.DATABASE_URL);
    const sweep = async () => {
        try {
            await (repoForSweep as any).pool.query(
                'DELETE FROM nostr_events WHERE expires_at IS NOT NULL AND expires_at <= EXTRACT(EPOCH FROM NOW())'
            );
        } catch {
            // ignore errors
        }
    };
    sweepTimer = setInterval(sweep, 10 * 60 * 1000);
}

// Process-level error logging
process.on('unhandledRejection', (reason: any) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled Rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err: any) => {
    // eslint-disable-next-line no-console
    console.error('Uncaught Exception:', err?.message || err);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
    try {
        console.log(`Received ${signal}, shutting down...`);
        if (sweepTimer) clearInterval(sweepTimer);
        await new Promise<void>((resolve) => server.close(() => resolve()));
        wss.close();
        if (repoForSweep && typeof (repoForSweep as any).close === 'function') {
            await (repoForSweep as any).close();
        }
    } catch {
        // ignore
    } finally {
        process.exit(0);
    }
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));