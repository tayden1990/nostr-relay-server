import { Client } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const runMigrations = async () => {
    const connectionString = process.env.DATABASE_URL;
    const makeClient = () => connectionString
        ? new Client({ connectionString })
        : new Client({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432', 10),
        });
    let client: Client | null = null;

    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    try {
        // Retry connect loop to handle container startup races
        let attempts = 0;
        while (true) {
            try {
                if (client) {
                    try { await client.end(); } catch { /* ignore */ }
                }
                client = makeClient();
                await client.connect();
                break;
            } catch (err) {
                attempts++;
                if (attempts >= 30) throw err;
                console.log(`DB not ready, retrying (${attempts})...`);
                await sleep(2000);
            }
        }
        console.log('Connected to the database.');

        // Ensure migrations table exists
    await client!.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename TEXT UNIQUE NOT NULL,
                executed_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        const migrationsDir = path.join(__dirname, '../src/storage/postgres/migrations');
        const files = readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            // Skip legacy bootstrap migration that overlaps with docker/postgres/init.sql
            .filter(f => !/^001_/.test(f))
            .sort();

        for (const file of files) {
            const { rows } = await client!.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
            if (rows.length) {
                console.log(`Skipping already applied migration: ${file}`);
                continue;
            }
            const migrationPath = path.join(migrationsDir, file);
            const sql = readFileSync(migrationPath, 'utf8');
            console.log(`Applying migration: ${file}`);
            await client!.query('BEGIN');
            try {
                await client!.query(sql);
                await client!.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
                await client!.query('COMMIT');
                console.log(`Migration applied: ${file}`);
            } catch (err) {
                await client!.query('ROLLBACK');
                throw err;
            }
        }
        console.log('Migrations executed successfully.');
    } catch (error) {
        console.error('Error running migrations:', error);
    } finally {
        if (client) {
            try { await client.end(); } catch { /* ignore */ }
        }
        console.log('Database connection closed.');
    }
};

runMigrations();