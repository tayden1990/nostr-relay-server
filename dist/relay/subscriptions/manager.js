"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SubscriptionManager {
    constructor() {
        this.subscriptions = new Map();
    }
    addSubscription(clientId, filter) {
        const clientSubscriptions = this.subscriptions.get(clientId) || [];
        const sub = { id: `${clientId}:${Date.now()}`, filters: [filter] };
        clientSubscriptions.push(sub);
        this.subscriptions.set(clientId, clientSubscriptions);
    }
    removeSubscription(clientId, filter) {
        const clientSubscriptions = this.subscriptions.get(clientId);
        if (clientSubscriptions) {
            this.subscriptions.set(clientId, clientSubscriptions.filter(sub => JSON.stringify(sub.filters) !== JSON.stringify([filter])));
        }
    }
    getSubscriptions(clientId) {
        return this.subscriptions.get(clientId) || [];
    }
    notifySubscribers(event) {
        for (const [clientId, clientSubscriptions] of this.subscriptions.entries()) {
            for (const subscription of clientSubscriptions) {
                if (this.matchesFilter(event, subscription.filters[0])) {
                    this.sendEventToClient(clientId, event);
                }
            }
        }
    }
    matchesFilter(event, filter) {
        // Implement filter matching logic based on event properties and filter criteria
        return true; // Placeholder for actual matching logic
    }
    sendEventToClient(clientId, event) {
        // Implement logic to send the event to the specified client
    }
}
exports.default = SubscriptionManager;
