import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

// Middleware for logging WebSocket-related HTTP upgrades (if proxied through Express)
export const logConnection = (req: Request, _res: Response, next: NextFunction) => {
    const reqId = (req as any).reqId || '';
    logger.info(`WebSocket connection established`, { ip: req.ip, reqId });
    next();
};

// Middleware for error handling
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
    const reqId = (req as any).reqId || '';
    logger.error(`Error occurred: ${err?.message || err}`, { reqId });
    res.status(500).send({ error: 'Internal Server Error', reqId });
};

// Middleware for validating message size (HTTP)
export const validateMessageSize = (req: Request, res: Response, next: NextFunction) => {
    const maxSize = Number(process.env.MAX_MESSAGE_SIZE || 1024 * 1024);
    try {
        const bodyStr = JSON.stringify(req.body ?? '');
        const messageSize = Buffer.byteLength(bodyStr, 'utf8');
        if (messageSize > maxSize) {
            return res.status(413).send({ error: 'Message size exceeds limit', limit: maxSize });
        }
    } catch {
        // ignore and let upstream handle bad JSON
    }
    next();
};