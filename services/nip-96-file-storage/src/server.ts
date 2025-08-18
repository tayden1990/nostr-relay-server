import express from 'express';
import uploadsRouter from './uploads';
import { LOCAL_STORAGE_DIR } from './storage/local';
import { nip98Auth, ipAllowlist } from './auth';
import { fileSizeLimitPolicy } from './policies';
import multer from 'multer';
import { listLogFiles, readLog, getLogDir, logInfo, logError } from '../../src/utils/logger';
import path from 'path';
import fsp from 'fs/promises';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Upload protection: IP allowlist and optionally NIP-98 signed requests
const requireNip98 = String(process.env.NIP98_REQUIRED ?? 'true').toLowerCase() !== 'false';
if (requireNip98) {
    app.use('/upload', ipAllowlist, nip98Auth);
} else {
    app.use('/upload', ipAllowlist);
}

// Policies
app.use(fileSizeLimitPolicy as any);

// Uploads
app.use('/', uploadsRouter);

// Static serving for local storage
app.use('/media', express.static(LOCAL_STORAGE_DIR));

// Health endpoint
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', ts: new Date().toISOString() });
});

// Info endpoint (non-sensitive runtime info)
app.get('/info', (_req, res) => {
    const maxFileSize = Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024);
    const baseUrl = (process.env.BASE_URL || '').trim();
    const method = (process.env.STORAGE_METHOD || process.env.STORAGE_TYPE || 'local').toLowerCase();
    const region = process.env.AWS_REGION || '';
    const bucket = process.env.S3_BUCKET_NAME || '';
    res.status(200).json({
        storage: {
            method,
            baseUrl,
            localDir: LOCAL_STORAGE_DIR,
            s3: {
                region: region || undefined,
                bucket: bucket || undefined,
                configured: method === 's3' && Boolean(bucket),
            },
        },
        limits: {
            maxFileSize,
        },
        auth: {
            nip98Required: requireNip98,
        },
        ts: new Date().toISOString(),
    });
});

// Logs UI (reuse the same minimal page)
app.get('/logs', async (_req, res) => {
    res.type('text/html; charset=utf-8').send(`<!doctype html><title>Logs</title>
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
async function listFiles(){const r=await fetch('/logs/list');const v=await r.json();const sel=document.getElementById('file');sel.innerHTML='';v.forEach(x=>{const o=document.createElement('option');o.value=x.name;o.textContent=x.name+' ('+x.size+')';sel.appendChild(o);});}
async function load(){const file=document.getElementById('file').value;const level=document.getElementById('level').value;const q=document.getElementById('q').value;const limit=document.getElementById('limit').value;const url=new URL('/logs/view', location.origin);if(file)url.searchParams.set('file',file);if(level)url.searchParams.set('level',level);if(q)url.searchParams.set('q',q);if(limit)url.searchParams.set('limit',limit);document.getElementById('download').href='/logs/download?file='+encodeURIComponent(file||'');const r=await fetch(url);const rows=await r.json();const tbody=document.querySelector('#tbl tbody');tbody.innerHTML='';rows.forEach(x=>{const tr=document.createElement('tr');const ts=x.timestamp||x.ts||'';const level=x.level||'';const msg=x.message||'';const meta=JSON.stringify(x);tr.innerHTML='<td>'+ts+'</td><td>'+level+'</td><td><pre>'+msg+'</pre></td><td><pre>'+meta+'</pre></td>';tbody.appendChild(tr);});}
document.body.innerHTML=document.body.innerHTML+'<style>body{font:14px system-ui,sans-serif;margin:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px}pre{white-space:pre-wrap;margin:0}.controls{display:flex;gap:8px;align-items:center;margin-bottom:10px}</style>';document.getElementById('refresh')?.addEventListener('click',load);listFiles().then(load);
</script>`);
});

app.get('/logs/list', async (_req, res) => {
    try { res.json(await listLogFiles()); }
    catch (e: any) { res.status(500).json({ error: e?.message || 'list-failed' }); }
});

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
    } catch {
        res.status(404).json({ error: 'not-found' });
    }
});

// Global error handler (handle Multer file size errors)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            const maxFileSize = Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024);
            return res.status(413).json({ error: 'file-too-large', limit: maxFileSize });
        }
        return res.status(400).json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: err?.message || 'internal-error' });
});

// Start the server
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`NIP-96 File Storage Service running on port ${PORT}`);
});