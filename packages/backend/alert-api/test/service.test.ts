import { beforeEach, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Service } from '../src/domain/service';
import { FileStore } from '../src/persistence/file-store';
import { route } from '../src/http/router';
import { dispatch, replay, type Delivery } from '../src/realtime/dispatcher';
import { configuration } from '../src/config';
let service: Service, store: FileStore, now: number;
beforeEach(async () => {
  now = 1800000000;
  store = new FileStore();
  service = new Service(store, () => now);
  await service.provision('alice');
  await service.provision('bob');
});
async function device(id = 'alice') {
  const { code } = await service.pairCode(id);
  return service.pair(code);
}
const observation = (reference?: string) => ({
  eventId: randomUUID(),
  sourceApp: 'com.phonepe.app',
  amountPaise: 10000,
  observedAt: new Date(now * 1000).toISOString(),
  ...(reference ? { transactionReference: reference } : {}),
});
async function submit(reference?: string) {
  const p = await service.creator('alice');
  return service.submit(
    p.slug,
    {
      text: 'Thank you for the stream',
      amountPaise: 10000,
      ...(reference ? { transactionReference: reference } : {}),
    },
    randomUUID(),
  );
}
describe('isolation and credentials', () => {
  it('accepts GPay and records one amount speech job across upload retries', async () => {
    const d = await device();
    const data = {
      ...observation(),
      sourceApp: 'com.google.android.apps.nbu.paisa.user',
      payerName: 'Example Supporter',
    };
    const first = await service.observe(d.token, data);
    await service.observe(d.token, data);
    const jobs = (await store.query('CREATOR#alice')).filter((r) => r.sk.startsWith('JOB#'));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].sourceAlertId).toBe(first.alertId);
    expect(jobs[0].text).toContain('100 rupees received from Example Supporter');
    expect((await store.query('CREATOR#bob')).filter((r) => r.sk.startsWith('JOB#'))).toHaveLength(
      0,
    );
  });
  it('requires auth for deployed dashboard routes', async () => {
    const r = await route(service, { method: 'GET', path: '/v1/dashboard', ip: 'test' });
    expect(r.status).toBe(401);
  });
  it('rejects local bypass in Lambda, production, and non-loopback configurations', () => {
    for (const env of [
      { APP_ENV: 'production' },
      { APP_ENV: 'local', AWS_LAMBDA_FUNCTION_NAME: 'fn' },
      { APP_ENV: 'local', HOST: '0.0.0.0' },
    ])
      expect(() => configuration({ ...env, LOCAL_AUTH_BYPASS: 'true' })).toThrow();
    expect(
      configuration({ APP_ENV: 'local', LOCAL_AUTH_BYPASS: 'true', HOST: '127.0.0.1' }).bypass,
    ).toBe(true);
  });
  it('makes pairing codes single-use under concurrency', async () => {
    const { code } = await service.pairCode('alice');
    const results = await Promise.allSettled([service.pair(code), service.pair(code)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('expires pairing codes', async () => {
    const { code } = await service.pairCode('alice');
    now += 301;
    await expect(service.pair(code)).rejects.toThrow();
  });
  it('rejects revoked devices and cross-tenant revocation', async () => {
    const d = await device();
    await expect(service.revokeDevice('bob', d.deviceId)).rejects.toThrow();
    await service.revokeDevice('alice', d.deviceId);
    await expect(service.observe(d.token, observation())).rejects.toThrow();
  });
  it('separates overlay, device, and creator credentials', async () => {
    const d = await device();
    const o = await service.rotateOverlay('alice');
    await expect(service.observe(o.secret, observation())).rejects.toThrow();
    await expect(service.ticket(d.token)).rejects.toThrow();
  });
  it('rotates existing sockets and rejects consumed tickets', async () => {
    const a = await service.rotateOverlay('alice'),
      t = await service.ticket(a.secret),
      c = await service.connect(t.ticket, 'c1');
    await expect(service.connect(t.ticket, 'c2')).rejects.toThrow();
    await service.rotateOverlay('alice');
    expect(await service.validConnection(c)).toBe(false);
    await expect(service.ticket(a.secret)).rejects.toThrow();
  });
  it('cannot approve another creator message or link another observation', async () => {
    const d = await device(),
      o = await service.observe(d.token, observation());
    const m = await submit();
    await expect(service.moderate('bob', m.messageId, 'approve', o.alertId)).rejects.toThrow();
    const b = await service.creator('bob'),
      bm = await service.submit(b.slug, { text: 'test' }, 'bob-ip');
    await expect(service.moderate('bob', bm.messageId, 'approve', o.alertId)).rejects.toThrow();
  });
  it('deletion disables all credentials and prevents reprovisioning', async () => {
    const d = await device(),
      o = await service.rotateOverlay('alice');
    await service.deleteCreator('alice');
    await expect(service.observe(d.token, observation())).rejects.toThrow();
    await expect(service.ticket(o.secret)).rejects.toThrow();
    await expect(service.provision('alice')).rejects.toThrow();
  });
});
describe('durability, matching and delivery', () => {
  it('deduplicates concurrent upload retries atomically', async () => {
    const d = await device(),
      input = observation('123456789012');
    const results = await Promise.all([
      service.observe(d.token, input),
      service.observe(d.token, input),
    ]);
    expect(results[0].alertId).toBe(results[1].alertId);
    expect(await store.query('CREATOR#alice', 'OBS#')).toHaveLength(1);
    expect(
      (await store.query('CREATOR#alice', 'OUTBOX#')).filter((r) => r.type === 'alert'),
    ).toHaveLength(1);
  });
  it('deduplicates references across devices and rejects conflicting amounts', async () => {
    const d = await device(),
      other = await device();
    const first = await service.observe(d.token, observation('123456789012'));
    const second = await service.observe(other.token, observation('123456789012'));
    expect(second.alertId).toBe(first.alertId);
    await expect(
      service.observe(other.token, { ...observation('123456789012'), amountPaise: 20000 }),
    ).rejects.toThrow();
  });
  it('keeps equal-value payments with distinct or absent references', async () => {
    const d = await device();
    for (const ref of ['123456789012', '123456789013', undefined, undefined])
      await service.observe(d.token, observation(ref));
    expect(await store.query('CREATOR#alice', 'OBS#')).toHaveLength(4);
  });
  it('isolates identical references across creators', async () => {
    const a = await device(),
      b = await device('bob');
    await service.observe(a.token, observation('123456789012'));
    await service.observe(b.token, observation('123456789012'));
    expect((await service.dashboard('alice')).observations).toHaveLength(1);
    expect((await service.dashboard('bob')).observations).toHaveLength(1);
  });
  it('does not enqueue speech for an unapproved match', async () => {
    const d = await device();
    await service.observe(d.token, observation('123456789012'));
    await submit('123456789012');
    expect(
      (await store.query('CREATOR#alice', 'JOB#')).filter((r) => r.kind !== 'amount'),
    ).toHaveLength(0);
    expect((await service.dashboard('alice')).messages[0].state).toBe('matched');
  });
  it('requires manual review for ambiguous references', async () => {
    const d = await device();
    const o = await service.observe(d.token, observation('123456789012'));
    const m = await submit('123456789012');
    await submit('123456789012');
    await expect(service.moderate('alice', m.messageId, 'approve')).rejects.toThrow();
    await service.moderate('alice', m.messageId, 'approve', o.alertId);
    expect(
      (await store.query('CREATOR#alice', 'JOB#')).filter((r) => r.kind !== 'amount'),
    ).toHaveLength(1);
  });
  it('rejects amount mismatch and amount-only automatic matching', async () => {
    const d = await device();
    await service.observe(d.token, observation('123456789012'));
    const m = await submit();
    await expect(service.moderate('alice', m.messageId, 'approve')).rejects.toThrow();
    const p = await service.creator('alice');
    const wrong = await service.submit(
      p.slug,
      { text: 'hello', transactionReference: '123456789012', amountPaise: 5000 },
      'ip',
    );
    await expect(service.moderate('alice', wrong.messageId, 'approve')).rejects.toThrow();
  });
  it('approves once and publishes idempotent speech', async () => {
    const d = await device();
    await service.observe(d.token, observation('123456789012'));
    const m = await submit('123456789012');
    await Promise.all([
      service.moderate('alice', m.messageId, 'approve'),
      service.moderate('alice', m.messageId, 'approve'),
    ]);
    const jobs = (await store.query('CREATOR#alice', 'JOB#')).filter((r) => r.kind !== 'amount');
    expect(jobs).toHaveLength(1);
    await service.speechReady('alice', jobs[0].jobId, 'audio.wav');
    await service.speechReady('alice', jobs[0].jobId, 'audio.wav');
    expect(
      (await store.query('CREATOR#alice', 'ALERT#')).filter((r) => r.alert.kind === 'speech'),
    ).toHaveLength(1);
  });
  it('publishes chime alerts despite speech failure and scopes fan-out', async () => {
    const sent: { connection: string; id: string }[] = [];
    const delivery: Delivery = {
      send: async (connection, a) => {
        sent.push({ connection, id: a.alertId });
      },
      enqueue: async () => {
        throw new Error('Piper down');
      },
      audio: async () => '',
    };
    for (const id of ['alice', 'bob']) {
      const o = await service.rotateOverlay(id),
        t = await service.ticket(o.secret);
      await service.connect(t.ticket, id);
    }
    const d = await device(),
      credit = await service.observe(d.token, observation('123456789012'));
    const m = await submit('123456789012');
    await service.moderate('alice', m.messageId, 'approve');
    await dispatch(service, delivery, 'CREATOR#alice', `OUTBOX#${credit.alertId}`);
    const speech = (await store.query('CREATOR#alice', 'OUTBOX#job-'))[0];
    await expect(dispatch(service, delivery, speech.pk, speech.sk)).rejects.toThrow();
    expect(sent).toEqual([{ connection: 'alice', id: credit.alertId }]);
    expect((await store.get(speech.pk, speech.sk))?.status).toBe('pending');
  });
  it('replays only unexpired alerts and expires delayed speech', async () => {
    const d = await device();
    await service.observe(d.token, observation('123456789012'));
    const m = await submit('123456789012');
    await service.moderate('alice', m.messageId, 'approve');
    now += 121;
    const job = (await store.query('CREATOR#alice', 'JOB#'))[0];
    await service.speechReady('alice', job.jobId, 'audio.wav');
    expect(
      (await store.query('CREATOR#alice', 'ALERT#')).filter((r) => r.alert.kind === 'speech'),
    ).toHaveLength(0);
    const o = await service.rotateOverlay('alice'),
      t = await service.ticket(o.secret);
    await service.connect(t.ticket, 'late');
    const connection = (await store.get('CONNECTION#late', 'LOOKUP'))!;
    let count = 0;
    await replay(
      service,
      {
        send: async () => {
          count++;
        },
        enqueue: async () => {},
        audio: async () => '',
      },
      connection,
    );
    expect(count).toBe(0);
  });
  it('rejects raw notifications and caller-supplied tenant IDs', async () => {
    const d = await device();
    await expect(
      service.observe(d.token, { ...observation(), rawText: 'payer data', creatorId: 'bob' }),
    ).rejects.toThrow();
  });
  it('bounds text and enforces durable rate limits', async () => {
    const p = await service.creator('alice');
    await expect(service.submit(p.slug, { text: 'x'.repeat(241) }, 'ip')).rejects.toThrow();
    for (let i = 0; i < 5; i++) await service.submit(p.slug, { text: 'hello' }, 'ip');
    await expect(service.submit(p.slug, { text: 'hello' }, 'ip')).rejects.toThrow();
  });
});

it('keeps deduplicated support progress after alert history expires and protects the OBS source', async () => {
  now = Date.parse('2027-01-31T19:00:00Z') / 1000;
  const alice = await device();
  const bob = await device('bob');
  const { secret } = await service.rotateOverlay('alice');
  const goal = {
    title: 'February support',
    targetPaise: 50000,
    startDate: '2027-02-01',
    endDate: '2027-02-28',
    visible: true,
    style: {
      fill: '#22c55e',
      track: '#283344',
      text: '#ffffff',
      background: '#101827',
      backgroundOpacity: 0,
      width: 600,
      height: 20,
      radius: 12,
      padding: 12,
      fontSize: 22,
      font: 'sans-serif',
      alignment: 'left',
      showTitle: true,
      showAmounts: true,
      showPercent: true,
    },
  };
  await service.saveSupportGoal('alice', goal);
  const credit = observation('123456789012');
  await Promise.all([
    service.observe(alice.token, credit),
    service.observe(alice.token, { ...credit, eventId: randomUUID() }),
  ]);
  await service.observe(alice.token, { ...observation(), observedAt: '2027-01-31T18:29:59Z' });
  await service.observe(bob.token, observation());
  await service.testAlert('alice');
  now += 8 * 86400;
  const dashboard = await service.dashboard('alice');
  expect(dashboard.observations).toHaveLength(0);
  expect(dashboard.supportGoal).toEqual({ goal, observedPaise: 10000 });
  const request = { method: 'GET', path: '/v1/overlay/support-goal', token: secret, ip: 'test' };
  expect((await route(service, request)).body).toEqual(dashboard.supportGoal);
  await service.saveSupportGoal('alice', { ...goal, visible: false });
  expect((await route(service, request)).body).toBeNull();
  await service.rotateOverlay('alice');
  expect((await route(service, request)).status).toBe(401);
});
