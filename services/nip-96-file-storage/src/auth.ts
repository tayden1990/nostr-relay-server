import { Request, Response, NextFunction } from 'express';
import { verifyEvent } from 'nostr-tools';

// Optional IP allowlist for uploads (comma-separated list of CIDRs or IPs)
const IP_ALLOWLIST = (process.env.UPLOAD_IP_ALLOWLIST || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

export function ipAllowlist(req: Request, res: Response, next: NextFunction) {
    if (IP_ALLOWLIST.length === 0) return next();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    if (IP_ALLOWLIST.includes(ip)) return next();
    return res.status(403).json({ error: 'upload-ip-forbidden' });
}

// NIP-98: Signed HTTP request via Authorization header containing a nostr signed event
export function nip98Auth(req: Request, res: Response, next: NextFunction) {
    try {
        const auth = req.header('authorization') || '';
        const prefix = 'Nostr ';
        if (!auth.startsWith(prefix)) return res.status(401).json({ error: 'auth-required' });
        const json = auth.slice(prefix.length);
        let evt: any;
        try {
            evt = JSON.parse(json);
        } catch {
            return res.status(400).json({ error: 'invalid-auth' });
        }
        if (!verifyEvent(evt)) return res.status(401).json({ error: 'auth-invalid' });
        // Optionally, check evt.kind and that it references this URL/method in tags per NIP-98.
        (req as any).nostrPubkey = evt.pubkey;
        return next();
    } catch (e) {
        return res.status(500).json({ error: 'auth-error' });
    }
}