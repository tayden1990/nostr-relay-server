-- Prefix search helper indexes for LIKE queries on id/pubkey
CREATE INDEX IF NOT EXISTS idx_events_id_pattern ON nostr_events (id text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_events_pubkey_pattern ON nostr_events (pubkey text_pattern_ops);
