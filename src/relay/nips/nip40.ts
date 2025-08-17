import { Event } from '../../types';
import { validateEvent } from '../events/validate';
import { ingestEvent } from '../events/ingest';

export const nip40Handler = async (event: Event): Promise<void> => {
    // Validate the incoming event
    const isValid = validateEvent(event);
    if (!isValid) {
        throw new Error('Invalid event');
    }

    // Ingest the event
    await ingestEvent(event);
};