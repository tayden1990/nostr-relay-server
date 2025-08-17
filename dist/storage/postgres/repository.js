"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresRepository = void 0;
const pg_1 = require("pg");
class PostgresRepository {
    constructor(connectionString) {
        this.pool = new pg_1.Pool({
            connectionString,
        });
    }
    async saveEvent(event) {
        // Extract d-tag for parameterized replaceable kinds
        const dTag = (event.tags || []).find(t => t[0] === 'd')?.[1] || null;
        const expires = (event.tags || []).find(t => t[0] === 'expiration')?.[1];
        const expiresAt = expires ? Number(expires) : null;
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // For replaceable kinds 0 and 3, mark previous as deleted
            if ([0, 3].includes(event.kind)) {
                await client.query('UPDATE nostr_events SET deleted = TRUE WHERE pubkey = $1 AND kind = $2', [event.pubkey, event.kind]);
            }
            // For parameterized replaceable
            if (event.kind >= 30000 && event.kind <= 39999 && dTag) {
                await client.query('UPDATE nostr_events SET deleted = TRUE WHERE pubkey = $1 AND kind = $2 AND d_tag = $3', [event.pubkey, event.kind, dTag]);
            }
            await client.query('INSERT INTO nostr_events (id, kind, pubkey, created_at, content, tags, deleted, expires_at, d_tag) VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,$8)', [event.id, event.kind, event.pubkey, event.created_at, event.content, JSON.stringify(event.tags || []), expiresAt, dTag]);
            await client.query('COMMIT');
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
    async getEventById(id) {
        const query = 'SELECT * FROM events WHERE id = $1';
        const result = await this.pool.query(query, [id]);
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        return null;
    }
    async deleteEvent(id) {
        await this.pool.query('UPDATE nostr_events SET deleted = TRUE WHERE id = $1', [id]);
    }
    async countByFilters(filters) {
        const parts = ['deleted = FALSE'];
        const vals = [];
        let i = 1;
        // kinds
        if (Array.isArray(filters?.kinds) && filters.kinds.length) {
            parts.push(`kind = ANY($${i++})`);
            vals.push(filters.kinds);
        }
        // ids (exact or prefix)
        if (Array.isArray(filters?.ids) && filters.ids.length) {
            const exact = [];
            const prefixes = [];
            for (const id of filters.ids) {
                const s = String(id);
                if (s.length === 64)
                    exact.push(s);
                else
                    prefixes.push(s);
            }
            const idConds = [];
            if (exact.length) {
                idConds.push(`id = ANY($${i++})`);
                vals.push(exact);
            }
            if (prefixes.length) {
                idConds.push(`(${prefixes.map(_ => `id LIKE $${i++}`).join(' OR ')})`);
                for (const p of prefixes)
                    vals.push(p + '%');
            }
            if (idConds.length)
                parts.push(`(${idConds.join(' OR ')})`);
        }
        // authors (exact or prefix)
        if (Array.isArray(filters?.authors) && filters.authors.length) {
            const exact = [];
            const prefixes = [];
            for (const a of filters.authors) {
                const s = String(a);
                if (s.length === 64)
                    exact.push(s);
                else
                    prefixes.push(s);
            }
            const aConds = [];
            if (exact.length) {
                aConds.push(`pubkey = ANY($${i++})`);
                vals.push(exact);
            }
            if (prefixes.length) {
                aConds.push(`(${prefixes.map(_ => `pubkey LIKE $${i++}`).join(' OR ')})`);
                for (const p of prefixes)
                    vals.push(p + '%');
            }
            if (aConds.length)
                parts.push(`(${aConds.join(' OR ')})`);
        }
        // time range
        if (filters?.since) {
            parts.push(`created_at >= $${i++}`);
            vals.push(filters.since);
        }
        if (filters?.until) {
            parts.push(`created_at <= $${i++}`);
            vals.push(filters.until);
        }
        // tag filters (#e, #p) exact or prefix
        for (const tagKey of ['#e', '#p']) {
            const arr = filters?.[tagKey];
            if (Array.isArray(arr) && arr.length) {
                const letter = tagKey.substring(1);
                const exact = [];
                const prefixes = [];
                for (const v of arr) {
                    const s = String(v);
                    if (s.length === 64)
                        exact.push(s);
                    else
                        prefixes.push(s);
                }
                // exact via generated arrays (e_tags / p_tags)
                if (exact.length) {
                    if (letter === 'e') {
                        parts.push(`e_tags && $${i++}::text[]`);
                        vals.push(exact);
                    }
                    else if (letter === 'p') {
                        parts.push(`p_tags && $${i++}::text[]`);
                        vals.push(exact);
                    }
                }
                // prefix via jsonb_elements LIKE (slower)
                for (const p of prefixes) {
                    parts.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(tags) AS t(elem) WHERE elem->>0 = $${i++} AND elem->>1 LIKE $${i++})`);
                    vals.push(letter, p + '%');
                }
            }
        }
        // Not expired
        parts.push('(expires_at IS NULL OR expires_at > EXTRACT(EPOCH FROM NOW()))');
        const sql = `SELECT COUNT(*)::int AS c FROM nostr_events WHERE ${parts.join(' AND ')}`;
        const r = await this.pool.query(sql, vals);
        return r.rows[0]?.c || 0;
    }
    async queryByFilters(filters) {
        const parts = ['deleted = FALSE'];
        const vals = [];
        let i = 1;
        if (Array.isArray(filters?.kinds) && filters.kinds.length) {
            parts.push(`kind = ANY($${i++})`);
            vals.push(filters.kinds);
        }
        if (Array.isArray(filters?.ids) && filters.ids.length) {
            const exact = [];
            const prefixes = [];
            for (const id of filters.ids) {
                const s = String(id);
                if (s.length === 64)
                    exact.push(s);
                else
                    prefixes.push(s);
            }
            const idConds = [];
            if (exact.length) {
                idConds.push(`id = ANY($${i++})`);
                vals.push(exact);
            }
            if (prefixes.length) {
                idConds.push(`(${prefixes.map(_ => `id LIKE $${i++}`).join(' OR ')})`);
                for (const p of prefixes)
                    vals.push(p + '%');
            }
            if (idConds.length)
                parts.push(`(${idConds.join(' OR ')})`);
        }
        if (Array.isArray(filters?.authors) && filters.authors.length) {
            const exact = [];
            const prefixes = [];
            for (const a of filters.authors) {
                const s = String(a);
                if (s.length === 64)
                    exact.push(s);
                else
                    prefixes.push(s);
            }
            const aConds = [];
            if (exact.length) {
                aConds.push(`pubkey = ANY($${i++})`);
                vals.push(exact);
            }
            if (prefixes.length) {
                aConds.push(`(${prefixes.map(_ => `pubkey LIKE $${i++}`).join(' OR ')})`);
                for (const p of prefixes)
                    vals.push(p + '%');
            }
            if (aConds.length)
                parts.push(`(${aConds.join(' OR ')})`);
        }
        if (filters?.since) {
            parts.push(`created_at >= $${i++}`);
            vals.push(filters.since);
        }
        if (filters?.until) {
            parts.push(`created_at <= $${i++}`);
            vals.push(filters.until);
        }
        for (const tagKey of ['#e', '#p']) {
            const arr = filters?.[tagKey];
            if (Array.isArray(arr) && arr.length) {
                const letter = tagKey.substring(1);
                const exact = [];
                const prefixes = [];
                for (const v of arr) {
                    const s = String(v);
                    if (s.length === 64)
                        exact.push(s);
                    else
                        prefixes.push(s);
                }
                if (exact.length) {
                    if (letter === 'e') {
                        parts.push(`e_tags && $${i++}::text[]`);
                        vals.push(exact);
                    }
                    else if (letter === 'p') {
                        parts.push(`p_tags && $${i++}::text[]`);
                        vals.push(exact);
                    }
                }
                for (const p of prefixes) {
                    parts.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(tags) AS t(elem) WHERE elem->>0 = $${i++} AND elem->>1 LIKE $${i++})`);
                    vals.push(letter, p + '%');
                }
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
        return r.rows;
    }
    async close() {
        await this.pool.end();
    }
}
exports.PostgresRepository = PostgresRepository;
