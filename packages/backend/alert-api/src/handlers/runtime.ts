import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoStore } from '../persistence/dynamo-store';
import { Service } from '../domain/service';
import { configuration } from '../config';
import type { Delivery } from '../realtime/dispatcher';
configuration();
export const store = new DynamoStore(process.env.TABLE_NAME!);
export const service = new Service(store);
const sqs = new SQSClient({}),
  s3 = new S3Client({});
export const delivery: Delivery = {
  async send(connectionId, alert) {
    const client = new ApiGatewayManagementApiClient({ endpoint: process.env.WS_MANAGEMENT_URL });
    try {
      await client.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(alert)),
        }),
      );
    } catch (e: any) {
      if (e.$metadata?.httpStatusCode === 410) {
        await service.disconnect(connectionId);
        return;
      }
      throw e;
    }
  },
  async enqueue(creatorId, jobId) {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: process.env.SPEECH_QUEUE_URL,
        MessageBody: JSON.stringify({ creatorId, jobId }),
      }),
    );
  },
  async audio(key) {
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.AUDIO_BUCKET, Key: key }), {
      expiresIn: 60,
    });
  },
};
