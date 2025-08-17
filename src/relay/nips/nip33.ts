import { Event } from '../../types';
import { validateEvent } from '../events/validate';
import { ingestEvent } from '../events/ingest';

export const nip33Handler = (event: Event) => {
    // Validate the incoming event
    const isValid = validateEvent(event);
    if (!isValid) {
        throw new Error('Invalid event');
    }

    // Handle the event according to NIP-33 rules by ingesting
    ingestEvent(event);
};