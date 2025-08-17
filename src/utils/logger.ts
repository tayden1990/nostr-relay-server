import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}]: ${message}`;
        })
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'combined.log' }),
        new transports.File({ filename: 'error.log', level: 'error' })
    ],
});

export const logInfo = (message: string) => {
    logger.info(message);
};

export const logError = (message: string) => {
    logger.error(message);
};

export const logDebug = (message: string) => {
    logger.debug(message);
};