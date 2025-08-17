import WebSocket from 'ws';
import crypto from 'crypto';
import { logInfo, logError } from '../utils/logger';

type AuthState = { challenge: string; pubkey?: string; authed: boolean };
const authMap = new WeakMap<WebSocket, AuthState>();

export function issueAuthChallenge(ws: WebSocket): string {
    const challenge = crypto.randomBytes(16).toString('hex');
    authMap.set(ws, { challenge, authed: false });
    // Server-initiated AUTH challenge per NIP-42
    ws.send(JSON.stringify(["AUTH", challenge]));
    return challenge;
}

export async function handleAuthResponse(ws: WebSocket, evt: any): Promise<boolean> {
    try {
        const state = authMap.get(ws);
        if (!state) return false;
        // Expect kind 22242 event with tags including ["challenge", state.challenge]
        if (!evt || evt.kind !== 22242) return false;
        const { verifyEvent } = await import('nostr-tools');
        const ok = verifyEvent(evt as any);
        if (!ok) return false;
        const tags: string[][] = evt.tags || [];
        const challengeTag = tags.find(t => t[0] === 'challenge');
        if (!challengeTag || challengeTag[1] !== state.challenge) return false;
        authMap.set(ws, { ...state, pubkey: evt.pubkey, authed: true });
        logInfo(`AUTH success for ${evt.pubkey}`);
        ws.send(JSON.stringify(["OK", evt.id || "", true, "auth-accepted"]));
        return true;
    } catch (e: any) {
        logError(`AUTH error: ${e?.message || e}`);
        return false;
    }
}

export function isAuthed(ws: WebSocket): boolean {
    const state = authMap.get(ws);
    return !!state?.authed;
}

export function getAuthedPubkey(ws: WebSocket): string | undefined {
    return authMap.get(ws)?.pubkey;
}