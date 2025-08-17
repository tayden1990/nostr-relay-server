import { Event } from '../../types';
import { validateEvent } from '../events/validate';
import { ingestEvent } from '../events/ingest';

export const nip42Handler = async (event: Event): Promise<void> => {
    // Validate the incoming event
    const isValid = validateEvent(event);
    if (!isValid) {
        throw new Error('Invalid event');
    }

    // Ingest the event into the relay
    await ingestEvent(event);
};