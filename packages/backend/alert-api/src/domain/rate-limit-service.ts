import type { Service } from './service';
import { insert, next } from '../persistence/store';
import { HttpError, hash } from './shared';

export class RateLimitService {
  constructor(private readonly context: Service) {}

  async rate(scope: string, limit: number, seconds = 60) {
    const now = this.context.clock(),
      bucket = Math.floor(now / seconds);
    await this.context.retry(async () => {
      const pk = `RATE#${hash(scope)}#${bucket}`;
      const old = await this.context.store.get(pk, 'COUNT');
      if (old && old.count >= limit)
        throw new HttpError(429, 'Too many requests. Try again later.');
      await this.context.store.transact([
        old
          ? next({ ...old, count: old.count + 1 })
          : insert({ pk, sk: 'COUNT', count: 1, ttl: now + seconds * 2 }),
      ]);
    });
  }
}
