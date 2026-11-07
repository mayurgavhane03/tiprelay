import type { Service } from './service';
import { insert, next, type Row } from '../persistence/store';
import { HttpError, hash, secret, tenant } from './shared';

export class OverlayService {
  constructor(private readonly context: Service) {}

  async rotateOverlay(id: string) {
    const token = secret();
    await this.context.retry(async () => {
      const p = await this.context.creator(id);
      await this.context.store.transact([
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
    const cred = await this.context.store.get(`OVERLAY#${hash(token)}`, 'AUTH');
    if (!cred) throw new HttpError(401, 'Invalid overlay credential');
    const p = await this.context.creator(cred.creatorId);
    if (p.overlayVersion !== cred.overlayVersion)
      throw new HttpError(401, 'Overlay credential rotated');
    return cred;
  }

  async ticket(token: string) {
    const cred = await this.context.overlay(token),
      ticket = secret();
    await this.context.rate(`ticket:${cred.creatorId}`, 120);
    await this.context.store.transact([
      insert({
        pk: `TICKET#${hash(ticket)}`,
        sk: 'AUTH',
        creatorId: cred.creatorId,
        overlayVersion: cred.overlayVersion,
        ttl: this.context.clock() + 30,
        used: false,
      }),
    ]);
    return { ticket, expiresAt: this.context.clock() + 30 };
  }

  async connect(ticket: string, connectionId: string) {
    const row = await this.context.store.get(`TICKET#${hash(ticket)}`, 'AUTH');
    if (!row || row.used || row.ttl! <= this.context.clock())
      throw new HttpError(401, 'Invalid socket ticket');
    const p = await this.context.creator(row.creatorId);
    if (p.overlayVersion !== row.overlayVersion) throw new HttpError(401, 'Overlay rotated');
    const connection = {
      creatorId: row.creatorId,
      connectionId,
      overlayVersion: row.overlayVersion,
      ttl: this.context.clock() + 7200,
    };
    await this.context.store.transact([
      next({ ...row, used: true }),
      insert({ pk: tenant(row.creatorId), sk: `CONNECTION#${connectionId}`, ...connection }),
      insert({ pk: `CONNECTION#${connectionId}`, sk: 'LOOKUP', ...connection }),
    ]);
    return connection;
  }

  async validConnection(c: Row | { creatorId: string; overlayVersion: number; ttl: number }) {
    try {
      const p = await this.context.creator(c.creatorId);
      return c.ttl! > this.context.clock() && p.overlayVersion === c.overlayVersion;
    } catch {
      return false;
    }
  }

  async disconnect(connectionId: string) {
    const c = await this.context.store.get(`CONNECTION#${connectionId}`, 'LOOKUP');
    if (!c) return;
    const scoped = await this.context.store.get(tenant(c.creatorId), `CONNECTION#${connectionId}`);
    await this.context.store.transact([
      next({ ...c, ttl: this.context.clock() - 1 }),
      ...(scoped ? [next({ ...scoped, ttl: this.context.clock() - 1 })] : []),
    ]);
  }
}
