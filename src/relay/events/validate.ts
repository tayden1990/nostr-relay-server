import { Event } from '../../types';

export function validateEvent(event: Event): boolean {
    // Minimal schema validation: required fields and basic types
    if (!event || typeof event !== 'object') return false;
    if (typeof event.id !== 'string' || event.id.length < 8) return false;
    if (typeof event.kind !== 'number') return false;
    if (typeof event.pubkey !== 'string' || event.pubkey.length < 8) return false;
    if (typeof event.created_at !== 'number') return false;
    if (!Array.isArray(event.tags)) return false;
    if (typeof event.content !== 'string') return false;
    return true;
}