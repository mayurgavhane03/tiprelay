import 'dotenv/config';
import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
const creator = process.env.DELETE_CREATOR_ID,
  table = process.env.TABLE_NAME,
  bucket = process.env.AUDIO_BUCKET;
if (!creator || !table || !bucket || !process.argv.includes('--execute'))
  throw new Error('Set DELETE_CREATOR_ID, TABLE_NAME and AUDIO_BUCKET, then pass --execute');
if (process.env.APP_ENV === 'local')
  throw new Error('Use an explicitly configured AWS operator environment, not the local .env');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({})),
  pk = `CREATOR#${creator}`;
const profile = await db.send(
  new GetCommand({ TableName: table, Key: { pk, sk: 'PROFILE' }, ConsistentRead: true }),
);
if (!profile.Item?.deleted) throw new Error('Creator must request deletion before purge');
let cursor: Record<string, any> | undefined,
  removed = 0;
do {
  const page = await db.send(
    new ScanCommand({
      TableName: table,
      FilterExpression: 'pk = :pk OR creatorId = :id',
      ExpressionAttributeValues: { ':pk': pk, ':id': creator },
      ExclusiveStartKey: cursor,
    }),
  );
  for (const row of page.Items || []) {
    if (row.pk === pk && row.sk === 'PROFILE') continue;
    await db.send(new DeleteCommand({ TableName: table, Key: { pk: row.pk, sk: row.sk } }));
    removed++;
  }
  cursor = page.LastEvaluatedKey;
} while (cursor);
const s3 = new S3Client({}),
  prefix = createHash('sha256').update(creator).digest('hex') + '/';
let continuation: string | undefined;
do {
  const page = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuation }),
  );
  const objects = page.Contents?.filter((o) => o.Key).map((o) => ({ Key: o.Key! })) || [];
  if (objects.length) {
    const result = await s3.send(
      new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects, Quiet: true } }),
    );
    if (result.Errors?.length) throw new Error('Some audio objects could not be deleted');
  }
  continuation = page.NextContinuationToken;
} while (continuation);
console.log(
  `Purged ${removed} records and creator audio. Minimal deletion tombstone retained. Complete Cognito deletion separately.`,
);
