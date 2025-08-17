export type Event = {
    id: string;
    kind: number;
    content: string;
    created_at: number;
    tags: string[][];
    pubkey: string;
};

export type Subscription = {
    id: string;
    filters: Filter[];
};

export type Filter = {
    kinds?: number[];
    authors?: string[];
    ids?: string[];            // support id and prefix filtering
    since?: number;
    until?: number;
    limit?: number;
    ['#e']?: string[];         // NIP-10/27
    ['#p']?: string[];         // NIP-10/27
    ['#d']?: string[];         // NIP-33
};

export type RelayConfig = {
    maxMessageSize: number;
    retentionPeriod: number;
    rateLimit: number;
};

export type ClientInfo = {
    id: string;
    pubkey: string;
    connectedAt: number;
};

export type NIP = {
    id: number;
    description: string;
    implemented: boolean;
};