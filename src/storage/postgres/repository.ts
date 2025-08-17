import { Pool } from 'pg';
import { Event } from '../../types';

export class PostgresRepository {
    private pool: Pool;

    constructor(connectionString: string) {
        this.pool = new Pool({
            connectionString,
        });
    }

    async saveEvent(event: Event): Promise<void> {
        // Skip ephemeral events (NIP-16: 20000–29999) – do not persist.
        if (event.kind >= 20000 && event.kind <= 29999) {
            return;
        }

        // Extract d-tag for parameterized replaceable kinds
        const dTag = (event.tags || []).find(t => t[0] === 'd')?.[1] || null;
        const expires = (event.tags || []).find(t => t[0] === 'expiration')?.[1];
        const expiresAt = expires ? Number(expires) : null;

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // For replaceable kinds 0 and 3, mark previous as deleted
            if ([0, 3].includes(event.kind)) {
                await client.query(
                  'UPDATE nostr_events SET deleted = TRUE WHERE pubkey = $1 AND kind = $2',
                  [event.pubkey, event.kind]
                );
            }

            // For parameterized replaceable (NIP-33)
            if (event.kind >= 30000 && event.kind <= 39999 && dTag) {
                await client.query(
                  'UPDATE nostr_events SET deleted = TRUE WHERE pubkey = $1 AND kind = $2 AND d_tag = $3',
                  [event.pubkey, event.kind, dTag]
                );
            }

            // Store incoming event (including deletion events)
            await client.query(
              'INSERT INTO nostr_events (id, kind, pubkey, created_at, content, tags, deleted, expires_at, d_tag) VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,$8)',
              [event.id, event.kind, event.pubkey, event.created_at, event.content, JSON.stringify(event.tags || []), expiresAt, dTag]
            );

            // If this is a NIP-09 deletion request (kind 5), mark referenced author-owned events as deleted
            if (event.kind === 5) {
                const targetIds = (event.tags || [])
                    .filter(t => t[0] === 'e' && t[1])
                    .map(t => t[1]);
                if (targetIds.length) {
                    await client.query(
                        `UPDATE nostr_events
                         SET deleted = TRUE
                         WHERE id = ANY($1) AND pubkey = $2`,
                        [targetIds, event.pubkey]
                    );
                }
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async getEventById(id: string): Promise<Event | null> {
        // Fixed table name
        const query = 'SELECT * FROM nostr_events WHERE id = $1';
        const result = await this.pool.query(query, [id]);

        if (result.rows.length > 0) {
            return result.rows[0] as Event;
        }
        return null;
    }

    async deleteEvent(id: string): Promise<void> {
        await this.pool.query('UPDATE nostr_events SET deleted = TRUE WHERE id = $1', [id]);
    }

    async countByFilters(filters: any): Promise<number> {
        const parts: string[] = ['deleted = FALSE'];
        const vals: any[] = [];
        let i = 1;

        // kinds
        if (Array.isArray(filters?.kinds) && filters.kinds.length) {
            parts.push(`kind = ANY($${i++})`);
            vals.push(filters.kinds);
        }

        // ids (exact or prefix)
        if (Array.isArray(filters?.ids) && filters.ids.length) {
            const exact: string[] = [];
            const prefixes: string[] = [];
            for (const id of filters.ids) {
                const s = String(id);
                if (s.length === 64) exact.push(s); else prefixes.push(s);
            }
            const idConds: string[] = [];
            if (exact.length) {
                idConds.push(`id = ANY($${i++})`);
                vals.push(exact);
            }
            if (prefixes.length) {
                idConds.push(`(${prefixes.map(_ => `id LIKE $${i++}`).join(' OR ')})`);
                for (const p of prefixes) vals.push(p + '%');
            }
            if (idConds.length) parts.push(`(${idConds.join(' OR ')})`);
        }

        // authors (exact or prefix)
        if (Array.isArray(filters?.authors) && filters.authors.length) {
            const exact: string[] = [];
            const prefixes: string[] = [];
            for (const a of filters.authors) {
                const s = String(a);
                if (s.length === 64) exact.push(s); else prefixes.push(s);
            }
            const aConds: string[] = [];
            if (exact.length) {
                aConds.push(`pubkey = ANY($${i++})`);
                vals.push(exact);
            }
            if (prefixes.length) {
                aConds.push(`(${prefixes.map(_ => `pubkey LIKE $${i++}`).join(' OR ')})`);
                for (const p of prefixes) vals.push(p + '%');
            }
            if (aConds.length) parts.push(`(${aConds.join(' OR ')})`);
        }

        // time range
        if (filters?.since) { parts.push(`created_at >= $${i++}`); vals.push(filters.since); }
        if (filters?.until) { parts.push(`created_at <= $${i++}`); vals.push(filters.until); }

        // tag filters (#e, #p) exact or prefix (via JSONB)
        for (const tagKey of ['#e', '#p']) {
            const arr = filters?.[tagKey];
            if (Array.isArray(arr) && arr.length) {
                const letter = tagKey.substring(1);
                const exact: string[] = [];
                const prefixes: string[] = [];
                for (const v of arr) {
                    const s = String(v);
                    if (s.length === 64) exact.push(s); else prefixes.push(s);
                }
                if (exact.length) {
                    // EXISTS for any exact match in provided list
                    parts.push(`EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(tags) AS t(elem)
                        WHERE elem->>0 = $${i++} AND elem->>1 = ANY($${i++}::text[])
                    )`);
                    vals.push(letter, exact);
                }
                for (const p of prefixes) {
                    parts.push(`EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(tags) AS t(elem)
                        WHERE elem->>0 = $${i++} AND elem->>1 LIKE $${i++}
                    )`);
                    vals.push(letter, p + '%');
                }
            }
        }

        // Support #d for parameterized replaceable (exact or prefix)
        if (Array.isArray(filters?.['#d']) && filters['#d'].length) {
            const dExact: string[] = [];
            const dPrefixes: string[] = [];
            for (const v of filters['#d']) {
                const s = String(v);
                // allow empty-string d-tag too, treat as exact
                if (!s || s.length === s.length) {
                    dExact.push(s);
                }
            }
            if (dExact.length) {
                parts.push(`d_tag = ANY($${i++})`);
                vals.push(dExact);
            }
            // Optional: prefix matches on d_tag
            const dp = (filters['#d'] as string[]).filter(s => s && !dExact.includes(s));
            for (const p of dp) {
                parts.push(`d_tag LIKE $${i++}`);
                vals.push(p + '%');
            }
        }

        // Not expired
        parts.push('(expires_at IS NULL OR expires_at > EXTRACT(EPOCH FROM NOW()))');
        const sql = `SELECT COUNT(*)::int AS c FROM nostr_events WHERE ${parts.join(' AND ')}`;
        const r = await this.pool.query(sql, vals);
        return r.rows[0]?.c || 0;
    }

    async queryByFilters(filters: any): Promise<Event[]> {
        const parts: string[] = ['deleted = FALSE'];
        const vals: any[] = [];
        let i = 1;

        if (Array.isArray(filters?.kinds) && filters.kinds.length) {
            parts.push(`kind = ANY($${i++})`);
            vals.push(filters.kinds);
        }
        if (Array.isArray(filters?.ids) && filters.ids.length) {
            const exact: string[] = [];
            const prefixes: string[] = [];
            for (const id of filters.ids) {
                const s = String(id);
                if (s.length === 64) exact.push(s); else prefixes.push(s);
            }
            const idConds: string[] = [];
            if (exact.length) { idConds.push(`id = ANY($${i++})`); vals.push(exact); }
            if (prefixes.length) { idConds.push(`(${prefixes.map(_ => `id LIKE $${i++}`).join(' OR ')})`); for (const p of prefixes) vals.push(p + '%'); }
            if (idConds.length) parts.push(`(${idConds.join(' OR ')})`);
        }
        if (Array.isArray(filters?.authors) && filters.authors.length) {
            const exact: string[] = [];
            const prefixes: string[] = [];
            for (const a of filters.authors) { const s = String(a); if (s.length === 64) exact.push(s); else prefixes.push(s); }
            const aConds: string[] = [];
            if (exact.length) { aConds.push(`pubkey = ANY($${i++})`); vals.push(exact); }
            if (prefixes.length) { aConds.push(`(${prefixes.map(_ => `pubkey LIKE $${i++}`).join(' OR ')})`); for (const p of prefixes) vals.push(p + '%'); }
            if (aConds.length) parts.push(`(${aConds.join(' OR ')})`);
        }
        if (filters?.since) { parts.push(`created_at >= $${i++}`); vals.push(filters.since); }
        if (filters?.until) { parts.push(`created_at <= $${i++}`); vals.push(filters.until); }
        // #e/#p via JSONB for exact or prefix
        for (const tagKey of ['#e', '#p']) {
            const arr = filters?.[tagKey];
            if (Array.isArray(arr) && arr.length) {
                const letter = tagKey.substring(1);
                const exact: string[] = [];
                const prefixes: string[] = [];
                for (const v of arr) { const s = String(v); if (s.length === 64) exact.push(s); else prefixes.push(s); }
                if (exact.length) {
                    parts.push(`EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(tags) AS t(elem)
                        WHERE elem->>0 = $${i++} AND elem->>1 = ANY($${i++}::text[])
                    )`);
                    vals.push(letter, exact);
                }
                for (const p of prefixes) {
                    parts.push(`EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(tags) AS t(elem)
                        WHERE elem->>0 = $${i++} AND elem->>1 LIKE $${i++}
                    )`);
                    vals.push(letter, p + '%');
                }
            }
        }
        // #d support (exact or prefix)
        if (Array.isArray(filters?.['#d']) && filters['#d'].length) {
            const dExact: string[] = [];
            const dPrefixes: string[] = [];
            for (const v of filters['#d']) {
                const s = String(v);
                // accept all as exact; clients usually do exact d-tag lookups
                dExact.push(s);
            }
            if (dExact.length) {
                parts.push(`d_tag = ANY($${i++})`);
                vals.push(dExact);
            }
            for (const p of dPrefixes) {
                parts.push(`d_tag LIKE $${i++}`);
                vals.push(p + '%');
            }
        }

        parts.push('(expires_at IS NULL OR expires_at > EXTRACT(EPOCH FROM NOW()))');
        const lim = Math.min(Number(filters?.limit || 500), 5000);
        const sql = `SELECT id, kind, pubkey, created_at, content, COALESCE(tags, '[]'::jsonb) as tags
                     FROM nostr_events
                     WHERE ${parts.join(' AND ')}
                     ORDER BY created_at DESC
                     LIMIT ${lim}`;
        const r = await this.pool.query(sql, vals);
        return r.rows as unknown as Event[];
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}