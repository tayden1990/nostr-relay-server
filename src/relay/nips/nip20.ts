import { Event } from '../../types';
import { validateEvent } from '../events/validate';
import { ingestEvent } from '../events/ingest';

export const nip20Handler = async (event: Event) => {
    // Validate the incoming event
    const isValid = validateEvent(event);
    if (!isValid) {
        throw new Error('Invalid event');
    }

    // Ingest the event (storage + publish)
    await ingestEvent(event);
};