"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNip11Info = getNip11Info;
function getNip11Info() {
    const name = process.env.RELAY_NAME || 'relay1.matrus.org';
    const description = process.env.RELAY_DESCRIPTION || 'Self-hosted Nostr relay for Matrus messenger';
    const contact = process.env.RELAY_CONTACT || undefined;
    const maxMessage = Number(process.env.MAX_MESSAGE_SIZE || 1024 * 1024);
    return {
        name,
        description,
        contact,
        supported_nips: [1, 9, 11, 15, 16, 20, 33, 40, 42, 45, 96, 98],
        software: 'nostr-relay-server-ts',
        version: '1.0.0',
        limitation: {
            max_message_length: maxMessage,
            max_subscriptions: 50,
            max_filters: 20,
            max_limit: 500,
            max_subid_length: 64,
            min_prefix: 4,
        },
    };
}
