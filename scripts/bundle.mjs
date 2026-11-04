import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await build({
  absWorkingDir: root,
  entryPoints: [
    'packages/backend/alert-api/src/handlers/http.ts',
    'packages/backend/alert-api/src/handlers/socket.ts',
    'packages/backend/alert-api/src/handlers/outbox.ts',
  ],
  outdir: 'packages/backend/alert-api/dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
});
