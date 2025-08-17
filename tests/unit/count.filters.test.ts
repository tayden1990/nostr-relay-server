/// <reference types="jest" />
import { PostgresRepository } from '../../src/storage/postgres/repository';

const db = process.env.DATABASE_URL as string;
const itif = (db ? it : it.skip);

describe('countByFilters tags and prefixes', () => {
  const repo = db ? new PostgresRepository(db) : (null as any);
  const now = Math.floor(Date.now() / 1000);

  beforeAll(async () => {
    if (!repo) return;
    // Insert minimal events
    await (repo as any).pool.query("DELETE FROM nostr_events");
    const insert = `INSERT INTO nostr_events (id, kind, pubkey, created_at, content, tags, deleted)
                    VALUES ($1,$2,$3,$4,$5,$6,false)`;
    await (repo as any).pool.query(insert, ['e1'.padEnd(64,'1'), 1, 'a1'.padEnd(64,'a'), now-10, 'hello', JSON.stringify([["e","abcd"],["p","pkey1"]])]);
    await (repo as any).pool.query(insert, ['e2'.padEnd(64,'2'), 1, 'a2'.padEnd(64,'a'), now-5, 'world', JSON.stringify([["e","abce"],["p","pkey2"]])]);
  });

  afterAll(async () => { if (repo) await repo.close(); });

  itif('counts by #e exact', async () => {
    const c = await repo.countByFilters({ '#e': ['abcd'] });
    expect(c).toBe(1);
  });

  itif('counts by #e prefix', async () => {
    const c = await repo.countByFilters({ '#e': ['abc'] });
    expect(c).toBe(2);
  });

  itif('counts by authors prefix', async () => {
    const prefix = 'a1'.padEnd(4,'a');
    const c = await repo.countByFilters({ authors: [prefix] });
    expect(c).toBe(1);
  });
});
