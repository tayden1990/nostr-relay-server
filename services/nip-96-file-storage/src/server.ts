import express from 'express';
import uploadsRouter from './uploads';
import { LOCAL_STORAGE_DIR } from './storage/local';
import { nip98Auth, ipAllowlist } from './auth';
import { fileSizeLimitPolicy } from './policies';
import multer from 'multer';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Upload protection: IP allowlist and optionally NIP-98 signed requests
const requireNip98 = String(process.env.NIP98_REQUIRED ?? 'false').toLowerCase() === 'true'; // Default to false for free usage
if (requireNip98) {
    app.use('/upload', ipAllowlist, nip98Auth);
} else {
    app.use('/upload', ipAllowlist); // Only IP allowlist, no authentication required
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


// Global error handler (handle Multer file size errors)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            const maxFileSize = Number(process.env.MAX_FILE_SIZE || 500 * 1024 * 1024); // 500MB default
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