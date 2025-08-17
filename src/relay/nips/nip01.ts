import { Event } from '../../types';
import { validateEvent } from '../events/validate';
import { ingestEvent } from '../events/ingest';
const MAX_EVENT_CONTENT = Number(process.env.MAX_MESSAGE_SIZE || 1024 * 1024);

/**
 * NIP-01: Basic Event Processing
 * This module implements the logic for processing events according to NIP-01.
 */

/**
 * Processes an incoming event according to NIP-01 specifications.
 * @param event - The event to be processed.
 * @returns A promise that resolves to the result of the event processing.
 */
export async function processEvent(event: Event): Promise<void> {
    // Validate the event
    const isValid = validateEvent(event);
    if (!isValid) {
        throw new Error('Invalid event');
    }

    // Check size limits
    if (event.content.length > MAX_EVENT_CONTENT) {
        throw new Error('Event content exceeds size limits');
    }

    // Ingest the event into the relay
    await ingestEvent(event);
}