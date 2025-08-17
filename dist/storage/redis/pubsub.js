"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = require("ioredis");
const events_1 = require("events");
class PubSub {
    constructor(redisUrl) {
        this.redis = new ioredis_1.Redis(redisUrl);
        this.eventEmitter = new events_1.EventEmitter();
    }
    async publish(channel, message) {
        await this.redis.publish(channel, message);
    }
    subscribe(channel) {
        this.redis.subscribe(channel, (err, count) => {
            if (err) {
                console.error(`Failed to subscribe: ${err}`);
            }
            else {
                console.log(`Subscribed to ${count} channel(s).`);
            }
        });
        this.redis.on('message', (channel, message) => {
            this.eventEmitter.emit(channel, message);
        });
    }
    on(channel, listener) {
        this.eventEmitter.on(channel, listener);
    }
    async unsubscribe(channel) {
        await this.redis.unsubscribe(channel);
    }
    async quit() {
        await this.redis.quit();
    }
}
exports.default = PubSub;
