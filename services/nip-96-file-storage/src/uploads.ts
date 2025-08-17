import express from 'express';
import multer from 'multer';
import { saveBuffer } from './storage/local';
import { uploadBufferToS3 } from './storage/s3';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024);
// BASE_URL can be an absolute origin or a path prefix when behind a proxy (e.g., "/nip96")
const BASE_URL = (process.env.BASE_URL || '').trim();
// Accept both STORAGE_METHOD and STORAGE_TYPE for compatibility
const storageMethod = (process.env.STORAGE_METHOD || process.env.STORAGE_TYPE || 'local').toLowerCase();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
});

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }
        const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
        const key = `${uuidv4()}${ext ? '.' + ext : ''}`;

        let url: string;
        if (storageMethod === 's3') {
            url = await uploadBufferToS3(req.file.buffer, req.file.mimetype, key);
        } else {
            const saved = await saveBuffer(key, req.file.buffer);
            // Expose via /media in server.ts
            const prefix = BASE_URL ? BASE_URL.replace(/\/$/, '') : '';
            url = `${prefix}/media/${key}`;
        }

        return res.status(200).json({ url, size: req.file.size, type: req.file.mimetype, name: req.file.originalname });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Upload failed' });
    }
});

export default router;