import type { RouteGroup } from '../route-types';
export const overlayRoutes: RouteGroup = {
  matches: ({ path }) => path.startsWith('/v1/overlay/'),

  routes: [
    {
      matches: ({ method, path }) => method === 'GET' && path === '/v1/overlay/alert-controls',
      async handle(service, request) {
        const { token, ip } = request;

        await service.rate(`overlay-ip:${ip}`, 120);
        return await service.overlayAlertControls(token || '');
      },
    },
    {
      matches: ({ method, path }) => method === 'GET' && path === '/v1/overlay/support-goal',
      async handle(service, request) {
        const { token, ip } = request;

        await service.rate(`overlay-ip:${ip}`, 120);
        return await service.overlayGoal(token || '');
      },
    },
    {
      matches: ({ method, path }) => method === 'POST' && path === '/v1/overlay/session',
      async handle(service, request) {
        const { token, ip } = request;

        await service.rate(`overlay-ip:${ip}`, 120);
        return await service.ticket(token || '');
      },
    },
  ],
};
