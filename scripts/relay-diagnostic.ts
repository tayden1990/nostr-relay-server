/*
 Relay Diagnostic Script
 - Probes HTTP endpoints: /health, /nip11, /.well-known/nostr.json
 - WebSocket tests: connect, REQ/EVENT/EOSE, NIP-20 OK, delete (NIP-09), replaceable (NIP-33)
 - Validates content types and CORS for NIP-11
 - Optional NIP-96 upload if --nip96 is provided
 Usage:
   ts-node scripts/relay-diagnostic.ts --url https://relay.example.com [--ws wss://relay.example.com] [--nip96 https://relay.example.com] [--timeout 15000]
*/

import WebSocket from 'ws';
import crypto from 'crypto';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';

type Result = { name: string; ok: boolean; info?: any; error?: string };

const hasGlobalFetch = typeof (globalThis as any).fetch === 'function';
async function httpGet(url: string, headers: Record<string, string> = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await (globalThis as any).fetch(url, { headers, signal: controller.signal });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { /* noop */ }
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text, json };
  } finally { clearTimeout(t); }
}

function toWsUrl(httpUrl: string): string {
  return httpUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
}

function argVal(name: string, def?: string): string | undefined {
  const i = process.argv.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return def;
  const a = process.argv[i];
  if (a.includes('=')) return a.split('=')[1];
  return process.argv[i + 1] || def;
}

async function checkHealth(baseUrl: string, timeoutMs: number): Promise<Result> {
  try {
    const r = await httpGet(`${baseUrl.replace(/\/$/, '')}/health`, {}, timeoutMs);
    const ok = r.status === 200 && /ok|healthy|alive/i.test(r.text);
    return { name: 'HTTP /health', ok, info: { status: r.status, body: r.text } };
  } catch (e: any) {
    return { name: 'HTTP /health', ok: false, error: e?.message || String(e) };
  }
}

async function checkNip11(baseUrl: string, timeoutMs: number): Promise<Result> {
  try {
    const r = await httpGet(`${baseUrl.replace(/\/$/, '')}/nip11`, { Accept: 'application/nostr+json' }, timeoutMs);
    const ct = (r.headers['content-type'] || '').toLowerCase();
    const cors = r.headers['access-control-allow-origin'];
    const ok = r.status === 200 && r.json && Array.isArray(r.json.supported_nips) && ct.includes('application/nostr+json');
    return { name: 'NIP-11 /nip11', ok, info: { status: r.status, ct, cors, sample: r.json || r.text } };
  } catch (e: any) {
    return { name: 'NIP-11 /nip11', ok: false, error: e?.message || String(e) };
  }
}

async function checkWellKnown(baseUrl: string, timeoutMs: number): Promise<Result> {
  try {
    const r = await httpGet(`${baseUrl.replace(/\/$/, '')}/.well-known/nostr.json`, { Accept: 'application/nostr+json' }, timeoutMs);
    const ok = r.status === 200 && (r.json?.name || r.json?.supported_nips);
    return { name: 'NIP-11 /.well-known/nostr.json', ok, info: { status: r.status, ct: r.headers['content-type'], sample: r.json || r.text } };
  } catch (e: any) {
    return { name: 'NIP-11 /.well-known/nostr.json', ok: false, error: e?.message || String(e) };
  }
}

type WsMsg = [string, ...any[]];
function waitFor(ws: WebSocket, predicate: (msg: any) => boolean, timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, timeoutMs);
    const onMsg = (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        if (predicate(msg)) { cleanup(); resolve(msg); }
      } catch {/* ignore */}
    };
    const onErr = (err: any) => { cleanup(); reject(err); };
    const cleanup = () => { clearTimeout(to); ws.off('message', onMsg); ws.off('error', onErr); };
    ws.on('message', onMsg);
    ws.on('error', onErr);
  });
}

