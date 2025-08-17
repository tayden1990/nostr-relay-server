"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMessageSize = validateMessageSize;
exports.validateFileSize = validateFileSize;
const MAX_MESSAGE_SIZE = 1024 * 1024; // 1 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
function validateMessageSize(req, res, next) {
    const messageSize = Buffer.byteLength(req.body.message, 'utf8');
    if (messageSize > MAX_MESSAGE_SIZE) {
        return res.status(413).json({ error: 'Message size exceeds the limit of 1 MB.' });
    }
    next();
}
function validateFileSize(_req, _res, next) { next(); }
