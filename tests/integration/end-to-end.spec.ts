import request from 'supertest';
import { createServer } from '../../src/app';

describe('End-to-End Integration Tests', () => {
    let server: any;

    beforeAll(async () => {
        server = await createServer();
    });

    afterAll(async () => {
        await new Promise<void>(res => server.close(() => res()));
    });

    it('should respond to health check', async () => {
        const response = await request(server).get('/health');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'ok');
    });

    it('should handle NIP-11 info request', async () => {
        const response = await request(server).get('/info-nip11');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('supported_nips');
    });

    it('should accept a valid event', async () => {
        const event = {
            id: 'f'.repeat(64),
            kind: 1,
            content: 'Hello, Nostr!',
            tags: [],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: 'a'.repeat(64),
        };

        const response = await request(server).post('/events').send(event);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id');
    });

    it('should reject an invalid event', async () => {
        const invalidEvent = {
            kind: 1,
            content: '',
            tags: [],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: 'your_public_key_here',
        };

        const response = await request(server).post('/events').send(invalidEvent);
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Invalid event');
    });
});