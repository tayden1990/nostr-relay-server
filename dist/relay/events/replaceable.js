"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleReplaceableEvent = handleReplaceableEvent;
const validate_1 = require("../events/validate");
const repository_1 = require("../../storage/postgres/repository");
/**
 * Handles replaceable events, allowing clients to update existing events.
 *
 * @param {Event} newEvent - The new event data to replace the existing event.
 * @returns {Promise<void>} - A promise that resolves when the event is successfully replaced.
 */
async function handleReplaceableEvent(newEvent) {
    // Validate the new event
    const isValid = (0, validate_1.validateEvent)(newEvent);
    if (!isValid) {
        throw new Error('Invalid event data');
    }
    // Store the new event in the database
    const repo = new repository_1.PostgresRepository(process.env.DATABASE_URL);
    await repo.saveEvent(newEvent);
    await repo.close();
}
