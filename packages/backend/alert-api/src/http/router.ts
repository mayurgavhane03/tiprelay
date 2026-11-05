import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { Service, HttpError } from '../domain/service';
import { Conflict } from '../persistence/store';
export interface Request {
  method: string;
  path: string;
  body?: unknown;
  token?: string;
  creatorId?: string;
  ip: string;
  correlationId?: string;
  cursor?: string;
}
export async function route(service: Service, request: Request) {
  const correlationId = request.correlationId || randomUUID();
  const { method, path, body, token, creatorId, ip } = request;
  try {
    let result: unknown;
    const parts = path.split('/').filter(Boolean);
    if (method === 'GET' && path === '/health') result = { ok: true };
    else if (method === 'GET' && /^\/v1\/public\/creators\/[^/]+$/.test(path))
      result = await service.publicCreator(parts[3]);
    else if (method === 'POST' && /^\/v1\/public\/creators\/[^/]+\/messages$/.test(path))
      result = await service.submit(parts[3], body, ip);
    else if (method === 'POST' && path === '/v1/device/pair') {
      await service.rate(`pair-ip:${ip}`, 10);
      const code = (body as { code?: string })?.code;
      if (typeof code !== 'string' || !/^[A-Fa-f0-9]{12}$/.test(code))
        throw new HttpError(400, 'Invalid code');
      if (!creatorId) throw new HttpError(401, 'Sign in required');
      result = await service.pair(code, creatorId);
    } else if (method === 'POST' && path === '/v1/device/payment-observations')
      result = await service.observe(token || '', body);
    else if (method === 'POST' && path === '/v1/overlay/session') {
      await service.rate(`overlay-ip:${ip}`, 120);
      result = await service.ticket(token || '');
    } else if (path === '/v1/account') {
      if (!creatorId) throw new HttpError(401, 'Sign in required');
      if (method !== 'GET') throw new HttpError(405, 'Method not allowed');
      result = await service.account(creatorId);
    } else if (path.startsWith('/v1/admin/')) {
      if (!creatorId) throw new HttpError(401, 'Sign in required');
      await service.requireAdmin(creatorId);
      await service.rate(`admin:${creatorId}`, 60);
      if (method === 'GET' && path === '/v1/admin/users')
        result = await service.users(creatorId, request.cursor);
      else if (method === 'POST' && /^\/v1\/admin\/users\/[^/]+\/(ban|unban|delete)$/.test(path))
        result = await service.manageUser(creatorId, decodeURIComponent(parts[3]), parts[4]);
      else throw new HttpError(404, 'Route not found');
    } else if (path.startsWith('/v1/dashboard')) {
      if (!creatorId) throw new HttpError(401, 'Sign in required');
      await service.rate(`dashboard:${creatorId}`, 180);
      if (method === 'GET' && path === '/v1/dashboard') result = await service.dashboard(creatorId);
      else if (method === 'PUT' && path === '/v1/dashboard/settings')
        result = await service.settings(creatorId, body);
      else if (method === 'POST' && path === '/v1/dashboard/pairing-code')
        result = await service.pairCode(creatorId);
      else if (method === 'POST' && path === '/v1/dashboard/overlay/rotate')
        result = await service.rotateOverlay(creatorId);
      else if (method === 'POST' && path === '/v1/dashboard/test-alert')
        result = await service.testAlert(creatorId);
      else if (method === 'POST' && /^\/v1\/dashboard\/devices\/[^/]+\/revoke$/.test(path))
        result = await service.revokeDevice(creatorId, parts[3]);
      else if (
        method === 'POST' &&
        /^\/v1\/dashboard\/messages\/[^/]+\/(approve|reject)$/.test(path)
      ) {
        const manual = (body as { observationId?: unknown })?.observationId;
        if (manual !== undefined && typeof manual !== 'string')
          throw new HttpError(400, 'Invalid observation');
        result = await service.moderate(
          creatorId,
          parts[3],
          parts[4] as 'approve' | 'reject',
          manual,
        );
      } else if (method === 'DELETE' && path === '/v1/dashboard/account')
        result = await service.deleteCreator(creatorId);
      else throw new HttpError(404, 'Route not found');
    } else throw new HttpError(404, 'Route not found');
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
