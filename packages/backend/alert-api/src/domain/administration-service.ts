import type { Service } from './service';
import { randomUUID } from 'node:crypto';
import { insert, next, type Row } from '../persistence/store';
import { HttpError, tenant } from './shared';

export class AdministrationService {
  constructor(private readonly context: Service) {}

  async requireAdmin(id: string) {
    const actor = await this.context.creator(id);
    if (actor.role !== 'admin') throw new HttpError(403, 'Administrator access required');
    return actor;
  }

  async users(id: string, after?: string) {
    await this.context.requireAdmin(id);
    if (after && after.length > 256) throw new HttpError(400, 'Invalid cursor');
    const page = await this.context.store.page('ACCOUNTS', after);
    const registry = page.rows;
    const users = [];
    // Fetch sequentially to bound database pressure. Only account metadata is returned.
    for (const entry of registry) {
      const p = await this.context.store.get(tenant(entry.creatorId), 'PROFILE');
      if (p)
        users.push({
          creatorId: p.creatorId,
          displayName: p.displayName,
          role: p.role || 'user',
          status: p.deleted ? 'deleted' : p.banned ? 'banned' : 'active',
          joinedAt: p.joinedAt,
        });
    }
    await this.context.requireAdmin(id);
    return { users, next: page.next };
  }

  async manageUser(actorId: string, targetId: string, action: string) {
    if (!['ban', 'unban', 'delete'].includes(action)) throw new HttpError(400, 'Invalid action');
    return this.context.retry(async () => {
      const actor = await this.context.requireAdmin(actorId);
      const target = await this.context.store.get(tenant(targetId), 'PROFILE');
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
        delete updated.supportGoal;
      }
      await this.context.store.transact([
        next(actor),
        next(updated),
        insert({
          pk: 'ADMIN_AUDIT',
          sk: `${this.context.clock()}#${randomUUID()}`,
          actorId,
          targetId,
          action,
          ttl: this.context.clock() + 90 * 86400,
        }),
      ]);
      return { ok: true };
    });
  }
}
