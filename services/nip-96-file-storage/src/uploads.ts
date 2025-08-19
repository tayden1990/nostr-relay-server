import express from 'express';
import multer from 'multer';
import { saveBuffer, LOCAL_STORAGE_DIR } from './storage/local';
import { uploadBufferToS3 } from './storage/s3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

const router = express.Router();
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024);
// BASE_URL can be an absolute origin or a path prefix when behind a proxy (e.g., "/nip96")
const BASE_URL = (process.env.BASE_URL || '').trim();
// Accept both STORAGE_METHOD and STORAGE_TYPE for compatibility
const storageMethod = (process.env.STORAGE_METHOD || process.env.STORAGE_TYPE || 'local').toLowerCase();
// Temp dir for incoming files (defaults to OS tmp)
const TMP_DIR = (process.env.UPLOAD_TMP_DIR || os.tmpdir()).toString();

// Multer: write to disk to avoid large memory buffers
const upload = multer({
    storage: (multer as any).diskStorage({
        destination: (_req: express.Request, _file: any, cb: (err: any, dest: string) => void) => cb(null, TMP_DIR),
        filename: (_req: express.Request, file: any, cb: (err: any, filename: string) => void) => cb(null, `${Date.now()}-${file.originalname}`)
    }),
    limits: { fileSize: MAX_FILE_SIZE },
});

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const file: any = (req as any).file;
        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }
        const tempPath = (file.path as string) || '';
        const ext = (file.originalname.split('.').pop() || '').toLowerCase();
        const key = `${uuidv4()}${ext ? '.' + ext : ''}`;

        let url: string;
        if (storageMethod === 's3') {
            const stream = fs.createReadStream(tempPath);
            url = await uploadBufferToS3(stream, file.mimetype, key);
            // cleanup temp file
            try { await fsp.unlink(tempPath); } catch {}
        } else {
            // local storage: move temp file directly into media dir (no buffering)
            try { await fsp.mkdir(LOCAL_STORAGE_DIR, { recursive: true }); } catch {}
            const dest = path.join(LOCAL_STORAGE_DIR, key);
            await fsp.rename(tempPath, dest);
            const prefix = BASE_URL ? BASE_URL.replace(/\/$/, '') : '';
            url = `${prefix}/media/${key}`;
        }

        return res.status(200).json({ url, size: file.size, type: file.mimetype, name: file.originalname });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Upload failed' });
    }
});

export default router;