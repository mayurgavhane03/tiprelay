import type { Service } from './service';
import { type Alert } from '@tiprelay/event-contracts';
import { insert, next, type Change } from '../persistence/store';
import { tenant, retention } from './shared';

export class SpeechService {
  constructor(private readonly context: Service) {}

  amountSpeechChanges(id: string, alert: Alert, payerName?: string): Change[] {
    if (process.env.SPEECH_ENABLED === 'false') return [];
    const jobId = `amount-${alert.alertId}`;
    const amountPaise = alert.amountPaise!;
    const spokenAmount = `${Math.floor(amountPaise / 100)} rupees${amountPaise % 100 ? ` and ${amountPaise % 100} paise` : ''}`;
    const now = this.context.clock();
    return [
      insert({
        pk: tenant(id),
        sk: `JOB#${jobId}`,
        jobId,
        sourceAlertId: alert.alertId,
        kind: 'amount',
        amountPaise,
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

  async speechReady(id: string, jobId: string, audioKey: string) {
    await this.context.retry(async () => {
      const p = await this.context.creator(id),
        job = await this.context.store.get(tenant(id), `JOB#${jobId}`);
      if (!job || job.status === 'ready' || job.expiresAt <= this.context.clock()) return;
      const alert: Alert = {
        alertId: `speech-${jobId}`,
        kind: 'speech',
        ...(job.amountPaise !== undefined ? { amountPaise: job.amountPaise } : {}),
        createdAt: this.context.clock(),
        expiresAt: job.expiresAt,
      };
      const changes = this.context.alertChanges(id, alert);
      changes[0].row.audioKey = audioKey;
      await this.context.store.transact([next(p), next({ ...job, status: 'ready' }), ...changes]);
    });
  }
}
