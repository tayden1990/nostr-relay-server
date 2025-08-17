"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEvent = deleteEvent;
const repository_1 = require("../../storage/postgres/repository");
/**
 * Handles the deletion of events from the relay.
 * @param eventId - The ID of the event to be deleted.
 * @returns A promise that resolves to a boolean indicating success or failure.
 */
async function deleteEvent(eventId) {
    const repo = new repository_1.PostgresRepository(process.env.DATABASE_URL);
    await repo.deleteEvent(eventId);
    await repo.close();
    return true;
}
