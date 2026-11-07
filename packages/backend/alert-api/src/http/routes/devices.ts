import { HttpError } from '../../domain/service';
import type { RouteGroup } from '../route-types';
export const devicesRoutes: RouteGroup = {
  matches: ({ path }) => path.startsWith('/v1/device/'),

  routes: [
    {
      matches: ({ method, path }) => method === 'POST' && path === '/v1/device/pair',
      async handle(service, request) {
        const { body, ip } = request;
        const creatorId = request.creatorId;

        await service.rate(`pair-ip:${ip}`, 10);
        const code = (body as { code?: string })?.code;
        if (typeof code !== 'string' || !/^[A-Fa-f0-9]{12}$/.test(code))
          throw new HttpError(400, 'Invalid code');
        if (!creatorId) throw new HttpError(401, 'Sign in required');
        return await service.pair(code, creatorId);
      },
    },
    {
      matches: ({ method, path }) =>
        method === 'POST' && path === '/v1/device/payment-observations',
      async handle(service, request) {
        const { body, token } = request;

        return await service.observe(token || '', body);
      },
    },
  ],
};
