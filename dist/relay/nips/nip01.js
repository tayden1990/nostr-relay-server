"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEvent = processEvent;
const validate_1 = require("../events/validate");
const ingest_1 = require("../events/ingest");
const MAX_EVENT_CONTENT = Number(process.env.MAX_MESSAGE_SIZE || 1024 * 1024);
/**
 * NIP-01: Basic Event Processing
 * This module implements the logic for processing events according to NIP-01.
 */
/**
 * Processes an incoming event according to NIP-01 specifications.
 * @param event - The event to be processed.
 * @returns A promise that resolves to the result of the event processing.
 */
async function processEvent(event) {
    // Validate the event
    const isValid = (0, validate_1.validateEvent)(event);
    if (!isValid) {
        throw new Error('Invalid event');
    }
    // Check size limits
    if (event.content.length > MAX_EVENT_CONTENT) {
        throw new Error('Event content exceeds size limits');
    }
    // Ingest the event into the relay
    await (0, ingest_1.ingestEvent)(event);
}
