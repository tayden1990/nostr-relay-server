-- Nostr events storage
CREATE TABLE IF NOT EXISTS nostr_events (
    id TEXT PRIMARY KEY,
    kind INTEGER NOT NULL,
    pubkey TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    content TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at BIGINT NULL,
    d_tag TEXT NULL
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_nostr_events_pubkey ON nostr_events (pubkey);
CREATE INDEX IF NOT EXISTS idx_nostr_events_kind ON nostr_events (kind);
CREATE INDEX IF NOT EXISTS idx_nostr_events_created_at ON nostr_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nostr_events_pubkey_kind ON nostr_events (pubkey, kind);
CREATE INDEX IF NOT EXISTS idx_nostr_events_pubkey_kind_dtag ON nostr_events (pubkey, kind, d_tag);
CREATE INDEX IF NOT EXISTS idx_nostr_events_expires_at ON nostr_events (expires_at);
CREATE INDEX IF NOT EXISTS idx_nostr_events_tags_gin ON nostr_events USING GIN (tags jsonb_path_ops);

-- Replaceable unique constraints
-- Latest profiles (kind=0) and contacts (kind=3) per pubkey
CREATE UNIQUE INDEX IF NOT EXISTS uniq_replaceable_pubkey_kind
ON nostr_events (pubkey, kind)
WHERE kind IN (0,3) AND deleted = FALSE;

-- Parameterized replaceable kinds (30000-39999) per (pubkey, kind, d_tag)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_param_replaceable
ON nostr_events (pubkey, kind, d_tag)
WHERE kind BETWEEN 30000 AND 39999 AND d_tag IS NOT NULL AND deleted = FALSE;
    WHERE elem->>0 = 'p'
  );
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS nostr_events_set_tag_arrays ON nostr_events;
CREATE TRIGGER nostr_events_set_tag_arrays
BEFORE INSERT OR UPDATE OF tags ON nostr_events
FOR EACH ROW EXECUTE FUNCTION nostr_events_update_tag_arrays();

CREATE INDEX IF NOT EXISTS idx_events_e_tags_gin ON nostr_events USING GIN (e_tags);
CREATE INDEX IF NOT EXISTS idx_events_p_tags_gin ON nostr_events USING GIN (p_tags);

-- Replaceable unique constraints
-- Latest profiles (kind=0) and contacts (kind=3) per pubkey
CREATE UNIQUE INDEX IF NOT EXISTS uniq_replaceable_pubkey_kind
ON nostr_events (pubkey, kind)
WHERE kind IN (0,3) AND deleted = FALSE;

-- Parameterized replaceable kinds (30000-39999) per (pubkey, kind, d_tag)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_param_replaceable
ON nostr_events (pubkey, kind, d_tag)
WHERE kind BETWEEN 30000 AND 39999 AND d_tag IS NOT NULL AND deleted = FALSE;