async function wsRoundtrip(wsUrl: string, timeoutMs: number): Promise<Result[]> {
  const results: Result[] = [];
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('WS connect timeout')), timeoutMs);
    ws.once('open', () => { clearTimeout(to); resolve(); });
    ws.once('error', reject);
  });
  results.push({ name: 'WS connect', ok: true });

  // Create key & publish a note (kind 1)
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const tagId = crypto.randomBytes(8).toString('hex');
  const baseEvent = { kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [["t", tagId]], content: `diagnostic ping ${tagId}` } as any;
  const signed = finalizeEvent(baseEvent, sk);

  ws.send(JSON.stringify(["EVENT", signed] satisfies WsMsg));
  // NIP-20 OK optional
  try {
    const okMsg: any = await waitFor(ws, (m) => Array.isArray(m) && m[0] === 'OK' && m[1] === signed.id, 5000);
    const accepted = okMsg?.[2] === true;
    results.push({ name: 'NIP-20 OK (publish)', ok: !!accepted, info: okMsg });
  } catch {
    results.push({ name: 'NIP-20 OK (publish)', ok: false, error: 'no OK received (relay may not implement NIP-20)' });
  }

  // Subscribe and expect EOSE + our event
  const subId = `diag-${crypto.randomBytes(4).toString('hex')}`;
  ws.send(JSON.stringify(["REQ", subId, { authors: [pk], kinds: [1], '#t': [tagId], limit: 10 }] satisfies WsMsg));
  let gotEvent = false; let gotEose = false;
  const start = Date.now();
  while (Date.now() - start < 8000 && (!gotEvent || !gotEose)) {
    try {
      const m: any = await waitFor(ws, () => true, 8000);
      if (Array.isArray(m) && m[0] === 'EVENT' && m[1] === subId && m[2]?.id === signed.id) gotEvent = true;
      if (Array.isArray(m) && m[0] === 'EOSE' && m[1] === subId) gotEose = true;
      if (gotEvent && gotEose) break;
    } catch { break; }
  }
  results.push({ name: 'WS REQ -> EVENT delivery', ok: gotEvent });
  results.push({ name: 'NIP-15 EOSE', ok: gotEose });
  ws.send(JSON.stringify(["CLOSE", subId] satisfies WsMsg));

  // NIP-09 delete
  const delEvent = finalizeEvent({ kind: 5, created_at: Math.floor(Date.now() / 1000), tags: [["e", signed.id]], content: 'delete test' } as any, sk);
  ws.send(JSON.stringify(["EVENT", delEvent] satisfies WsMsg));
  try {
    const okDel: any = await waitFor(ws, (m) => Array.isArray(m) && m[0] === 'OK' && m[1] === delEvent.id, 5000);
    results.push({ name: 'NIP-09 delete accepted', ok: !!okDel?.[2], info: okDel });
  } catch {
    results.push({ name: 'NIP-09 delete accepted', ok: false, error: 'no OK for delete (might be unsupported)' });
  }

  // NIP-33 parameterized replaceable (kind 30000 with d tag); publish twice and expect only latest
  const dtag = `diag-${crypto.randomBytes(3).toString('hex')}`;
  const ev1 = finalizeEvent({ kind: 30000, created_at: Math.floor(Date.now() / 1000) - 5, tags: [["d", dtag]], content: 'v1' } as any, sk);
  const ev2 = finalizeEvent({ kind: 30000, created_at: Math.floor(Date.now() / 1000), tags: [["d", dtag]], content: 'v2' } as any, sk);
  ws.send(JSON.stringify(["EVENT", ev1] satisfies WsMsg));
  ws.send(JSON.stringify(["EVENT", ev2] satisfies WsMsg));
  // Query for most recent
  const sub2 = `diag-${crypto.randomBytes(4).toString('hex')}`;
  ws.send(JSON.stringify(["REQ", sub2, { authors: [pk], kinds: [30000], '#d': [dtag], limit: 1 }] satisfies WsMsg));
  let latestIsV2 = false;
  try {
    const m: any = await waitFor(ws, (m) => Array.isArray(m) && m[0] === 'EVENT' && m[1] === sub2, 6000);
    latestIsV2 = m?.[2]?.content === 'v2';
  } catch {/* noop */}
  results.push({ name: 'NIP-33 replaceable latest wins', ok: latestIsV2 });
  ws.send(JSON.stringify(["CLOSE", sub2] satisfies WsMsg));

  ws.close();
  return results;
}

