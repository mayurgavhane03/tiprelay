import type { Service } from './service';
import { observationSchema, supportDate, type Alert } from '@tiprelay/event-contracts';
import { randomUUID } from 'node:crypto';
import { insert, next } from '../persistence/store';
import { HttpError, hash, tenant, retention } from './shared';

export class PaymentsService {
  constructor(private readonly context: Service) {}

  async observe(token: string, body: unknown) {
    const data = observationSchema.parse(body),
      now = this.context.clock();
    const observed = Math.floor(Date.parse(data.observedAt) / 1000);
    if (observed > now + 60 || observed < now - 86400)
      throw new HttpError(422, 'Observation outside acceptance window');
    return this.context.retry(async () => {
      const device = await this.context.device(token),
        id = device.creatorId,
        pk = tenant(id);
      const eventKey = `EVENT#${device.deviceId}#${data.eventId}`;
      const existing = await this.context.store.get(pk, eventKey);
      if (existing) return { alertId: existing.alertId, duplicate: true };
      const refKey = data.transactionReference
        ? `REF#${hash(data.transactionReference)}`
        : undefined;
      const ref = refKey ? await this.context.store.get(pk, refKey) : undefined;
      if (ref) {
        if (ref.amountPaise !== data.amountPaise)
          throw new HttpError(409, 'Reference amount conflicts');
        await this.context.store.transact([
          next(device),
          insert({ pk, sk: eventKey, alertId: ref.alertId, ttl: now + retention }),
        ]);
        return { alertId: ref.alertId, duplicate: true };
      }
      const profile = await this.context.creator(id);
      const alert: Alert = {
        alertId: randomUUID(),
        kind: 'credit',
        createdAt: now,
        expiresAt: observed + 120,
        amountPaise: data.amountPaise,
      };
      const diag = await this.context.store.get(pk, `DEVICE#${device.deviceId}`);
      const supportKey = `SUPPORT#${supportDate(Date.parse(data.observedAt))}`;
      const daily = await this.context.store.get(pk, supportKey);
      const changes = [
        next(device),
        next(profile),
        daily
          ? next({ ...daily, amountPaise: daily.amountPaise + data.amountPaise })
          : insert({ pk, sk: supportKey, amountPaise: data.amountPaise }),
        insert({ pk, sk: eventKey, alertId: alert.alertId, ttl: now + retention }),
        insert({
          pk,
          sk: `OBS#${alert.alertId}`,
          alertId: alert.alertId,
          ...data,
          ttl: now + retention,
        }),
        ...this.context.alertChanges(id, alert),
        ...this.context.amountSpeechChanges(id, alert, data.payerName),
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
      await this.context.store.transact(changes);
      return { alertId: alert.alertId, duplicate: false };
    });
  }

  async verifyPayment(id: string, alertId: string) {
    return this.context.retry(async () => {
      await this.context.creator(id);
      const row = await this.context.store.get(tenant(id), `OBS#${alertId}`);
      if (!row || row.ttl! <= this.context.clock()) throw new HttpError(404, 'Payment not found');
      if (!row.verifiedAt)
        await this.context.store.transact([next({ ...row, verifiedAt: this.context.clock() })]);
      return { ok: true };
    });
  }
}
