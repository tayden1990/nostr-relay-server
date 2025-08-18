import { Request, Response } from 'express';
import { getNip11Info } from '../relay/nips/nip11';
import { incNip11 } from '../utils/metrics';
import { logInfo, logError } from '../utils/logger';

function setCors(res: Response) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    // Explicit header list is more broadly compatible than '*'
    res.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.set('Vary', 'Origin');
}

export const infoNip11 = (req: Request, res: Response) => {
    const ua = req.get('user-agent') || '';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    try {
        const nip11Info = getNip11Info();
        // NIP-11: set application/nostr+json and allow cross-origin requests
        res.set('Content-Type', 'application/nostr+json; charset=utf-8');
        setCors(res);
        // small cache to reduce load
        res.set('Cache-Control', 'public, max-age=60');
        incNip11(true);
        logInfo(`NIP-11 served ok ip=${ip} ua="${ua}" name="${nip11Info.name}" nips=${nip11Info.supported_nips.length}`);
        res.json(nip11Info);
    } catch (e: any) {
        incNip11(false);
        logError(`NIP-11 error ip=${ip} ua="${ua}" msg=${e?.message || e}`);
        setCors(res);
        res.status(500).json({ error: 'nip11-failed' });
    }
};