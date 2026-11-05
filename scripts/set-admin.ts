import 'dotenv/config';
import { FileStore } from '../packages/backend/alert-api/src/persistence/file-store';
import { DynamoStore } from '../packages/backend/alert-api/src/persistence/dynamo-store';
import { insert, next } from '../packages/backend/alert-api/src/persistence/store';
import { resolve } from 'node:path';
// Operator-only bootstrap. There is deliberately no HTTP role assignment endpoint.
const id = process.env.ADMIN_CREATOR_ID;
if (!id || !process.argv.includes('--execute'))
  throw new Error('Set ADMIN_CREATOR_ID and pass --execute');
const local = process.env.APP_ENV === 'local';
if (local && (id !== 'demo' || process.env.LOCAL_AUTH_BYPASS !== 'true'))
  throw new Error('Local bootstrap is restricted to the seeded demo account');
if (!local && (!process.env.TABLE_NAME || process.env.DYNAMODB_ENDPOINT))
  throw new Error('Set an AWS TABLE_NAME without a local endpoint');
const store = local
  ? new FileStore(resolve('.local/state.json'))
  : new DynamoStore(process.env.TABLE_NAME!);
const profile = await store.get(`CREATOR#${id}`, 'PROFILE');
if (!profile || profile.deleted || profile.banned)
  throw new Error('An active, existing account is required. Sign in first.');
const role = process.argv.includes('--revoke') ? 'user' : 'admin';
await store.transact([
  next({ ...profile, role }),
  insert({
    pk: 'ADMIN_AUDIT',
    sk: `${Date.now()}#operator`,
    targetId: id,
    action: `operator-role-${role}`,
    ttl: Math.floor(Date.now() / 1000) + 90 * 86400,
  }),
]);
console.log(`Account role updated to ${role}. Restart the API if using the local file store.`);
