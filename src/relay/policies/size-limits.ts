import { Request, Response, NextFunction } from 'express';

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateMessageSize(req: Request, res: Response, next: NextFunction) {
    const messageSize = Buffer.byteLength(req.body.message, 'utf8');
    if (messageSize > MAX_MESSAGE_SIZE) {
        return res.status(413).json({ error: 'Message size exceeds the limit of 1 MB.' });
    }
    next();
}

export function validateFileSize(_req: Request, _res: Response, next: NextFunction) { next(); }