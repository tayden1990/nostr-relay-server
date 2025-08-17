import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

// Middleware for logging WebSocket connections
export const logConnection = (req: Request, res: Response, next: NextFunction) => {
    logger.info(`WebSocket connection established: ${req.ip}`);
    next();
};

// Middleware for error handling
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error(`Error occurred: ${err.message}`);
    res.status(500).send({ error: 'Internal Server Error' });
};

// Middleware for validating message size
export const validateMessageSize = (req: Request, res: Response, next: NextFunction) => {
    const maxSize = 1024 * 1024; // 1 MB
    if (req.body && req.body.length > maxSize) {
        return res.status(400).send({ error: 'Message size exceeds limit' });
    }
    next();
};