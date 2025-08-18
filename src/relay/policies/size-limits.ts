import { Request, Response, NextFunction } from 'express';

const MAX_MESSAGE_SIZE = Number(process.env.MAX_MESSAGE_SIZE || 1024 * 1024); // bytes

export function validateMessageSize(req: Request, res: Response, next: NextFunction) {
    try {
        // Stringify current body to estimate actual payload size
        const bodyStr = JSON.stringify(req.body ?? '');
        const messageSize = Buffer.byteLength(bodyStr, 'utf8');
        if (messageSize > MAX_MESSAGE_SIZE) {
            return res.status(413).json({ error: `message-too-large`, limit: MAX_MESSAGE_SIZE });
        }
    } catch {
        // If stringify fails, let upstream validation handle it
    }
    next();
}

// Placeholder; real file size checks are enforced in the NIP-96 service
export function validateFileSize(_req: Request, _res: Response, next: NextFunction) { next(); }