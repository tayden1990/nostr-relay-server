"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDebug = exports.logError = exports.logInfo = exports.logger = void 0;
const winston_1 = require("winston");
exports.logger = (0, winston_1.createLogger)({
    level: 'info',
    format: winston_1.format.combine(winston_1.format.timestamp(), winston_1.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level}]: ${message}`;
    })),
    transports: [
        new winston_1.transports.Console(),
        new winston_1.transports.File({ filename: 'combined.log' }),
        new winston_1.transports.File({ filename: 'error.log', level: 'error' })
    ],
});
const logInfo = (message) => {
    exports.logger.info(message);
};
exports.logInfo = logInfo;
const logError = (message) => {
    exports.logger.error(message);
};
exports.logError = logError;
const logDebug = (message) => {
    exports.logger.debug(message);
};
exports.logDebug = logDebug;
