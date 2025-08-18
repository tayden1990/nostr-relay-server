import express from 'express';
import multer from 'multer';
import { saveBuffer } from './storage/local';
import { uploadBufferToS3, uploadFileToS3 } from './storage/s3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { LOCAL_STORAGE_DIR } from './storage/local';

const router = express.Router();
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024);
// BASE_URL can be an absolute origin or a path prefix when behind a proxy (e.g., "/nip96")
const BASE_URL = (process.env.BASE_URL || '').trim();
// Accept both STORAGE_METHOD and STORAGE_TYPE for compatibility
const storageMethod = (process.env.STORAGE_METHOD || process.env.STORAGE_TYPE || 'local').toLowerCase();

// Switch to disk storage to avoid loading big files into memory
const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) => {
            const ext = (file.originalname.split('.').pop() || '').toLowerCase();
            const name = `${uuidv4()}${ext ? '.' + ext : ''}`;
            cb(null, name);
        },
    }),
    limits: { fileSize: MAX_FILE_SIZE },
});

router.post('/upload', upload.single('file'), async (req, res) => {
    let tmpPath: string | undefined;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }
        tmpPath = req.file.path; // temp file written by multer
        const key = req.file.filename;
        const mime = req.file.mimetype;

        let url: string;
        if (storageMethod === 's3') {
            // Stream upload from disk to S3
            url = await uploadFileToS3(tmpPath, mime, key);
        } else {
            // Move file to local storage directory without buffering
            const destDir = LOCAL_STORAGE_DIR;
            await fs.promises.mkdir(destDir, { recursive: true });
            const destPath = path.join(destDir, key);
            await fs.promises.rename(tmpPath, destPath);
            tmpPath = undefined; // moved
            const prefix = BASE_URL ? BASE_URL.replace(/\/$/, '') : '';
            url = `${prefix}/media/${key}`;
        }

        return res.status(200).json({ url, size: req.file.size, type: mime, name: req.file.originalname });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Upload failed' });
    } finally {
        // Cleanup temp file if still present
        if (tmpPath) {
            fs.promises.unlink(tmpPath).catch(() => void 0);
        }
    }
});

export default router;