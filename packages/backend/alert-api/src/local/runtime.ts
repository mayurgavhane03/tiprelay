import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileStore } from '../persistence/file-store';
import { DynamoStore } from '../persistence/dynamo-store';
import { Service } from '../domain/service';
import { configuration } from '../config';
export const config = configuration();
export const store =
  process.env.STORAGE === 'dynamo'
    ? new DynamoStore(
        process.env.TABLE_NAME || 'TipRelayLocal',
        process.env.DYNAMODB_ENDPOINT || 'http://127.0.0.1:8000',
      )
    : new FileStore(
        resolve(fileURLToPath(new URL('../../../../../', import.meta.url)), '.local/state.json'),
      );
export const service = new Service(store);
