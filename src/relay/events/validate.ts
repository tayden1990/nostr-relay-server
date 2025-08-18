import { Event } from '../../types';

const HEX64 = /^[0-9a-f]{64}$/i;
const MAX_FUTURE_SKEW = Number(process.env.CREATED_AT_MAX_FUTURE_SKEW_SEC || 900); // 15min
const MAX_AGE = Number(process.env.CREATED_AT_MAX_AGE_SEC || 604800); // 7 days

export function validateEvent(event: Event): boolean {
    // Minimal schema validation: required fields and basic types
    if (!event || typeof event !== 'object') return false;
    if (typeof event.id !== 'string' || !HEX64.test(event.id)) return false;
    if (typeof event.kind !== 'number') return false;
    if (typeof event.pubkey !== 'string' || !HEX64.test(event.pubkey)) return false;
    if (typeof event.created_at !== 'number') return false;
    if (!Array.isArray(event.tags)) return false;
    if (typeof event.content !== 'string') return false;

    // NIP-22: created_at sanity window
    const now = Math.floor(Date.now() / 1000);
    if (event.created_at > now + MAX_FUTURE_SKEW) return false;
    if (MAX_AGE > 0 && event.created_at < now - MAX_AGE) return false;

    return true;
}