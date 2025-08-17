import { Subscription, Filter, Event } from '../../types';

class SubscriptionManager {
    private subscriptions: Map<string, Subscription[]>;

    constructor() {
        this.subscriptions = new Map();
    }

    addSubscription(clientId: string, filter: Filter): void {
        const clientSubscriptions = this.subscriptions.get(clientId) || [];
        const sub: Subscription = { id: `${clientId}:${Date.now()}`, filters: [filter] };
        clientSubscriptions.push(sub as any);
        this.subscriptions.set(clientId, clientSubscriptions);
    }

    removeSubscription(clientId: string, filter: Filter): void {
        const clientSubscriptions = this.subscriptions.get(clientId);
        if (clientSubscriptions) {
            this.subscriptions.set(clientId, clientSubscriptions.filter(sub => JSON.stringify(sub.filters) !== JSON.stringify([filter])));
        }
    }

    getSubscriptions(clientId: string): Subscription[] {
        return this.subscriptions.get(clientId) || [];
    }

    notifySubscribers(event: Event): void {
        for (const [clientId, clientSubscriptions] of this.subscriptions.entries()) {
            for (const subscription of clientSubscriptions) {
                if (this.matchesFilter(event, subscription.filters[0])) {
                    this.sendEventToClient(clientId, event);
                }
            }
        }
    }

    private matchesFilter(event: Event, filter: Filter): boolean {
        // Implement filter matching logic based on event properties and filter criteria
        return true; // Placeholder for actual matching logic
    }

    private sendEventToClient(clientId: string, event: Event): void {
        // Implement logic to send the event to the specified client
    }
}

export default SubscriptionManager;