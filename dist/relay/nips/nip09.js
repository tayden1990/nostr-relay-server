"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNip09Event = void 0;
const validate_1 = require("../events/validate");
const ingest_1 = require("../events/ingest");
const MAX_EVENT_CONTENT = 1024 * 1024;
const handleNip09Event = async (event) => {
    // Validate the event according to NIP-09 specifications
    const isValid = (0, validate_1.validateEvent)(event);
    if (!isValid) {
        throw new Error('Invalid event format for NIP-09');
    }
    // Check size limits for the event
    if (event.content.length > MAX_EVENT_CONTENT) {
        throw new Error('Event content exceeds size limits');
    }
    // Publish the event to the relay
    await (0, ingest_1.ingestEvent)(event);
};
exports.handleNip09Event = handleNip09Event;
