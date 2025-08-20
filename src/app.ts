import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import { healthCheck } from './http/health';
import client from 'prom-client';
import { PostgresRepository } from './storage/postgres/repository';
import { ingestEvent } from './relay/events/ingest';
import { validateEvent } from './relay/events/validate';
import { handleWebSocketConnection } from './ws/handler';
import { observeHttpRequest, setDbUp, recordMessageProcessed, recordEventIngested, incNip11 } from './utils/metrics';
import { getNip11Info } from './relay/nips/nip11';
import { listLogFiles, readLog, getLogDir, logInfo, logError } from './utils/logger';
import crypto from 'crypto';
import path from 'path';
import fsp from 'fs/promises';

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
    // attach request id for correlation
    (req as any).reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-Id', (req as any).reqId);
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
    res.set('Access-Control-Max-Age', '600');
    res.sendStatus(204);
});

// Add preflight for alias endpoints too
app.options('/nostr.json', (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.set('Access-Control-Max-Age', '600');
    res.sendStatus(204);
});
app.options('/nip11', (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.set('Access-Control-Max-Age', '600');
    res.sendStatus(204);
});

// NIP-11 HEAD (some tools probe with HEAD)
app.head('/.well-known/nostr.json', (_req, res) => {
    res.set('Content-Type', 'application/nostr+json; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).end();
});
// Add HEAD for alias endpoints too
app.head('/nostr.json', (_req, res) => {
    res.set('Content-Type', 'application/nostr+json; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).end();
});
app.head('/nip11', (_req, res) => {
    res.set('Content-Type', 'application/nostr+json; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).end();
});

// NIP-11 info endpoints (wrap with metrics)
const handleNip11 = (req: express.Request, res: express.Response) => {
    try {
        const h = (req.headers['x-forwarded-host'] as string) || req.headers.host || req.hostname || '';
        const host = String(h).split(':')[0];
        const info = getNip11Info(host);
        res.set('Content-Type', 'application/nostr+json; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=60');
        incNip11(true);
        return res.json(info);
    } catch (e: any) {
        incNip11(false);
        return res.status(500).json({ error: 'nip11-failed' });
    }
};
app.get('/.well-known/nostr.json', handleNip11);
app.get('/nostr.json', handleNip11);
app.get('/nip11', handleNip11);
app.get('/info-nip11', handleNip11);

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

// NIP-96 discovery endpoint
app.get('/.well-known/nostr/nip96.json', (_req, res) => {
    try {
        const h = (_req.headers['x-forwarded-host'] as string) || _req.headers.host || _req.hostname || '';
        const host = String(h).split(':')[0];
        const baseUrl = `https://${host}`;
        
        const nip96Info = {
            api_url: `${baseUrl}/upload`,
            download_url: `${baseUrl}/media`,
            supported_nips: [96, 98],
            tos_url: "",
            content_types: [
                // Images
                "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff",
                // Videos
                "video/mp4", "video/webm", "video/avi", "video/mov", "video/mkv", "video/flv", "video/wmv",
                // Audio
                "audio/mp3", "audio/wav", "audio/flac", "audio/aac", "audio/ogg", "audio/m4a",
                // Documents
                "application/pdf", "text/plain", "text/markdown", "text/csv",
                "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                // Archives
                "application/zip", "application/x-rar-compressed", "application/x-7z-compressed", "application/x-tar", "application/gzip",
                // Other
                "application/json", "application/xml", "text/xml", "text/html", "text/css", "text/javascript", "application/javascript"
            ],
            plans: {
                free: {
                    name: "Free Tier - Unlimited",
                    is_nip98_required: true, // NIP-98 authentication required for uploads
                    max_byte_size: Number(process.env.MAX_FILE_SIZE || 500 * 1024 * 1024), // 500MB default instead of 50MB
                    file_expiration: [0, 0], // no expiration
                    media_transformations: {
                        image: ["resizing"]
                    }
                }
            }
        };
        
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=300');
        res.json(nip96Info);
    } catch (e: any) {
        logError(`nip96 discovery error ${e?.message || e}`);
        res.status(500).json({ error: 'nip96-discovery-failed' });
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

// Reduce favicon 404 noise
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Logs: simple HTML UI
app.get('/logs', async (_req, res) => {
    res.type('text/html; charset=utf-8').send(`<!doctype html>
<title>Logs</title>
<style>
body{font:14px system-ui, sans-serif;margin:16px}
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ddd;padding:6px}
pre{white-space:pre-wrap;margin:0}
.controls{display:flex;gap:8px;align-items:center;margin-bottom:10px}
</style>
<div class="controls">
  <label>File <select id="file"></select></label>
  <label>Level <select id="level"><option value="">all</option><option>error</option><option>warn</option><option>info</option><option>debug</option></select></label>
  <label>Search <input id="q" placeholder="substring"/></label>
  <label>Limit <input id="limit" type="number" value="200" min="10" max="1000" style="width:80px"/></label>
  <button id="refresh">Refresh</button>
  <a id="download" href="#" target="_blank">Download</a>
</div>
<table id="tbl"><thead><tr><th>time</th><th>level</th><th>message</th><th>meta</th></tr></thead><tbody></tbody></table>
<script>
async function listFiles(){
  const r=await fetch('/logs/list'); const v=await r.json();
  const sel=document.getElementById('file'); sel.innerHTML='';
  v.forEach(x=>{const o=document.createElement('option');o.value=x.name;o.textContent=x.name+' ('+x.size+')';sel.appendChild(o);});
}
async function load(){
  const file=document.getElementById('file').value;
  const level=document.getElementById('level').value;
  const q=document.getElementById('q').value;
  const limit=document.getElementById('limit').value;
  const url=new URL('/logs/view', location.origin);
  if(file) url.searchParams.set('file', file);
  if(level) url.searchParams.set('level', level);
  if(q) url.searchParams.set('q', q);
  if(limit) url.searchParams.set('limit', limit);
  document.getElementById('download').href='/logs/download?file='+encodeURIComponent(file||'');
  const r=await fetch(url); const rows=await r.json();
  const tbody=document.querySelector('#tbl tbody'); tbody.innerHTML='';
  rows.forEach(x=>{
    const tr=document.createElement('tr');
    const ts=x.timestamp||x.ts||'';
    const level=x.level||'';
    const msg=x.message||'';
    const meta=JSON.stringify(x);
    tr.innerHTML='<td>'+ts+'</td><td>'+level+'</td><td><pre>'+msg+'</pre></td><td><pre>'+meta+'</pre></td>';
    tbody.appendChild(tr);
  });
}
document.getElementById('refresh').onclick=load;
listFiles().then(load);
</script>`);
});

// Logs: JSON list
app.get('/logs/list', async (_req, res) => {
    try {
        res.json(await listLogFiles());
    } catch (e: any) {
        res.status(500).json({ error: e?.message || 'list-failed' });
    }
});

// Logs: view/filter
app.get('/logs/view', async (req, res) => {
    try {
        const data = await readLog({
            file: (req.query.file as string) || undefined,
            level: (req.query.level as string) || undefined,
            q: (req.query.q as string) || undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
        });
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e?.message || 'view-failed' });
    }
});

// Logs: download raw file
app.get('/logs/download', async (req, res) => {
    try {
        const file = (req.query.file as string) || '';
        const dir = await getLogDir();
        const abs = path.normalize(path.join(dir, file));
        if (!abs.startsWith(path.normalize(dir))) return res.status(400).json({ error: 'invalid-file' });
        const stat = await fsp.stat(abs);
        res.setHeader('Content-Length', String(stat.size));
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(abs)}"`);
        res.sendFile(abs);
    } catch (e: any) {
        res.status(404).json({ error: 'not-found' });
    }
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