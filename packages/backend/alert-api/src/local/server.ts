import { createServer } from 'node:http';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { route } from '../http/router';
import { dispatch, replay, type Delivery } from '../realtime/dispatcher';
import { config, service, store } from './runtime';
import { FileStore } from '../persistence/file-store';
import { next } from '../persistence/store';
const localAudio = resolve(
  fileURLToPath(new URL('../../../../../', import.meta.url)),
  '.local/audio',
);
const sockets = new Map<string, WebSocket>();
const audioSigningKey = randomUUID();
const signature = (key: string, expires: string) =>
  createHmac('sha256', audioSigningKey).update(`${key}:${expires}`).digest('hex');
const jobs = new Set<string>();
const delivery: Delivery = {
  async send(id, alert) {
    const ws = sockets.get(id);
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(alert));
  },
  async audio(key) {
    const expires = String(service.clock() + 60);
    return `http://127.0.0.1:${config.port}/audio/${key}?expires=${expires}&signature=${signature(key, expires)}`;
  },
  async enqueue(id, jobId) {
    if (jobs.has(jobId)) return;
    jobs.add(jobId);
    void (async () => {
      try {
        const job = await store.get(`CREATOR#${id}`, `JOB#${jobId}`);
        if (!job || job.status === 'ready' || job.expiresAt <= service.clock()) return;
        const response = await fetch(
          `${process.env.SPEECH_LOCAL_URL || 'http://127.0.0.1:5000'}/synthesize`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: job.text }),
            signal: AbortSignal.timeout(45000),
          },
        );
        if (!response.ok) throw new Error('Speech unavailable');
        const key = `${jobId}.wav`;
        await mkdir(localAudio, { recursive: true });
        await writeFile(`${localAudio}/${key}`, Buffer.from(await response.arrayBuffer()));
        await service.speechReady(id, jobId, key);
      } catch {
        const job = await store.get(`CREATOR#${id}`, `JOB#${jobId}`);
        if (job && job.status !== 'ready')
          await store.transact([next({ ...job, status: 'failed' })]);
        console.error(JSON.stringify({ event: 'speech_failed', jobId }));
      } finally {
        jobs.delete(jobId);
      }
    })();
  },
};
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(origin === config.origin
      ? { 'Access-Control-Allow-Origin': config.origin, Vary: 'Origin' }
      : {}),
  };
  if (origin && origin !== config.origin) {
    res.writeHead(403, headers).end('{}');
    return;
  }
  if (
    req.headers.host !== `127.0.0.1:${config.port}` &&
    req.headers.host !== `localhost:${config.port}`
  ) {
    res.writeHead(403, headers).end('{}');
    return;
  }
  if (req.method === 'OPTIONS') {
    res
      .writeHead(204, {
        ...headers,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      })
      .end();
    return;
  }
  const url = new URL(req.url || '/', `http://127.0.0.1:${config.port}`);
  if (url.pathname.startsWith('/audio/')) {
    const key = url.pathname.slice(7),
      expires = url.searchParams.get('expires') || '',
      sig = url.searchParams.get('signature') || '';
    const valid =
      /^[a-zA-Z0-9_-]+\.wav$/.test(key) &&
      Number(expires) > service.clock() &&
      /^[a-f0-9]{64}$/.test(sig) &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(signature(key, expires)));
    if (!valid) {
      res.writeHead(403, headers).end('{}');
      return;
    }
    try {
      res
        .writeHead(200, { ...headers, 'Content-Type': 'audio/wav' })
        .end(await readFile(`${localAudio}/${key}`));
    } catch {
      res.writeHead(404, headers).end('{}');
    }
    return;
  }
  try {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 8192) {
        res.writeHead(413, headers).end('{}');
        return;
      }
    }
    const result = await route(service, {
      method: req.method || 'GET',
      path: url.pathname,
      cursor: url.searchParams.get('cursor') || undefined,
      body: raw ? JSON.parse(raw) : undefined,
      token: req.headers.authorization?.replace(/^Bearer /, ''),
      creatorId: config.bypass ? 'demo' : undefined,
      ip: req.socket.remoteAddress || 'unknown',
    });
    res
      .writeHead(result.status, { ...headers, 'X-Correlation-ID': result.correlationId })
      .end(JSON.stringify(result.body));
  } catch {
    res.writeHead(400, headers).end(JSON.stringify({ error: 'Invalid request' }));
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on('upgrade', async (req, socket, head) => {
  try {
    if (req.headers.origin && req.headers.origin !== config.origin) throw new Error();
    const url = new URL(req.url || '/', `http://127.0.0.1:${config.port}`),
      id = randomUUID();
    if (url.pathname !== '/') throw new Error();
    const c = await service.connect(url.searchParams.get('ticket') || '', id);
    wss.handleUpgrade(req, socket, head, (ws) => {
      sockets.set(id, ws);
      ws.on('message', async () => {
        try {
          const row = await store.get(`CONNECTION#${id}`, 'LOOKUP');
          if (!row || !(await service.validConnection(row))) {
            ws.close(4001);
            return;
          }
          await replay(service, delivery, row);
        } catch {
          ws.close(1011);
        }
      });
      ws.on('close', () => {
        sockets.delete(id);
        void service.disconnect(id).catch(() => {});
      });
      void replay(service, delivery, { pk: '', sk: '', version: 1, ...c }).catch(() =>
        ws.close(1011),
      );
    });
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});
await service.provision('demo');
let ticking = false;
setInterval(async () => {
  if (ticking) return;
  ticking = true;
  try {
    for (const r of await store.query('CREATOR#demo', 'OUTBOX#'))
      if (r.status === 'pending') await dispatch(service, delivery, r.pk, r.sk);
    if (store instanceof FileStore) store.cleanup(service.clock());
  } catch {
    console.error(JSON.stringify({ event: 'outbox_retry' }));
  } finally {
    ticking = false;
  }
}, 500).unref();
server.listen(config.port, config.host, () =>
  console.log(`TipRelay API http://${config.host}:${config.port}`),
);
