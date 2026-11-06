import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  observationSchema,
  messageSchema,
  settingsSchema,
  type Alert,
} from '@tiprelay/event-contracts';
import { Conflict, insert, next, type Store, type Row, type Change } from '../persistence/store';
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const tenant = (id: string) => `CREATOR#${id}`;
const retention = 7 * 86400;
export class Service {
  constructor(
    readonly store: Store,
    readonly clock = () => Math.floor(Date.now() / 1000),
  ) {}
  async retry<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; i < 6; i++) {
      try {
        return await fn();
      } catch (e) {
        if (!(e instanceof Conflict) || i === 5) throw e;
      }
    }
    throw new Error('Unreachable');
  }
  async creator(id: string) {
    const row = await this.store.get(tenant(id), 'PROFILE');
    if (!row || row.deleted) throw new HttpError(404, 'Creator unavailable');
    if (row.banned) throw new HttpError(403, 'Account suspended');
    return row;
  }
  async provision(id: string) {
    return this.retry(async () => {
      const old = await this.store.get(tenant(id), 'PROFILE');
      if (old) {
        if (old.deleted) throw new HttpError(410, 'Creator deleted');
        if (old.banned) throw new HttpError(403, 'Account suspended');
        return old;
      }
      const slug = id === 'demo' ? 'demo' : `creator-${hash(id).slice(0, 16)}`;
      const profile = insert({
        pk: tenant(id),
        sk: 'PROFILE',
        creatorId: id,
        slug,
        displayName: 'Your channel',
        upiId: '',
        overlayVersion: 0,
        deleted: false,
        banned: false,
        role: 'user',
        joinedAt: this.clock(),
      });
      await this.store.transact([
        profile,
        insert({ pk: 'ACCOUNTS', sk: id, creatorId: id }),
        insert({ pk: `SLUG#${slug}`, sk: 'LOOKUP', creatorId: id }),
      ]);
      return profile.row;
    });
  }
  async account(id: string) {
    const profile = await this.provision(id);
    await this.retry(async () => {
      const current = await this.creator(id);
      const registry = await this.store.get('ACCOUNTS', id);
      if (!registry)
        await this.store.transact([
          next(current),
          insert({ pk: 'ACCOUNTS', sk: id, creatorId: id }),
        ]);
    });
    return {
      creatorId: id,
      role: profile.role === 'admin' ? 'admin' : 'user',
      displayName: profile.displayName,
    };
  }
  async requireAdmin(id: string) {
    const actor = await this.creator(id);
    if (actor.role !== 'admin') throw new HttpError(403, 'Administrator access required');
    return actor;
  }
  async users(id: string, after?: string) {
    await this.requireAdmin(id);
    if (after && after.length > 256) throw new HttpError(400, 'Invalid cursor');
    const page = await this.store.page('ACCOUNTS', after);
    const registry = page.rows;
    const users = [];
    // Fetch sequentially to bound database pressure. Only account metadata is returned.
    for (const entry of registry) {
      const p = await this.store.get(tenant(entry.creatorId), 'PROFILE');
      if (p)
        users.push({
          creatorId: p.creatorId,
          displayName: p.displayName,
          role: p.role || 'user',
          status: p.deleted ? 'deleted' : p.banned ? 'banned' : 'active',
          joinedAt: p.joinedAt,
        });
    }
    await this.requireAdmin(id);
    return { users, next: page.next };
  }
  async manageUser(actorId: string, targetId: string, action: string) {
    if (!['ban', 'unban', 'delete'].includes(action)) throw new HttpError(400, 'Invalid action');
    return this.retry(async () => {
      const actor = await this.requireAdmin(actorId);
      const target = await this.store.get(tenant(targetId), 'PROFILE');
      if (!target || target.deleted) throw new HttpError(404, 'Account unavailable');
      if (actorId === targetId || target.role === 'admin')
        throw new HttpError(409, 'Administrator accounts are protected');
      const updated: Row = {
        ...target,
        banned: action !== 'unban',
        deleted: action === 'delete',
        overlayVersion: target.overlayVersion + 1,
      };
      if (action === 'delete') {
        updated.displayName = 'Deleted';
        updated.upiId = '';
      }
      await this.store.transact([
        next(actor),
        next(updated),
        insert({
          pk: 'ADMIN_AUDIT',
          sk: `${this.clock()}#${randomUUID()}`,
          actorId,
          targetId,
          action,
          ttl: this.clock() + 90 * 86400,
        }),
      ]);
      return { ok: true };
    });
  }
  async publicCreator(slug: string) {
    const lookup = await this.store.get(`SLUG#${slug}`, 'LOOKUP');
    if (!lookup) throw new HttpError(404, 'Creator not found');
    const p = await this.creator(lookup.creatorId);
    return {
      slug: p.slug,
      displayName: p.displayName,
      upiId: p.upiId,
      observationNotice:
        'Payments go directly to this creator. Alerts are best-effort phone observations, not bank confirmation.',
    };
  }
  async settings(id: string, body: unknown) {
    const data = settingsSchema.parse(body);
    await this.retry(async () => {
      const p = await this.creator(id);
      await this.store.transact([next({ ...p, ...data })]);
    });
    return { ok: true };
  }
  async rate(scope: string, limit: number, seconds = 60) {
    const now = this.clock(),
      bucket = Math.floor(now / seconds);
    await this.retry(async () => {
      const pk = `RATE#${hash(scope)}#${bucket}`;
      const old = await this.store.get(pk, 'COUNT');
      if (old && old.count >= limit)
        throw new HttpError(429, 'Too many requests. Try again later.');
      await this.store.transact([
        old
          ? next({ ...old, count: old.count + 1 })
          : insert({ pk, sk: 'COUNT', count: 1, ttl: now + seconds * 2 }),
      ]);
    });
  }
  async pairCode(id: string) {
    await this.creator(id);
    await this.rate(`pair-create:${id}`, 10);
    const code = randomBytes(6).toString('hex').toUpperCase();
    await this.store.transact([
      insert({
        pk: `PAIR#${hash(code)}`,
        sk: 'CODE',
        creatorId: id,
        ttl: this.clock() + 300,
        used: false,
      }),
    ]);
    return { code, expiresAt: this.clock() + 300 };
  }
  async pair(code: string, ownerId?: string) {
    const row = await this.store.get(`PAIR#${hash(code.toUpperCase())}`, 'CODE');
    if (!row || row.used || row.ttl! <= this.clock())
      throw new HttpError(401, 'Invalid or expired pairing code');
    const profile = await this.creator(row.creatorId);
    if (ownerId !== undefined && ownerId !== row.creatorId)
      throw new HttpError(403, 'Pairing code belongs to another account');
    const token = secret(),
      deviceId = randomUUID();
    try {
      await this.store.transact([
        next({ ...row, used: true }),
        next(profile),
        insert({
          pk: `DEVICE#${hash(token)}`,
          sk: 'AUTH',
          creatorId: row.creatorId,
          deviceId,
          revoked: false,
        }),
        insert({
          pk: tenant(row.creatorId),
          sk: `DEVICE#${deviceId}`,
          credentialHash: hash(token),
          deviceId,
          revoked: false,
          pairedAt: this.clock(),
        }),
      ]);
    } catch (e) {
      if (e instanceof Conflict) throw new HttpError(409, 'Pairing changed. Request a new code.');
      throw e;
    }
    return { token, deviceId, creatorId: row.creatorId };
  }
  async device(token: string) {
    const row = await this.store.get(`DEVICE#${hash(token)}`, 'AUTH');
    if (!row || row.revoked) throw new HttpError(401, 'Device credential unavailable');
    await this.creator(row.creatorId);
    return row;
  }
  async revokeDevice(id: string, deviceId: string) {
    await this.retry(async () => {
      await this.creator(id);
      const d = await this.store.get(tenant(id), `DEVICE#${deviceId}`);
      if (!d) throw new HttpError(404, 'Device not found');
      const auth = await this.store.get(`DEVICE#${d.credentialHash}`, 'AUTH');
      await this.store.transact([
        next({ ...d, revoked: true }),
        ...(auth ? [next({ ...auth, revoked: true })] : []),
      ]);
    });
    return { ok: true };
  }
  async rotateOverlay(id: string) {
    const token = secret();
    await this.retry(async () => {
      const p = await this.creator(id);
      await this.store.transact([
        next({ ...p, overlayVersion: p.overlayVersion + 1 }),
        insert({
          pk: `OVERLAY#${hash(token)}`,
          sk: 'AUTH',
          creatorId: id,
          overlayVersion: p.overlayVersion + 1,
        }),
      ]);
    });
    return { secret: token };
  }
  async overlay(token: string) {
    const cred = await this.store.get(`OVERLAY#${hash(token)}`, 'AUTH');
    if (!cred) throw new HttpError(401, 'Invalid overlay credential');
    const p = await this.creator(cred.creatorId);
    if (p.overlayVersion !== cred.overlayVersion)
      throw new HttpError(401, 'Overlay credential rotated');
    return cred;
  }
  async ticket(token: string) {
    const cred = await this.overlay(token),
      ticket = secret();
    await this.rate(`ticket:${cred.creatorId}`, 120);
    await this.store.transact([
      insert({
        pk: `TICKET#${hash(ticket)}`,
        sk: 'AUTH',
        creatorId: cred.creatorId,
        overlayVersion: cred.overlayVersion,
        ttl: this.clock() + 30,
        used: false,
      }),
    ]);
    return { ticket, expiresAt: this.clock() + 30 };
  }
  async connect(ticket: string, connectionId: string) {
    const row = await this.store.get(`TICKET#${hash(ticket)}`, 'AUTH');
    if (!row || row.used || row.ttl! <= this.clock())
      throw new HttpError(401, 'Invalid socket ticket');
    const p = await this.creator(row.creatorId);
    if (p.overlayVersion !== row.overlayVersion) throw new HttpError(401, 'Overlay rotated');
    const connection = {
      creatorId: row.creatorId,
      connectionId,
      overlayVersion: row.overlayVersion,
      ttl: this.clock() + 7200,
    };
    await this.store.transact([
      next({ ...row, used: true }),
      insert({ pk: tenant(row.creatorId), sk: `CONNECTION#${connectionId}`, ...connection }),
      insert({ pk: `CONNECTION#${connectionId}`, sk: 'LOOKUP', ...connection }),
    ]);
    return connection;
  }
  async validConnection(c: Row | { creatorId: string; overlayVersion: number; ttl: number }) {
    try {
      const p = await this.creator(c.creatorId);
      return c.ttl! > this.clock() && p.overlayVersion === c.overlayVersion;
    } catch {
      return false;
    }
  }
  async disconnect(connectionId: string) {
    const c = await this.store.get(`CONNECTION#${connectionId}`, 'LOOKUP');
    if (!c) return;
    const scoped = await this.store.get(tenant(c.creatorId), `CONNECTION#${connectionId}`);
    await this.store.transact([
      next({ ...c, ttl: this.clock() - 1 }),
      ...(scoped ? [next({ ...scoped, ttl: this.clock() - 1 })] : []),
    ]);
  }
  alertChanges(id: string, alert: Alert): Change[] {
    const ttl = this.clock() + retention;
    return [
      insert({ pk: tenant(id), sk: `ALERT#${alert.alertId}`, alert, ttl }),
      insert({
        pk: tenant(id),
        sk: `OUTBOX#${alert.alertId}`,
        type: 'alert',
        alertId: alert.alertId,
        status: 'pending',
        gsiPk: 'OUTBOX',
        gsiSk: `${this.clock()}#${id}#${alert.alertId}`,
        createdAt: this.clock(),
        ttl,
      }),
    ];
  }
  async observe(token: string, body: unknown) {
    const data = observationSchema.parse(body),
      now = this.clock();
    const observed = Math.floor(Date.parse(data.observedAt) / 1000);
    if (observed > now + 60 || observed < now - 86400)
      throw new HttpError(422, 'Observation outside acceptance window');
    return this.retry(async () => {
      const device = await this.device(token),
        id = device.creatorId,
        pk = tenant(id);
      const eventKey = `EVENT#${device.deviceId}#${data.eventId}`;
      const existing = await this.store.get(pk, eventKey);
      if (existing) return { alertId: existing.alertId, duplicate: true };
      const refKey = data.transactionReference
        ? `REF#${hash(data.transactionReference)}`
        : undefined;
      const ref = refKey ? await this.store.get(pk, refKey) : undefined;
      if (ref) {
        if (ref.amountPaise !== data.amountPaise)
          throw new HttpError(409, 'Reference amount conflicts');
        await this.store.transact([
          next(device),
          insert({ pk, sk: eventKey, alertId: ref.alertId, ttl: now + retention }),
        ]);
        return { alertId: ref.alertId, duplicate: true };
      }
      const profile = await this.creator(id);
      const alert: Alert = {
        alertId: randomUUID(),
        kind: 'credit',
        createdAt: now,
        expiresAt: observed + 120,
        amountPaise: data.amountPaise,
      };
      const diag = await this.store.get(pk, `DEVICE#${device.deviceId}`);
      const changes = [
        next(device),
        next(profile),
        insert({ pk, sk: eventKey, alertId: alert.alertId, ttl: now + retention }),
        insert({
          pk,
          sk: `OBS#${alert.alertId}`,
          alertId: alert.alertId,
          ...data,
          ttl: now + retention,
        }),
        ...this.alertChanges(id, alert),
        ...this.amountSpeechChanges(id, alert, data.payerName),
      ];
      if (refKey)
        changes.push(
          insert({
            pk,
            sk: refKey,
            alertId: alert.alertId,
            amountPaise: data.amountPaise,
            ttl: now + retention,
          }),
        );
      if (diag) changes.push(next({ ...diag, lastSync: now }));
      await this.store.transact(changes);
      return { alertId: alert.alertId, duplicate: false };
    });
  }
  async testAlert(id: string) {
    const p = await this.creator(id);
    await this.rate(`test:${id}`, 20);
    const alert: Alert = {
      alertId: randomUUID(),
      kind: 'test',
      createdAt: this.clock(),
      expiresAt: this.clock() + 120,
      amountPaise: 10000,
    };
    await this.store.transact([
      next(p),
      ...this.alertChanges(id, alert),
      ...this.amountSpeechChanges(id, alert),
    ]);
    return { alertId: alert.alertId };
  }
  amountSpeechChanges(id: string, alert: Alert, payerName?: string): Change[] {
    if (process.env.SPEECH_ENABLED === 'false') return [];
    const jobId = `amount-${alert.alertId}`;
    const amountPaise = alert.amountPaise!;
    const spokenAmount = `${Math.floor(amountPaise / 100)} rupees${amountPaise % 100 ? ` and ${amountPaise % 100} paise` : ''}`;
    const now = this.clock();
    return [
      insert({
        pk: tenant(id),
        sk: `JOB#${jobId}`,
        jobId,
        sourceAlertId: alert.alertId,
        kind: 'amount',
        ...(payerName ? { payerName } : {}),
        status: 'pending',
        text: `${alert.kind === 'test' ? 'Test alert. ' : ''}${spokenAmount} received${payerName ? ` from ${payerName}` : ''}. Thank you for your support.`,
        expiresAt: alert.expiresAt,
        ttl: now + retention,
      }),
      insert({
        pk: tenant(id),
        sk: `OUTBOX#job-${jobId}`,
        type: 'speech',
        jobId,
        status: 'pending',
        createdAt: now,
        gsiPk: 'OUTBOX',
        gsiSk: `${now}#${id}#speech-${jobId}`,
        ttl: now + retention,
      }),
    ];
  }
  async submit(slug: string, body: unknown, ip: string) {
    const data = messageSchema.parse(body);
    await this.rate(`message-ip:${ip}`, 5);
    await this.rate(`message-slug:${slug}`, 30);
    const lookup = await this.store.get(`SLUG#${slug}`, 'LOOKUP');
    if (!lookup) throw new HttpError(404, 'Creator unavailable');
    const p = await this.creator(lookup.creatorId),
      id = randomUUID();
    await this.store.transact([
      next(p),
      insert({
        pk: p.pk,
        sk: `MESSAGE#${id}`,
        messageId: id,
        ...data,
        status: 'pending',
        createdAt: this.clock(),
        ttl: this.clock() + retention,
      }),
    ]);
    return { messageId: id, status: 'pending' };
  }
  match(message: Row, rows: Row[]) {
    const observations = rows.filter((r) => r.sk.startsWith('OBS#') && r.ttl! > this.clock());
    const candidates = observations.filter(
      (o) =>
        message.transactionReference &&
        o.transactionReference === message.transactionReference &&
        (message.amountPaise === undefined || o.amountPaise === message.amountPaise),
    );
    const contenders = rows.filter(
      (r) =>
        r.sk.startsWith('MESSAGE#') &&
        r.status !== 'rejected' &&
        r.ttl! > this.clock() &&
        message.transactionReference &&
        r.transactionReference === message.transactionReference,
    );
    if (candidates.length === 1 && contenders.length === 1)
      return { state: 'matched', alertId: candidates[0].alertId };
    return {
      state: 'review',
      reason:
        candidates.length > 1 || contenders.length > 1
          ? 'Ambiguous reference'
          : 'Missing reference or amount mismatch',
    };
  }
  async moderate(
    id: string,
    messageId: string,
    action: 'approve' | 'reject',
    manualAlertId?: string,
  ) {
    return this.retry(async () => {
      const p = await this.creator(id),
        rows = await this.store.query(tenant(id)),
        m = rows.find((r) => r.sk === `MESSAGE#${messageId}`);
      if (!m || m.ttl! <= this.clock()) throw new HttpError(404, 'Message not found');
      if (m.status === 'approved') return { status: 'approved' };
      if (m.status === 'rejected') throw new HttpError(409, 'Message already rejected');
      if (action === 'reject') {
        await this.store.transact([next({ ...m, status: 'rejected' })]);
        return { status: 'rejected' };
      }
      if (process.env.SPEECH_ENABLED === 'false')
        throw new HttpError(
          503,
          'Speech is temporarily unavailable. Your message remains pending.',
        );
      const match = this.match(m, rows);
      const alertId = manualAlertId || match.alertId;
      const observation = rows.find((r) => r.sk === `OBS#${alertId}`);
      if (!observation || (!manualAlertId && match.state !== 'matched'))
        throw new HttpError(409, 'Select and review an observation before approving');
      if (m.amountPaise !== undefined && m.amountPaise !== observation.amountPaise)
        throw new HttpError(409, 'Amount mismatch');
      if (
        rows.some(
          (r) =>
            r.sk.startsWith('MESSAGE#') && r.status === 'approved' && r.matchedAlertId === alertId,
        )
      )
        throw new HttpError(409, 'Observation already has an approved message');
      const jobId = `${messageId}-en_US-ljspeech-high-v1`,
        now = this.clock();
      await this.store.transact([
        next(p),
        next({
          ...m,
          status: 'approved',
          matchedAlertId: alertId,
          approvedAt: now,
          manualReview: !!manualAlertId,
        }),
        insert({
          pk: p.pk,
          sk: `JOB#${jobId}`,
          jobId,
          messageId,
          status: 'pending',
          text: m.text,
          expiresAt: now + 120,
          ttl: now + retention,
        }),
        insert({
          pk: p.pk,
          sk: `OUTBOX#job-${jobId}`,
          type: 'speech',
          jobId,
          status: 'pending',
          createdAt: now,
          gsiPk: 'OUTBOX',
          gsiSk: `${now}#${id}#speech-${jobId}`,
          ttl: now + retention,
        }),
      ]);
      return { status: 'approved', jobId };
    });
  }
  async speechReady(id: string, jobId: string, audioKey: string) {
    await this.retry(async () => {
      const p = await this.creator(id),
        job = await this.store.get(tenant(id), `JOB#${jobId}`);
      if (!job || job.status === 'ready' || job.expiresAt <= this.clock()) return;
      const alert: Alert = {
        alertId: `speech-${jobId}`,
        kind: 'speech',
        createdAt: this.clock(),
        expiresAt: job.expiresAt,
      };
      const changes = this.alertChanges(id, alert);
      changes[0].row.audioKey = audioKey;
      await this.store.transact([next(p), next({ ...job, status: 'ready' }), ...changes]);
    });
  }
  async dashboard(id: string) {
    const profile = await this.provision(id),
      rows = (await this.store.query(tenant(id))).filter((r) => !r.ttl || r.ttl > this.clock());
    return {
      profile: {
        creatorId: id,
        slug: profile.slug,
        displayName: profile.displayName,
        upiId: profile.upiId,
      },
      devices: rows
        .filter((r) => r.sk.startsWith('DEVICE#'))
        .map((d) => ({
          deviceId: d.deviceId,
          revoked: d.revoked,
          lastSync: d.lastSync,
          pairedAt: d.pairedAt,
        })),
      connections: rows.filter(
        (r) => r.sk.startsWith('CONNECTION#') && r.overlayVersion === profile.overlayVersion,
      ).length,
      observations: rows
        .filter((r) => r.sk.startsWith('OBS#'))
        .map((r) => ({
          alertId: r.alertId,
          amountPaise: r.amountPaise,
          observedAt: r.observedAt,
          transactionReference: r.transactionReference,
        })),
      messages: rows
        .filter((r) => r.sk.startsWith('MESSAGE#'))
        .map((m) => ({
          messageId: m.messageId,
          text: m.text,
          amountPaise: m.amountPaise,
          status: m.status,
          createdAt: m.createdAt,
          ...this.match(m, rows),
        })),
      jobs: rows
        .filter((r) => r.sk.startsWith('JOB#'))
        .map((j) => ({ jobId: j.jobId, status: j.status, expiresAt: j.expiresAt })),
      notice:
        'Observed credits are best-effort notification signals. Verify settlement in your bank or UPI app.',
      speechAvailable: process.env.SPEECH_ENABLED !== 'false',
    };
  }
  async deleteCreator(id: string) {
    await this.retry(async () => {
      const p = await this.creator(id);
      await this.store.transact([
        next({
          ...p,
          deleted: true,
          displayName: 'Deleted',
          upiId: '',
          overlayVersion: p.overlayVersion + 1,
        }),
      ]);
    });
    return { ok: true };
  }
}
