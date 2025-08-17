import { Event } from '../../types';

export class RetentionPolicy {
    public shouldRetain(_event: Event): boolean { return true; }
    public cleanUp(events: Event[]): Event[] { return events; }
}