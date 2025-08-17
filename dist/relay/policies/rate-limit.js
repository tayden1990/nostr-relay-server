"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = rateLimitMiddleware;
const RATE_LIMIT = 100; // Maximum number of requests allowed
const TIME_WINDOW = 60 * 1000; // Time window in milliseconds (1 minute)
const requestCounts = {};
function rateLimitMiddleware(_req, _res, next) { next(); }
