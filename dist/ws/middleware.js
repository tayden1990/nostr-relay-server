"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMessageSize = exports.errorHandler = exports.logConnection = void 0;
const logger_1 = require("../utils/logger");
// Middleware for logging WebSocket connections
const logConnection = (req, res, next) => {
    logger_1.logger.info(`WebSocket connection established: ${req.ip}`);
    next();
};
exports.logConnection = logConnection;
// Middleware for error handling
const errorHandler = (err, req, res, next) => {
    logger_1.logger.error(`Error occurred: ${err.message}`);
    res.status(500).send({ error: 'Internal Server Error' });
};
exports.errorHandler = errorHandler;
// Middleware for validating message size
const validateMessageSize = (req, res, next) => {
    const maxSize = 1024 * 1024; // 1 MB
    if (req.body && req.body.length > maxSize) {
        return res.status(400).send({ error: 'Message size exceeds limit' });
    }
    next();
};
exports.validateMessageSize = validateMessageSize;
