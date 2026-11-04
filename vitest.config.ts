import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'packages/backend/alert-api/test/**/*.test.ts',
      'packages/frontend/tiprelay-web/src/**/*.test.ts',
    ],
    testTimeout: 15000,
  },
});