async function checkSizeLimit(wsUrl: string, maxLen: number | undefined, timeoutMs: number): Promise<Result> {
  // Try to send an oversized event and expect an error or reject OK
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('WS connect timeout')), timeoutMs);
    ws.once('open', () => { clearTimeout(to); resolve(); });
    ws.once('error', reject);
  });
  const sk = generateSecretKey();
  const contentSize = (maxLen || 1024 * 1024) + 1024;
  const big = finalizeEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [], content: 'x'.repeat(contentSize) } as any, sk);
  ws.send(JSON.stringify(["EVENT", big] as WsMsg));
  let rejected = false;
  try {
    const msg: any = await waitFor(ws, (m) => Array.isArray(m) && m[0] === 'OK' && m[1] === big.id, 5000);
    rejected = msg?.[2] === false;
  } catch {
    // If no OK received, we can’t be sure; leave as false
  }
  ws.close();
  return { name: 'Size limit enforcement (oversized note)', ok: rejected };
}

async function checkNip96(nip96Base: string, timeoutMs: number): Promise<Result[]> {
  const results: Result[] = [];
  try {
    const uploadUrl = nip96Base.replace(/\/$/, '') + '/upload';
    const body = Buffer.from('diagnostic-file');
    const r = await httpGet(uploadUrl, { 'Content-Type': 'application/octet-stream' }, timeoutMs);
    // Without actual POST we can’t upload via GET; do a real fetch with POST
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await (globalThis as any).fetch(uploadUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/octet-stream' }, signal: controller.signal });
      const text = await res.text();
      let json: any; try { json = JSON.parse(text); } catch {}
      const ok = res.status >= 200 && res.status < 300 && (json?.url || json?.id || json?.ok);
      results.push({ name: 'NIP-96 upload (POST /upload)', ok, info: { status: res.status, sample: json || text } });
    } finally { clearTimeout(t); }
  } catch (e: any) {
    results.push({ name: 'NIP-96 upload (POST /upload)', ok: false, error: e?.message || String(e) });
  }
  return results;
}

function printReport(results: Result[]) {
  const ok = (r: Result) => (r.ok ? 'PASS' : 'FAIL');
  console.log('--- Relay Diagnostic Report ---');
  for (const r of results) {
    console.log(`${ok(r)} - ${r.name}`);
    if (!r.ok && r.error) console.log(`  error: ${r.error}`);
    if (r.info) console.log(`  info: ${JSON.stringify(r.info).slice(0, 1000)}`);
  }
  const pass = results.filter(r => r.ok).length;
  console.log(`Summary: ${pass}/${results.length} checks passed.`);
}

async function main() {
  const baseUrl = (argVal('url') || process.env.RELAY_URL || '').toString();
  const wsUrl = (argVal('ws') || toWsUrl(baseUrl)).toString();
  const nip96 = argVal('nip96') || process.env.NIP96_URL;
  const timeoutMs = Number(argVal('timeout') || 15000);

  if (!baseUrl) {
    console.error('Usage: ts-node scripts/relay-diagnostic.ts --url https://relay.example.com [--ws wss://...] [--nip96 https://...] [--timeout 15000]');
    process.exit(2);
  }
  if (!hasGlobalFetch) {
    console.warn('Warning: global fetch not found. Please run with Node.js >= 18.');
  }

  const results: Result[] = [];
  results.push(await checkHealth(baseUrl, timeoutMs));
  const nip11 = await checkNip11(baseUrl, timeoutMs); results.push(nip11);
  results.push(await checkWellKnown(baseUrl, timeoutMs));

  // Extract max size if available to drive size-limit test
  const maxLen = nip11.info?.sample?.limitation?.max_message_length as number | undefined;

  try {
    const wsResults = await wsRoundtrip(wsUrl, timeoutMs);
    results.push(...wsResults);
  } catch (e: any) {
    results.push({ name: 'WS connect', ok: false, error: e?.message || String(e) });
  }

  if (maxLen) results.push(await checkSizeLimit(wsUrl, maxLen, timeoutMs));

  if (nip96) {
    const r = await checkNip96(nip96, timeoutMs);
    results.push(...r);
  }

  printReport(results);
}

main().catch(err => { console.error('diagnostic error:', err); process.exit(1); });
