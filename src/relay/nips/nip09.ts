import { Event } from '../../types';
import { validateEvent } from '../events/validate';
import { ingestEvent } from '../events/ingest';
const MAX_EVENT_CONTENT = 1024 * 1024;

export const handleNip09Event = async (event: Event): Promise<void> => {
    // Validate the event according to NIP-09 specifications
    const isValid = validateEvent(event);
    if (!isValid) {
        throw new Error('Invalid event format for NIP-09');
    }

    // Check size limits for the event
    if (event.content.length > MAX_EVENT_CONTENT) {
        throw new Error('Event content exceeds size limits');
    }

    // Publish the event to the relay
    await ingestEvent(event);
};