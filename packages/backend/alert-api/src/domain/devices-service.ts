import type { Service } from './service';
import { randomUUID, randomBytes } from 'node:crypto';
import { Conflict, insert, next } from '../persistence/store';
import { HttpError, hash, secret, tenant } from './shared';

export class DevicesService {
  constructor(private readonly context: Service) {}

  async pairCode(id: string) {
    await this.context.creator(id);
    await this.context.rate(`pair-create:${id}`, 10);
    const code = randomBytes(6).toString('hex').toUpperCase();
    await this.context.store.transact([
      insert({
        pk: `PAIR#${hash(code)}`,
        sk: 'CODE',
        creatorId: id,
        ttl: this.context.clock() + 300,
        used: false,
      }),
    ]);
    return { code, expiresAt: this.context.clock() + 300 };
  }

  async pair(code: string, ownerId?: string) {
    const row = await this.context.store.get(`PAIR#${hash(code.toUpperCase())}`, 'CODE');
    if (!row || row.used || row.ttl! <= this.context.clock())
      throw new HttpError(401, 'Invalid or expired pairing code');
    const profile = await this.context.creator(row.creatorId);
    if (ownerId !== undefined && ownerId !== row.creatorId)
      throw new HttpError(403, 'Pairing code belongs to another account');
    const token = secret(),
      deviceId = randomUUID();
    try {
      await this.context.store.transact([
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
          pairedAt: this.context.clock(),
        }),
      ]);
    } catch (e) {
      if (e instanceof Conflict) throw new HttpError(409, 'Pairing changed. Request a new code.');
      throw e;
    }
    return { token, deviceId, creatorId: row.creatorId };
  }

  async device(token: string) {
    const row = await this.context.store.get(`DEVICE#${hash(token)}`, 'AUTH');
    if (!row || row.revoked) throw new HttpError(401, 'Device credential unavailable');
    await this.context.creator(row.creatorId);
    return row;
  }

  async revokeDevice(id: string, deviceId: string) {
    await this.context.retry(async () => {
      await this.context.creator(id);
      const d = await this.context.store.get(tenant(id), `DEVICE#${deviceId}`);
      if (!d) throw new HttpError(404, 'Device not found');
      const auth = await this.context.store.get(`DEVICE#${d.credentialHash}`, 'AUTH');
      await this.context.store.transact([
        next({ ...d, revoked: true }),
        ...(auth ? [next({ ...auth, revoked: true })] : []),
      ]);
    });
    return { ok: true };
  }
}
