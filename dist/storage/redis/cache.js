"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Cache {
    constructor(redisClient) { this.client = redisClient; }
    async get(key) { return this.client.get(key); }
    async set(key, value, expire = 3600) { await this.client.set(key, value, 'EX', expire); return 'OK'; }
    async delete(key) { return this.client.del(key); }
    async exists(key) { return this.client.exists(key); }
}
exports.default = Cache;
