import { Request, Response } from 'express';
import { getNip11Info } from '../relay/nips/nip11';

export const infoNip11 = (req: Request, res: Response) => {
    const nip11Info = getNip11Info();
    // NIP-11: set application/nostr+json and allow cross-origin requests
    res.set('Content-Type', 'application/nostr+json; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.json(nip11Info);
};