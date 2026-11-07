import { HttpError } from '../../domain/service';
import type { RouteGroup } from '../route-types';
export const adminRoutes: RouteGroup = {
  matches: ({ path }) => path.startsWith('/v1/admin/'),
  async before(service, request) {
    const creatorId = request.creatorId;
    if (!creatorId) throw new HttpError(401, 'Sign in required');
    await service.requireAdmin(creatorId);
    await service.rate(`admin:${creatorId}`, 60);
  },
  routes: [
    {
      matches: ({ method, path }) => method === 'GET' && path === '/v1/admin/users',
      async handle(service, request) {
        const creatorId = request.creatorId!;

        return await service.users(creatorId, request.cursor);
      },
    },
    {
      matches: ({ method, path }) =>
        method === 'POST' && /^\/v1\/admin\/users\/[^/]+\/(ban|unban|delete)$/.test(path),
      async handle(service, request) {
        const creatorId = request.creatorId!;
        const parts = request.path.split('/').filter(Boolean);

        return await service.manageUser(creatorId, decodeURIComponent(parts[3]), parts[4]);
      },
    },
  ],
};
