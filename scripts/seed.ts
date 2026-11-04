import 'dotenv/config';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoStore } from '../packages/backend/alert-api/src/persistence/dynamo-store';
import { service, store } from '../packages/backend/alert-api/src/local/runtime';
if (store instanceof DynamoStore) {
  try {
    await store.client.send(new DescribeTableCommand({ TableName: store.table }));
  } catch (e: any) {
    if (e.name !== 'ResourceNotFoundException') throw e;
    await store.client.send(
      new CreateTableCommand({
        TableName: store.table,
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
          { AttributeName: 'gsiPk', AttributeType: 'S' },
          { AttributeName: 'gsiSk', AttributeType: 'S' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        GlobalSecondaryIndexes: [
          {
            IndexName: 'outbox',
            KeySchema: [
              { AttributeName: 'gsiPk', KeyType: 'HASH' },
              { AttributeName: 'gsiSk', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    );
  }
}
await service.provision('demo');
console.log('Seeded demo creator. Configure your own UPI address in the dashboard.');
