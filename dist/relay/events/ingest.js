"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestEvent = ingestEvent;
const validate_1 = require("./validate");
const repository_1 = require("../../storage/postgres/repository");
const pubsub_1 = __importDefault(require("../../storage/redis/pubsub"));
const logger_1 = require("../../utils/logger");
/**
 * Ingests an event into the relay server.
 *
 * @param event - The event to be ingested.
 * @returns A promise that resolves to the result of the ingestion process.
 */
const repo = new repository_1.PostgresRepository(process.env.DATABASE_URL);
const pubsub = new pubsub_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
async function ingestEvent(event) {
    try {
        // Validate the incoming event
        const isValid = (0, validate_1.validateEvent)(event);
        if (!isValid) {
            throw new Error('Invalid event');
        }
        // Expiration check (NIP-40) pre-ingest
        const exp = (event.tags || []).find(t => t[0] === 'expiration')?.[1];
        if (exp && Number(exp) <= Math.floor(Date.now() / 1000)) {
            throw new Error('expired');
        }
        // Delete events (NIP-09) kind 5
        if (event.kind === 5) {
            const targets = (event.tags || [])
                .filter(t => t[0] === 'e')
                .map(t => t[1]);
            for (const id of targets) {
                await repo.deleteEvent(id);
            }
        }
        else {
            // Store/replace event
            await repo.saveEvent(event);
        }
        // Publish the event to Redis for real-time delivery
        await pubsub.publish('events', JSON.stringify(event));
        logger_1.logger.info('Event ingested successfully', { event });
    }
    catch (error) {
        logger_1.logger.error('Error ingesting event', { error });
        throw error;
    }
}
