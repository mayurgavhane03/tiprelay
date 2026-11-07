import { unmarshall } from '@aws-sdk/util-dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { service, store, delivery } from './runtime';
import { dispatch } from '../realtime/dispatcher';
export async function handler(event: any) {
  if (event.source === 'aws.events') {
    const result = await store.client.send(
      new QueryCommand({
        TableName: store.table,
        IndexName: 'outbox',
        KeyConditionExpression: 'gsiPk = :pk',
        ExpressionAttributeValues: { ':pk': 'OUTBOX' },
        Limit: 100,
      }),
    );
    let oldest = 0;
    for (const row of result.Items || []) {
      oldest = Math.max(oldest, service.clock() - row.createdAt);
      try {
        await dispatch(service, delivery, row.pk, row.sk);
      } catch {
        console.error(JSON.stringify({
          event: 'outbox_dispatch_failed',
          correlationId: event.id,
        }));
      }
    }
    console.log(
      JSON.stringify({
        _aws: {
          Timestamp: Date.now(),
          CloudWatchMetrics: [
            {
              Namespace: 'TipRelay',
              Dimensions: [['Stage']],
              Metrics: [{ Name: 'OutboxAgeSeconds', Unit: 'Seconds' }],
            },
          ],
        },
        Stage: process.env.APP_ENV,
        OutboxAgeSeconds: oldest,
      }),
    );
    return {};
  }
  const failures = [];
  for (const record of event.Records || []) {
    const row = record.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage) : undefined;
    if (!row?.sk?.startsWith('OUTBOX#') || row.status !== 'pending') continue;
    try {
      try {
        await dispatch(service, delivery, row.pk, row.sk);
      } catch {
        console.error(JSON.stringify({
          event: 'outbox_dispatch_failed',
          correlationId: event.id,
        }));
      }
    } catch {
      failures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }
  return { batchItemFailures: failures };
}
