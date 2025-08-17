import { Redis } from 'ioredis';

class Cache {
    private client: Redis;
    constructor(redisClient: Redis) { this.client = redisClient; }
    async get(key: string): Promise<string | null> { return this.client.get(key); }
    async set(key: string, value: string, expire: number = 3600): Promise<'OK'> { await this.client.set(key, value, 'EX', expire); return 'OK'; }
    async delete(key: string): Promise<number> { return this.client.del(key); }
    async exists(key: string): Promise<number> { return this.client.exists(key); }
}

export default Cache;