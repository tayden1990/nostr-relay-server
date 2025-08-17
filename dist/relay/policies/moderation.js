"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationPolicy = void 0;
class ModerationPolicy {
    constructor() {
        this.enabled = (process.env.MODERATION_ENABLED || 'false').toLowerCase() === 'true';
        const kw = process.env.MODERATION_KEYWORDS || '';
        this.inappropriateKeywords = kw ? kw.split(',').map(s => s.trim()).filter(Boolean) : ['spam', 'offensive'];
        this.shadowBannedPubkeys = new Set((process.env.SHADOW_BANNED || '').split(',').map(s => s.trim()).filter(Boolean));
    }
    moderate(event) {
        if (!this.enabled)
            return true;
        if (this.shadowBannedPubkeys.has(event.pubkey)) {
            // Accept but never deliver (shadow ban); caller can decide to drop
            return false;
        }
        if (this.isContentInappropriate(event.content)) {
            return false; // Reject the event
        }
        return true; // Accept the event
    }
    isContentInappropriate(content) {
        return this.inappropriateKeywords.some(keyword => content.includes(keyword));
    }
}
exports.ModerationPolicy = ModerationPolicy;
