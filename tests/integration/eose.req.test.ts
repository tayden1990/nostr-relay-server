/// <reference types="jest" />
import WebSocket from 'ws';

const itif = (process.env.DATABASE_URL ? it : it.skip);

describe('WS REQ -> EOSE', () => {
  itif('sends EOSE after initial query', done => {
    const port = Number(process.env.PORT || 8080);
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const subId = 'test-sub-1';
    let sawEOSE = false;

    ws.on('open', () => {
      ws.send(JSON.stringify(["REQ", subId, { kinds: [1], limit: 1 }]));
    });
    ws.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (Array.isArray(msg) && msg[0] === 'EOSE' && msg[1] === subId) {
        sawEOSE = true;
        ws.close();
      }
    });
    ws.on('close', () => {
      expect(sawEOSE).toBe(true);
      done();
    });
    ws.on('error', () => { /* ignore */ });
  });
});
