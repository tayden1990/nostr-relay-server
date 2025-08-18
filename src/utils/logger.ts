import { createLogger, format, transports, Logger } from 'winston';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), 'logs');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ignore */ }

const consoleFormat = format.combine(
    format.colorize(),
    format.timestamp(),
    format.printf(({ timestamp, level, message, ...rest }) => {
        const meta = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
        return `${timestamp} [${level}]: ${message}${meta}`;
    })
);

// Try to add daily rotation if available; fall back to single files.
function tryDailyRotate() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        // eslint-disable-next-line no-eval
        const req: any = (eval as unknown as (code: string) => any)('require');
        const Rotate = req('winston-daily-rotate-file');
        return {
            combined: new Rotate({
                dirname: LOG_DIR,
                filename: 'combined-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxFiles: process.env.LOG_MAX_FILES || '14d',
                level: 'info',
                format: format.combine(format.timestamp(), format.json()),
            }),
            error: new Rotate({
                dirname: LOG_DIR,
                filename: 'error-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxFiles: process.env.LOG_MAX_FILES || '30d',
                level: 'error',
                format: format.combine(format.timestamp(), format.json()),
            }),
        };
    } catch {
        return null;
    }
}

const rotate = tryDailyRotate();

export const logger: Logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        new transports.Console({ format: consoleFormat }),
        rotate?.combined ||
            new transports.File({
                filename: path.join(LOG_DIR, 'combined.log'),
                level: 'info',
                format: format.combine(format.timestamp(), format.json()),
            }),
        rotate?.error ||
            new transports.File({
                filename: path.join(LOG_DIR, 'error.log'),
                level: 'error',
                format: format.combine(format.timestamp(), format.json()),
            }),
    ],
});

export const logInfo = (message: string, meta?: Record<string, unknown>) => logger.info(message, meta);
export const logError = (message: string, meta?: Record<string, unknown>) => logger.error(message, meta);
export const logDebug = (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta);

// Child logger for components
export const childLogger = (component: string) => logger.child({ component });

// Log viewer helpers
export async function listLogFiles() {
    const files = await fsp.readdir(LOG_DIR);
    const items = await Promise.all(
        files
            .filter(f => f.endsWith('.log') || f.endsWith('.log.gz'))
            .map(async (name) => {
                const stat = await fsp.stat(path.join(LOG_DIR, name));
                return { name, size: stat.size, mtimeMs: stat.mtimeMs };
            })
    );
    // newest first
    return items.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function within(dir: string, file: string) {
    const p = path.normalize(path.join(dir, file));
    if (!p.startsWith(path.normalize(dir))) throw new Error('invalid-path');
    return p;
}

export type LogViewParams = {
    file?: string;   // specific file; defaults to latest combined*.log
    level?: string;  // info|error|warn|debug
    q?: string;      // substring
    limit?: number;  // max lines (default 200)
};

export async function readLog(params: LogViewParams) {
    const list = await listLogFiles();
    if (!list.length) return [];
    let file = params.file || list.find(f => f.name.startsWith('combined'))?.name || list[0].name;
    const abs = within(LOG_DIR, file);
    const maxBytes = 5 * 1024 * 1024; // 5MB cap
    const buf = await fsp.readFile(abs);
    const slice = buf.byteLength > maxBytes ? buf.subarray(buf.byteLength - maxBytes) : buf;
    const lines = slice.toString('utf8').split(/\r?\n/).filter(Boolean);

    const limit = Math.min(Math.max(params.limit || 200, 10), 1000);
    const out: any[] = [];
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
        const line = lines[i];
        let obj: any;
        try { obj = JSON.parse(line); }
        catch { obj = { ts: undefined, level: 'info', message: line }; }
        if (params.level && String(obj.level).toLowerCase() !== params.level.toLowerCase()) continue;
        if (params.q && !JSON.stringify(obj).toLowerCase().includes(params.q.toLowerCase())) continue;
        out.push(obj);
    }
    return out.reverse();
}

export async function getLogDir() { return LOG_DIR; }