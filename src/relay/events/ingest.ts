import { Event } from '../../types';
import { validateEvent } from './validate';
import { PostgresRepository } from '../../storage/postgres/repository';
import PubSub from '../../storage/redis/pubsub';
import { logger } from '../../utils/logger';

/**
 * Ingests an event into the relay server.
 * 
 * @param event - The event to be ingested.
 * @returns A promise that resolves to the result of the ingestion process.
 */
const repo = new PostgresRepository(process.env.DATABASE_URL as string);
const pubsub = new PubSub(process.env.REDIS_URL || 'redis://localhost:6379');

export async function ingestEvent(event: Event): Promise<void> {
    try {
        // Validate the incoming event
        const isValid = validateEvent(event);
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
        } else {
            // Store/replace event
            await repo.saveEvent(event);
        }

    // Publish the event to Redis for real-time delivery
    await pubsub.publish('events', JSON.stringify(event));

        logger.info('Event ingested successfully', { event });
    } catch (error) {
        logger.error('Error ingesting event', { error });
        throw error;
    }
}