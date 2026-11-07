import type { Service } from './service';
import { type Alert } from '@tiprelay/event-contracts';
import { randomUUID } from 'node:crypto';
import { insert, next, type Change } from '../persistence/store';
import { tenant, retention } from './shared';

export class AlertsService {
  constructor(private readonly context: Service) {}

  alertChanges(id: string, alert: Alert): Change[] {
    const ttl = this.context.clock() + retention;
    return [
      insert({ pk: tenant(id), sk: `ALERT#${alert.alertId}`, alert, ttl }),
      insert({
        pk: tenant(id),
        sk: `OUTBOX#${alert.alertId}`,
        type: 'alert',
        alertId: alert.alertId,
        status: 'pending',
        gsiPk: 'OUTBOX',
        gsiSk: `${this.context.clock()}#${id}#${alert.alertId}`,
        createdAt: this.context.clock(),
        ttl,
      }),
    ];
  }

  async testAlert(id: string) {
    const p = await this.context.creator(id);
    await this.context.rate(`test:${id}`, 20);
    const alert: Alert = {
      alertId: randomUUID(),
      kind: 'test',
      createdAt: this.context.clock(),
      expiresAt: this.context.clock() + 120,
      amountPaise: 10000,
    };
    await this.context.store.transact([
      next(p),
      ...this.context.alertChanges(id, alert),
      ...this.context.amountSpeechChanges(id, alert),
    ]);
    return { alertId: alert.alertId };
  }
}
