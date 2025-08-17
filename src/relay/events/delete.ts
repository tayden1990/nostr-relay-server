import { PostgresRepository } from '../../storage/postgres/repository';

/**
 * Handles the deletion of events from the relay.
 * @param eventId - The ID of the event to be deleted.
 * @returns A promise that resolves to a boolean indicating success or failure.
 */
export async function deleteEvent(eventId: string): Promise<boolean> {
    const repo = new PostgresRepository(process.env.DATABASE_URL as string);
    await repo.deleteEvent(eventId);
    await repo.close();
    return true;
}