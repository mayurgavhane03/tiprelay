import { describe, expect, it, vi } from 'vitest';
import { DynamoStore } from '../src/persistence/dynamo-store';

describe('DynamoStore.query', () => {
  it('queries all creator rows without an invalid empty sort-key prefix', async () => {
    const store = new DynamoStore('synthetic');
    const send = vi.spyOn(store.client, 'send').mockResolvedValue({ Items: [] } as never);

    await store.query('CREATOR#synthetic');

    const input = send.mock.calls[0][0].input;
    expect(input.KeyConditionExpression).toBe('pk = :pk');
    expect(input.ExpressionAttributeValues).toEqual({ ':pk': 'CREATOR#synthetic' });
  });
});
