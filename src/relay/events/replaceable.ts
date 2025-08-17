import { Event } from '../../types';
import { validateEvent } from '../events/validate';
import { PostgresRepository } from '../../storage/postgres/repository';

/**
 * Handles replaceable events, allowing clients to update existing events.
 * 
 * @param {Event} newEvent - The new event data to replace the existing event.
 * @returns {Promise<void>} - A promise that resolves when the event is successfully replaced.
 */
export async function handleReplaceableEvent(newEvent: Event): Promise<void> {
    // Validate the new event
    const isValid = validateEvent(newEvent);
    if (!isValid) {
        throw new Error('Invalid event data');
    }

    // Store the new event in the database
    const repo = new PostgresRepository(process.env.DATABASE_URL as string);
    await repo.saveEvent(newEvent);
    await repo.close();
}