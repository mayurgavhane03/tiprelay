import { HttpError } from '../../domain/service';
import type { RouteGroup } from '../route-types';
export const dashboardRoutes: RouteGroup = {
  matches: ({ path }) => path.startsWith('/v1/dashboard'),
  async before(service, request) {
    const creatorId = request.creatorId;
    if (!creatorId) throw new HttpError(401, 'Sign in required');
    await service.rate(`dashboard:${creatorId}`, 180);
  },
  routes: [
    {
      matches: ({ method, path }) => method === 'GET' && path === '/v1/dashboard',
      async handle(service, request) {
        const creatorId = request.creatorId!;

        return await service.dashboard(creatorId);
      },
    },
    {
      matches: ({ method, path }) =>
        method === 'POST' && /^\/v1\/dashboard\/payments\/[^/]+\/verify$/.test(path),
      async handle(service, request) {
        const creatorId = request.creatorId!;
        const parts = request.path.split('/').filter(Boolean);

        return await service.verifyPayment(creatorId, parts[3]);
      },
    },
    {
      matches: ({ method, path }) => method === 'PUT' && path === '/v1/dashboard/settings',
      async handle(service, request) {
        const { body } = request;
        const creatorId = request.creatorId!;

        return await service.settings(creatorId, body);
      },
    },
    {
      matches: ({ method, path }) => method === 'PUT' && path === '/v1/dashboard/alert-controls',
      async handle(service, request) {
        const { body } = request;
        const creatorId = request.creatorId!;

        return await service.saveAlertControls(creatorId, body);
      },
    },
    {
      matches: ({ method, path }) => method === 'PUT' && path === '/v1/dashboard/support-goal',
      async handle(service, request) {
        const { body } = request;
        const creatorId = request.creatorId!;

        return await service.saveSupportGoal(creatorId, body);
      },
    },
    {
      matches: ({ method, path }) => method === 'POST' && path === '/v1/dashboard/pairing-code',
      async handle(service, request) {
        const creatorId = request.creatorId!;

        return await service.pairCode(creatorId);
      },
    },
    {
      matches: ({ method, path }) => method === 'POST' && path === '/v1/dashboard/overlay/rotate',
      async handle(service, request) {
        const creatorId = request.creatorId!;

        return await service.rotateOverlay(creatorId);
      },
    },
    {
      matches: ({ method, path }) => method === 'POST' && path === '/v1/dashboard/test-alert',
      async handle(service, request) {
        const creatorId = request.creatorId!;

        return await service.testAlert(creatorId);
      },
    },
    {
      matches: ({ method, path }) =>
        method === 'POST' && /^\/v1\/dashboard\/devices\/[^/]+\/revoke$/.test(path),
      async handle(service, request) {
        const creatorId = request.creatorId!;
        const parts = request.path.split('/').filter(Boolean);

        return await service.revokeDevice(creatorId, parts[3]);
      },
    },
    {
      matches: ({ method, path }) =>
        method === 'POST' && /^\/v1\/dashboard\/messages\/[^/]+\/(approve|reject)$/.test(path),
      async handle(service, request) {
        const { body } = request;
        const creatorId = request.creatorId!;
        const parts = request.path.split('/').filter(Boolean);

        const manual = (body as { observationId?: unknown })?.observationId;
        if (manual !== undefined && typeof manual !== 'string')
          throw new HttpError(400, 'Invalid observation');
        return await service.moderate(
          creatorId,
          parts[3],
          parts[4] as 'approve' | 'reject',
          manual,
        );
      },
    },
    {
      matches: ({ method, path }) => method === 'DELETE' && path === '/v1/dashboard/account',
      async handle(service, request) {
        const creatorId = request.creatorId!;

        return await service.deleteCreator(creatorId);
      },
    },
  ],
};
