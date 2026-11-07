import { it, expect } from 'vitest';
import { Service } from '../src/domain/service';
import { FileStore } from '../src/persistence/file-store';
import { dispatch, type Delivery } from '../src/realtime/dispatcher';

it('claims concurrent dispatch and recovers an expired lease after a failed send', async () => {
  let now = 1800000000;
  const store = new FileStore();
  const service = new Service(store, () => now);
  await service.provision('alice');
  const { alertId } = await service.testAlert('alice');
  const pk = 'CREATOR#alice';
  const sk = `OUTBOX#job-amount-${alertId}`;
  let attempts = 0;
  const delivery: Delivery = {
    send: async () => {},
    audio: async () => '',
    enqueue: async () => {
      attempts++;
      if (attempts === 1) throw new Error('Temporary queue failure');
    },
  };
  await Promise.allSettled([
    dispatch(service, delivery, pk, sk),
    dispatch(service, delivery, pk, sk),
  ]);
  expect(attempts).toBe(1);
  now += 91;
  await dispatch(service, delivery, pk, sk);
  expect(attempts).toBe(2);
  expect((await store.get(pk, sk))?.status).toBe('sent');
});
