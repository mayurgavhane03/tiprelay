import type { Alert } from '@tiprelay/event-contracts';
import { Service } from '../domain/service';
import { Conflict, next, type Row } from '../persistence/store';
export interface Delivery {
  send(connectionId: string, alert: Alert): Promise<void>;
  enqueue(creatorId: string, jobId: string): Promise<void>;
  audio(key: string): Promise<string>;
}
export async function materialize(row: Row, delivery: Delivery): Promise<Alert> {
  return {
    ...row.alert,
    ...(row.audioKey ? { audioUrl: await delivery.audio(row.audioKey) } : {}),
  };
}
export async function replay(service: Service, delivery: Delivery, c: Row) {
  if (!(await service.validConnection(c))) return;
  const alerts = (await service.store.query(`CREATOR#${c.creatorId}`, 'ALERT#'))
    .filter((r) => r.alert.expiresAt > service.clock())
    .sort((a, b) => a.alert.createdAt - b.alert.createdAt);
  for (const row of alerts) await delivery.send(c.connectionId, await materialize(row, delivery));
}
export async function dispatch(service: Service, delivery: Delivery, pk: string, sk: string) {
  let row = await service.store.get(pk, sk);
  if (!row || row.status !== 'pending' || (row.leaseUntil ?? 0) > service.clock()) return;
  const claim = next({ ...row, leaseUntil: service.clock() + 90 });
  try {
    await service.store.transact([claim]);
  } catch (error) {
    if (error instanceof Conflict) return;
    throw error;
  }
  row = claim.row;
  const id = pk.slice('CREATOR#'.length);
  const profile = await service.store.get(pk, 'PROFILE');
  if (!profile || profile.deleted || profile.banned) {
    await service.store.transact([
      next({ ...row, status: 'discarded', gsiPk: undefined, gsiSk: undefined }),
    ]);
    return;
  }
  if (row.type === 'speech') await delivery.enqueue(id, row.jobId);
  else {
    const a = await service.store.get(pk, `ALERT#${row.alertId}`);
    if (a && a.alert.expiresAt > service.clock()) {
      const connections = await service.store.query(pk, 'CONNECTION#');
      for (const c of connections)
        if (await service.validConnection(c))
          await delivery.send(c.connectionId, await materialize(a, delivery));
    }
  }
  await service.store.transact([
    next({ ...row, status: 'sent', gsiPk: undefined, gsiSk: undefined }),
  ]);
}
