import type { Service } from './service';
import { insert, next } from '../persistence/store';
import { HttpError, hash, tenant } from './shared';

export class AccountsService {
  constructor(private readonly context: Service) {}

  async creator(id: string) {
    const row = await this.context.store.get(tenant(id), 'PROFILE');
    if (!row || row.deleted) throw new HttpError(404, 'Creator unavailable');
    if (row.banned) throw new HttpError(403, 'Account suspended');
    return row;
  }

  async provision(id: string) {
    return this.context.retry(async () => {
      const old = await this.context.store.get(tenant(id), 'PROFILE');
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
        joinedAt: this.context.clock(),
      });
      await this.context.store.transact([
        profile,
        insert({ pk: 'ACCOUNTS', sk: id, creatorId: id }),
        insert({ pk: `SLUG#${slug}`, sk: 'LOOKUP', creatorId: id }),
      ]);
      return profile.row;
    });
  }

  async account(id: string) {
    const profile = await this.context.provision(id);
    await this.context.retry(async () => {
      const current = await this.context.creator(id);
      const registry = await this.context.store.get('ACCOUNTS', id);
      if (!registry)
        await this.context.store.transact([
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

  async publicCreator(slug: string) {
    const lookup = await this.context.store.get(`SLUG#${slug}`, 'LOOKUP');
    if (!lookup) throw new HttpError(404, 'Creator not found');
    const p = await this.context.creator(lookup.creatorId);
    return {
      slug: p.slug,
      displayName: p.displayName,
      upiId: p.upiId,
      observationNotice:
        'Payments go directly to this creator. Alerts are best-effort phone observations, not bank confirmation.',
    };
  }

  async deleteCreator(id: string) {
    await this.context.retry(async () => {
      const p = await this.context.creator(id);
      delete p.supportGoal;
      await this.context.store.transact([
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
