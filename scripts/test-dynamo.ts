import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DynamoStore } from '../packages/backend/alert-api/src/persistence/dynamo-store';
import { Service } from '../packages/backend/alert-api/src/domain/service';
const endpoint = process.env.DYNAMODB_ENDPOINT || 'http://127.0.0.1:8000';
if (!endpoint.startsWith('http://127.0.0.1:'))
  throw new Error('Integration test requires local DynamoDB');
const store = new DynamoStore(process.env.TABLE_NAME || 'TipRelayLocal', endpoint),
  service = new Service(store);
const id = `integration-${randomUUID()}`;
await service.provision(id);
const { code } = await service.pairCode(id),
  { token } = await service.pair(code);
const input = {
  eventId: randomUUID(),
  sourceApp: 'com.phonepe.app',
  amountPaise: 100,
  observedAt: new Date().toISOString(),
  transactionReference: '123456789012',
};
const results = await Promise.all([service.observe(token, input), service.observe(token, input)]);
assert.equal(results[0].alertId, results[1].alertId);
await service.observe(token, {
  ...input,
  eventId: randomUUID(),
  transactionReference: '123456789013',
});
assert.equal((await store.query(`CREATOR#${id}`, 'OBS#')).length, 2);
assert.equal((await store.query(`CREATOR#${id}`, 'OUTBOX#')).length, 2);
await service.deleteCreator(id);
console.log(
  'PASS DynamoDB conditional transactions, concurrent deduplication, equal-value payments, and outbox writes',
);
