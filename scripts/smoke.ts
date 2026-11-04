import 'dotenv/config';
import { WebSocket } from 'ws';
import { alertSchema } from '@tiprelay/event-contracts';
const base = process.env.SMOKE_API_URL || 'http://127.0.0.1:3001';
if (!base.startsWith('http://127.0.0.1:'))
  throw new Error('This smoke script is restricted to local development');
async function post(path: string, token = '') {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: '{}',
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const { secret } = await post('/v1/dashboard/overlay/rotate');
const { ticket } = await post('/v1/overlay/session', secret);
const ws = new WebSocket(base.replace('http:', 'ws:') + `?ticket=${ticket}`);
const received = new Map<string, unknown>();
ws.on('message', (raw) => {
  const a = alertSchema.parse(JSON.parse(raw.toString()));
  received.set(a.alertId, a);
});
await new Promise<void>((resolve, reject) => {
  ws.once('open', resolve);
  ws.once('error', reject);
  setTimeout(() => reject(new Error('Socket timeout')), 10000).unref();
});
const { alertId } = await post('/v1/dashboard/test-alert');
const until = Date.now() + 10000;
while (!received.has(alertId) && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
ws.close();
if (!received.has(alertId)) throw new Error('Alert did not reach WebSocket');
const chime = await fetch('http://127.0.0.1:5173/chime.wav');
if (!chime.ok) throw new Error('Chime asset missing');
console.log(
  `PASS actual WebSocket delivery ${alertId}; chime asset available. OBS audibility requires recording.`,
);
