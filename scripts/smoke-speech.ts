import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { alertSchema, type Alert } from '@tiprelay/event-contracts';
const base = 'http://127.0.0.1:3001';
async function request(path: string, body?: unknown, token = '') {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(`Request failed ${response.status}`);
  return value;
}
const { code } = await request('/v1/dashboard/pairing-code', {}),
  device = await request('/v1/device/pair', { code });
const { secret } = await request('/v1/dashboard/overlay/rotate', {}),
  { ticket } = await request('/v1/overlay/session', {}, secret);
const socket = new WebSocket(`ws://127.0.0.1:3001?ticket=${ticket}`),
  alerts: Alert[] = [];
socket.on('message', (raw) => alerts.push(alertSchema.parse(JSON.parse(raw.toString()))));
await new Promise<void>((resolve, reject) => {
  socket.once('open', resolve);
  socket.once('error', reject);
});
try {
  const reference = String(Date.now()).slice(-12);
  const event = {
    eventId: randomUUID(),
    sourceApp: 'com.phonepe.app',
    amountPaise: 100,
    observedAt: new Date().toISOString(),
    transactionReference: reference,
  };
  const credit = await request('/v1/device/payment-observations', event, device.token);
  const retry = await request('/v1/device/payment-observations', event, device.token);
  assert.equal(credit.alertId, retry.alertId);
  const message = await request('/v1/public/creators/demo/messages', {
    text: 'Thank you for supporting the stream. This is a synthetic TipRelay test.',
    amountPaise: 100,
    transactionReference: reference,
  });
  const approved = await request(`/v1/dashboard/messages/${message.messageId}/approve`, {});
  const deadline = Date.now() + 60000;
  while (!alerts.some((a) => a.alertId === `speech-${approved.jobId}`) && Date.now() < deadline)
    await new Promise((r) => setTimeout(r, 200));
  assert(
    alerts.some((a) => a.alertId === credit.alertId),
    'Credit must arrive independently',
  );
  const speech = alerts.find((a) => a.alertId === `speech-${approved.jobId}`);
  assert(speech?.audioUrl, 'Approved speech must arrive');
  const audio = await fetch(speech.audioUrl);
  assert.equal(audio.status, 200);
  const bytes = Buffer.from(await audio.arrayBuffer());
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert(bytes.length > 1000);
  const unsigned = await fetch(speech.audioUrl.split('?')[0]);
  assert.equal(unsigned.status, 403);
  console.log(
    `PASS credit ${credit.alertId}, duplicate retry, approved Piper speech, signed WAV (${bytes.length} bytes), unsigned denial`,
  );
} finally {
  socket.close();
  await request(`/v1/dashboard/devices/${device.deviceId}/revoke`, {});
}
