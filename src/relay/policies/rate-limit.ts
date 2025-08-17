import { Request, Response, NextFunction } from 'express';

const RATE_LIMIT = 100; // Maximum number of requests allowed
const TIME_WINDOW = 60 * 1000; // Time window in milliseconds (1 minute)

const requestCounts: { [key: string]: { count: number; lastRequestTime: number } } = {};

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = requestCounts[ip] || { count: 0, lastRequestTime: now };
  if (now - rec.lastRequestTime > TIME_WINDOW) {
    rec.count = 0;
    rec.lastRequestTime = now;
  }
  rec.count += 1;
  requestCounts[ip] = rec;
  if (rec.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'rate-limit-exceeded' });
  }
  next();
}