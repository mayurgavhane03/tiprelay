import type { Service } from './service';
import { messageSchema } from '@tiprelay/event-contracts';
import { randomUUID } from 'node:crypto';
import { insert, next, type Row } from '../persistence/store';
import { HttpError, tenant, retention } from './shared';

export class MessagesService {
  constructor(private readonly context: Service) {}

  async submit(slug: string, body: unknown, ip: string) {
    const data = messageSchema.parse(body);
    await this.context.rate(`message-ip:${ip}`, 5);
    await this.context.rate(`message-slug:${slug}`, 30);
    const lookup = await this.context.store.get(`SLUG#${slug}`, 'LOOKUP');
    if (!lookup) throw new HttpError(404, 'Creator unavailable');
    const p = await this.context.creator(lookup.creatorId),
      id = randomUUID();
    await this.context.store.transact([
      next(p),
      insert({
        pk: p.pk,
        sk: `MESSAGE#${id}`,
        messageId: id,
        ...data,
        status: 'pending',
        createdAt: this.context.clock(),
        ttl: this.context.clock() + retention,
      }),
    ]);
    return { messageId: id, status: 'pending' };
  }

  match(message: Row, rows: Row[]) {
    const observations = rows.filter(
      (r) => r.sk.startsWith('OBS#') && r.ttl! > this.context.clock(),
    );
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
        r.ttl! > this.context.clock() &&
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
    return this.context.retry(async () => {
      const p = await this.context.creator(id),
        rows = await this.context.store.query(tenant(id)),
        m = rows.find((r) => r.sk === `MESSAGE#${messageId}`);
      if (!m || m.ttl! <= this.context.clock()) throw new HttpError(404, 'Message not found');
      if (m.status === 'approved') return { status: 'approved' };
      if (m.status === 'rejected') throw new HttpError(409, 'Message already rejected');
      if (action === 'reject') {
        await this.context.store.transact([next({ ...m, status: 'rejected' })]);
        return { status: 'rejected' };
      }
      if (process.env.SPEECH_ENABLED === 'false')
        throw new HttpError(
          503,
          'Speech is temporarily unavailable. Your message remains pending.',
        );
      const match = this.context.match(m, rows);
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
        now = this.context.clock();
      await this.context.store.transact([
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
          amountPaise: observation.amountPaise,
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
}
