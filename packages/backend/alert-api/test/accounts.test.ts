import { beforeEach, describe, expect, it } from 'vitest';
import { Service } from '../src/domain/service';
import { FileStore } from '../src/persistence/file-store';
import { next } from '../src/persistence/store';
import { route } from '../src/http/router';
import { dispatch } from '../src/realtime/dispatcher';
let service: Service;
beforeEach(async () => {
  service = new Service(new FileStore());
  await service.account('admin');
  await service.account('user');
  await service.store.transact([next({ ...(await service.creator('admin')), role: 'admin' })]);
});
describe('account roles and administration', () => {
  it('defaults accounts to user and preserves an operator-assigned admin on login', async () => {
    expect((await service.account('user')).role).toBe('user');
    expect((await service.account('admin')).role).toBe('admin');
  });
  it('rejects unauthenticated and normal-user administrative requests', async () => {
    expect(
      (await route(service, { method: 'GET', path: '/v1/admin/users', ip: 'test' })).status,
    ).toBe(401);
    expect(
      (
        await route(service, {
          method: 'GET',
          path: '/v1/admin/users',
          ip: 'test',
          creatorId: 'user',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await route(service, {
          method: 'POST',
          path: '/v1/admin/users/admin/delete',
          ip: 'test',
          creatorId: 'user',
        })
      ).status,
    ).toBe(403);
  });
  it('does not accept role escalation through settings or account request bodies', async () => {
    expect(
      (
        await route(service, {
          method: 'PUT',
          path: '/v1/dashboard/settings',
          ip: 'test',
          creatorId: 'user',
          body: { displayName: 'Test', upiId: 'test@upi', role: 'admin' },
        })
      ).status,
    ).toBe(400);
    await route(service, {
      method: 'GET',
      path: '/v1/account',
      ip: 'test',
      creatorId: 'user',
      body: { role: 'admin' },
    });
    expect((await service.account('user')).role).toBe('user');
  });
  it('blocks banned accounts, existing device credentials, and existing overlay credentials', async () => {
    const { code } = await service.pairCode('user');
    const device = await service.pair(code, 'user');
    const overlay = await service.rotateOverlay('user');
    const ticket = await service.ticket(overlay.secret);
    const connection = await service.connect(ticket.ticket, 'existing-socket');
    await service.manageUser('admin', 'user', 'ban');
    expect(await service.validConnection(connection)).toBe(false);
    await expect(service.account('user')).rejects.toMatchObject({ status: 403 });
    await expect(service.device(device.token)).rejects.toMatchObject({ status: 403 });
    await expect(service.ticket(overlay.secret)).rejects.toThrow();
    await service.manageUser('admin', 'user', 'unban');
    expect((await service.account('user')).role).toBe('user');
  });
  it('discards pending alerts for a banned creator', async () => {
    const alert = await service.testAlert('user');
    await service.manageUser('admin', 'user', 'ban');
    let sent = false;
    await dispatch(
      service,
      {
        send: async () => {
          sent = true;
        },
        enqueue: async () => {
          sent = true;
        },
        audio: async () => '',
      },
      'CREATOR#user',
      `OUTBOX#${alert.alertId}`,
    );
    expect(sent).toBe(false);
    expect((await service.store.get('CREATOR#user', `OUTBOX#${alert.alertId}`))?.status).toBe(
      'discarded',
    );
  });
  it('fails a concurrent admin mutation when the operator revokes the actor role', async () => {
    const transact = service.store.transact.bind(service.store);
    let revoked = false;
    service.store.transact = async (changes) => {
      if (!revoked && changes.some((change) => change.row.pk === 'ADMIN_AUDIT')) {
        revoked = true;
        const actor = await service.creator('admin');
        await transact([next({ ...actor, role: 'user' })]);
      }
      await transact(changes);
    };
    await expect(service.manageUser('admin', 'user', 'ban')).rejects.toMatchObject({ status: 403 });
    expect((await service.creator('user')).banned).toBe(false);
  });
  it('requires paired-phone login and prevents pairing another creator’s code', async () => {
    const { code } = await service.pairCode('user');
    expect(
      (
        await route(service, {
          method: 'POST',
          path: '/v1/device/pair',
          ip: 'test',
          body: { code },
        })
      ).status,
    ).toBe(401);
    await expect(service.pair(code, 'admin')).rejects.toMatchObject({ status: 403 });
    expect((await service.pair(code, 'user')).token).toBeTruthy();
  });
  it('protects administrators and records destructive actions in an audit log', async () => {
    await expect(service.manageUser('admin', 'admin', 'delete')).rejects.toMatchObject({
      status: 409,
    });
    await service.manageUser('admin', 'user', 'delete');
    await expect(service.account('user')).rejects.toMatchObject({ status: 410 });
    expect((await service.users('admin')).users.find((u) => u.creatorId === 'user')?.status).toBe(
      'deleted',
    );
    expect((await service.store.query('ADMIN_AUDIT'))[0].action).toBe('delete');
  });
  it('pages account records without exposing device tokens or payment details', async () => {
    for (let i = 0; i < 53; i++) await service.account(`creator-${i.toString().padStart(3, '0')}`);
    const first = await service.users('admin');
    expect(first.users).toHaveLength(50);
    const second = await service.users('admin', first.next);
    expect(second.users).toHaveLength(5);
    expect(new Set([...first.users, ...second.users].map((u) => u.creatorId)).size).toBe(55);
    expect(first.users[0]).not.toHaveProperty('upiId');
  });
});
