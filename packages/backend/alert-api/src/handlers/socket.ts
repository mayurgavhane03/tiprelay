import { service, store, delivery } from './runtime';
import { replay } from '../realtime/dispatcher';
export async function handler(event: any) {
  const { routeKey, connectionId } = event.requestContext;
  try {
    if (routeKey === '$connect')
      await service.connect(event.queryStringParameters?.ticket || '', connectionId);
    else if (routeKey === '$disconnect') await service.disconnect(connectionId);
    else {
      const connection = await store.get(`CONNECTION#${connectionId}`, 'LOOKUP');
      if (!connection || !(await service.validConnection(connection))) return { statusCode: 401 };
      if (routeKey === 'ready') await replay(service, delivery, connection);
    }
    return { statusCode: 200 };
  } catch {
    return { statusCode: 401 };
  }
}
