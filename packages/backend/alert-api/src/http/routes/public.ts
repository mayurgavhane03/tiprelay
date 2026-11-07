import type { RouteGroup } from '../route-types';
export const publicRoutes: RouteGroup = {
  matches: ({ path }) => path === '/health' || path.startsWith('/v1/public/'),

  routes: [
    {
      matches: ({ method, path }) => method === 'GET' && path === '/health',
      async handle() {
        return { ok: true };
      },
    },
    {
      matches: ({ method, path }) =>
        method === 'GET' && /^\/v1\/public\/creators\/[^/]+$/.test(path),
      async handle(service, request) {
        const parts = request.path.split('/').filter(Boolean);

        return await service.publicCreator(parts[3]);
      },
    },
    {
      matches: ({ method, path }) =>
        method === 'POST' && /^\/v1\/public\/creators\/[^/]+\/messages$/.test(path),
      async handle(service, request) {
        const { body, ip } = request;
        const parts = request.path.split('/').filter(Boolean);

        return await service.submit(parts[3], body, ip);
      },
    },
  ],
};
