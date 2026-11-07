import { HttpError } from '../../domain/service';
import type { RouteGroup } from '../route-types';
export const accountRoutes: RouteGroup = {
  matches: ({ path }) => path === '/v1/account',
  async before(service, request) {
    if (!request.creatorId) throw new HttpError(401, 'Sign in required');
    if (request.method !== 'GET') throw new HttpError(405, 'Method not allowed');
  },
  routes: [
    {
      matches: ({ method }) => method === 'GET',
      async handle(service, request) {
        const creatorId = request.creatorId!;

        return await service.account(creatorId);
      },
    },
  ],
};
