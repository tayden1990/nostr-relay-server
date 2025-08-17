import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

class PubSub {
    private redis: Redis;
    private eventEmitter: EventEmitter;

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
        this.eventEmitter = new EventEmitter();
    }

    public async publish(channel: string, message: string): Promise<void> {
        await this.redis.publish(channel, message);
    }

    public subscribe(channel: string): void {
        this.redis.subscribe(channel, (err, count) => {
            if (err) {
                console.error(`Failed to subscribe: ${err}`);
            } else {
                console.log(`Subscribed to ${count} channel(s).`);
            }
        });

        this.redis.on('message', (channel, message) => {
            this.eventEmitter.emit(channel, message);
        });
    }

    public on(channel: string, listener: (message: string) => void): void {
        this.eventEmitter.on(channel, listener);
    }

    public async unsubscribe(channel: string): Promise<void> {
        await this.redis.unsubscribe(channel);
    }

    public async quit(): Promise<void> {
        await this.redis.quit();
    }
}

export default PubSub;