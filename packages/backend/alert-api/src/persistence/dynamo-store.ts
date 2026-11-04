import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Conflict, type Store, type Row, type Change } from './store';
export class DynamoStore implements Store {
  readonly client: DynamoDBDocumentClient;
  constructor(
    readonly table: string,
    endpoint?: string,
  ) {
    this.client = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: process.env.AWS_REGION || 'ap-south-1',
        ...(endpoint
          ? { endpoint, credentials: { accessKeyId: 'local', secretAccessKey: 'local' } }
          : {}),
      }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
  }
  async get(pk: string, sk: string) {
    return (
      await this.client.send(
        new GetCommand({ TableName: this.table, Key: { pk, sk }, ConsistentRead: true }),
      )
    ).Item as Row | undefined;
  }
  async query(pk: string, prefix = '') {
    const rows: Row[] = [];
    let cursor: Record<string, any> | undefined;
    do {
      const r = await this.client.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
          ExpressionAttributeValues: { ':pk': pk, ':prefix': prefix },
          ConsistentRead: true,
          ExclusiveStartKey: cursor,
        }),
      );
      rows.push(...((r.Items || []) as Row[]));
      cursor = r.LastEvaluatedKey;
    } while (cursor);
    return rows;
  }
  async transact(changes: Change[]) {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: changes.map(({ row, expected }) => ({
            Put: {
              TableName: this.table,
              Item: row,
              ConditionExpression: expected === null ? 'attribute_not_exists(pk)' : '#v = :v',
              ...(expected === null
                ? {}
                : {
                    ExpressionAttributeNames: { '#v': 'version' },
                    ExpressionAttributeValues: { ':v': expected },
                  }),
            },
          })),
        }),
      );
    } catch (e: any) {
      if (
        e.name === 'TransactionCanceledException' &&
        e.CancellationReasons?.some((r: any) => r.Code === 'ConditionalCheckFailed')
      )
        throw new Conflict();
      throw e;
    }
  }
}
