type RelayInfo = {
    name: string;
    description?: string;
    pubkey?: string;
    contact?: string;
    supported_nips: number[];
    software: string;
    version: string;
    limitation?: {
        max_message_length?: number;
        max_subscriptions?: number;
        max_filters?: number;
        max_limit?: number;
        max_subid_length?: number;
        min_prefix?: number;
    };
};

function isPlaceholder(v?: string | null): boolean {
    if (!v) return true;
    const s = v.trim().toLowerCase();
    return s === 'your-relay-name-or-domain' || s === 'your relay description';
}

export function getNip11Info(host?: string): RelayInfo {
    const reqHost = (host || '').trim() || process.env.DOMAIN || 'relay1.matrus.org';

    const rawName = process.env.RELAY_NAME;
    const rawDesc = process.env.RELAY_DESCRIPTION;

    const name = !isPlaceholder(rawName) ? (rawName as string) : reqHost;
    const description = !isPlaceholder(rawDesc)
        ? (rawDesc as string)
        : `Nostr relay for ${reqHost}`;

    const contact = process.env.RELAY_CONTACT || undefined;
    const pubkey = process.env.RELAY_PUBKEY || undefined;
    const maxMessage = Number(process.env.MAX_MESSAGE_SIZE || 1024 * 1024);
    const maxFilters = Number(process.env.MAX_FILTERS || 20);
    const maxLimit = Number(process.env.MAX_LIMIT || 500);

    return {
        name,
        description,
        contact,
        pubkey,
        supported_nips: [
            1, 2, 4, 5, 9, 10, 11, 13, 15, 17, 18, 19, 21, 23, 25, 27, 28, 29, 30,
            33, 40, 42, 44, 45, 47, 51, 57, 58, 59, 65, 78, 96, 98
        ],
        software: 'nostr-relay-server-ts',
        version: '1.0.0',
        limitation: {
            max_message_length: maxMessage,
            max_subscriptions: 50,
            max_filters: maxFilters,
            max_limit: maxLimit,
            max_subid_length: 64,
            min_prefix: 4,
        },
    };
}