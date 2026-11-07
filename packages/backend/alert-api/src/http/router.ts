import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { Service, HttpError } from '../domain/service';
import { Conflict } from '../persistence/store';
import { publicRoutes } from './routes/public';
import { devicesRoutes } from './routes/devices';
import { overlayRoutes } from './routes/overlay';
import { accountRoutes } from './routes/account';
import { adminRoutes } from './routes/admin';
import { dashboardRoutes } from './routes/dashboard';
import type { Request } from './route-types';
export type { Request } from './route-types';
const groups = [
  publicRoutes,
  devicesRoutes,
  overlayRoutes,
  accountRoutes,
  adminRoutes,
  dashboardRoutes,
];
export async function route(service: Service, request: Request) {
  const correlationId = request.correlationId || randomUUID();
  try {
    const group = groups.find((candidate) => candidate.matches(request));
    if (!group) throw new HttpError(404, 'Route not found');
    await group.before?.(service, request);
    const endpoint = group.routes.find((candidate) => candidate.matches(request));
    if (!endpoint) throw new HttpError(404, 'Route not found');
    const result = await endpoint.handle(service, request);
    return { status: 200, body: result, correlationId };
  } catch (e) {
    const status =
      e instanceof HttpError
        ? e.status
        : e instanceof ZodError
          ? 400
          : e instanceof Conflict
            ? 409
            : 500;
    // Never log bodies, headers, URLs, secrets, references, or viewer text.
    console.error(
      JSON.stringify({
        level: status >= 500 ? 'error' : 'warn',
        event: 'request_failed',
        status,
        correlationId,
      }),
    );
    return {
      status,
      body: {
        error:
          e instanceof HttpError
            ? e.message
            : status === 400
              ? 'Invalid request'
              : status === 409
                ? 'Concurrent update. Retry.'
                : 'Request failed',
        correlationId,
      },
      correlationId,
    };
  }
}
