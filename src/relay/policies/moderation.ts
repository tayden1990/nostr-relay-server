import { Event } from '../../types';

export class ModerationPolicy {
    private inappropriateKeywords: string[];
    private shadowBannedPubkeys: Set<string>;
    private enabled: boolean;

    constructor() {
    this.enabled = (process.env.MODERATION_ENABLED || 'false').toLowerCase() === 'true';
    const kw = process.env.MODERATION_KEYWORDS || '';
    this.inappropriateKeywords = kw ? kw.split(',').map(s => s.trim()).filter(Boolean) : ['spam','offensive'];
    this.shadowBannedPubkeys = new Set((process.env.SHADOW_BANNED || '').split(',').map(s => s.trim()).filter(Boolean));
    }

    public moderate(event: Event): boolean {
    if (!this.enabled) return true;
        if (this.shadowBannedPubkeys.has(event.pubkey)) {
            // Accept but never deliver (shadow ban); caller can decide to drop
            return false;
        }
        if (this.isContentInappropriate(event.content)) {
            return false; // Reject the event
        }
        return true; // Accept the event
    }

    private isContentInappropriate(content: string): boolean {
        return this.inappropriateKeywords.some(keyword => content.includes(keyword));
    }
}